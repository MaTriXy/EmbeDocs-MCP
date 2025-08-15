/**
 * Smart Document Chunker - Adaptive chunking for any content type
 * 
 * Merges the best of:
 * - DocumentChunker (basic chunking)
 * - EnhancedDocumentChunker (quality scoring)
 * 
 * Features:
 * - Automatic content type detection
 * - Optimal chunk sizing for voyage-3 vs voyage-code-3
 * - Semantic boundary preservation
 * - Code block integrity
 */

import { encoding_for_model } from 'tiktoken';
import { Document, Chunk, ChunkedDocument } from '../types/index.js';
import { ContentQualityScorer, QualityScore } from './content-quality-scorer.js';
import crypto from 'crypto';

export interface ChunkOptions {
  targetSize?: number;      // Target tokens per chunk
  maxSize?: number;         // Maximum tokens per chunk
  minSize?: number;         // Minimum tokens per chunk
  preserveCode?: boolean;   // Keep code blocks intact
  preserveExamples?: boolean; // Keep examples together
  semanticBoundaries?: boolean; // Split at natural boundaries
  overlap?: number;         // Token overlap between chunks
}

export class SmartChunker {
  private encoder = encoding_for_model('gpt-4');
  private qualityScorer = new ContentQualityScorer();
  
  private readonly DEFAULT_OPTIONS: ChunkOptions = {
    targetSize: 512,    // 2025: 256-512 tokens optimal with voyage-context-3
    maxSize: 768,       // 2025: Smaller chunks work better with context-aware embeddings
    minSize: 256,       // 2025: Increased minimum for better semantic coherence
    preserveCode: true,
    preserveExamples: true,
    semanticBoundaries: true,
    overlap: 50         // 2025: 10-15% overlap (50/512 ≈ 10%)
  };

  /**
   * Chunk multiple documents intelligently
   */
  async chunkDocuments(documents: Document[], options: ChunkOptions = {}): Promise<ChunkedDocument[]> {
    console.log(`📄 Smart chunking ${documents.length} documents...`);
    
    const chunkedDocs: ChunkedDocument[] = [];
    let totalChunks = 0;
    let technicalChunks = 0;
    
    for (const doc of documents) {
      try {
        // Score document quality
        const quality = this.qualityScorer.scoreDocument(doc);
        
        // Adapt chunking strategy based on content type
        const chunkOptions = this.adaptOptionsForContent(quality, options);
        
        // Chunk the document
        const chunks = this.chunkDocument(doc, quality, chunkOptions);
        
        if (chunks.length > 0) {
          const chunkedDoc: ChunkedDocument = {
            documentId: doc.id,
            documentMetadata: {
              ...doc.metadata,
              qualityScore: quality.score,
              contentType: quality.contentType,
              boostFactor: quality.boostFactor
            } as any,
            chunks,
            totalChunks: chunks.length
          };
          
          chunkedDocs.push(chunkedDoc);
          totalChunks += chunks.length;
          technicalChunks += chunks.filter(c => c.metadata.contentType === 'technical').length;
        }
      } catch (error) {
        console.error(`Failed to chunk document ${doc.id}:`, error);
      }
    }
    
    console.log(`✅ Created ${totalChunks} chunks (${technicalChunks} technical, ${totalChunks - technicalChunks} general)`);
    return chunkedDocs;
  }

  /**
   * Adapt chunking options based on content type
   */
  private adaptOptionsForContent(quality: QualityScore, baseOptions: ChunkOptions): ChunkOptions {
    const opts = { ...this.DEFAULT_OPTIONS, ...baseOptions };
    
    // Adjust for content type
    switch (quality.contentType) {
      case 'technical':
        // Smaller chunks for technical content (better for voyage-code-3)
        opts.targetSize = 512;
        opts.maxSize = 768;
        opts.overlap = 0; // No overlap for technical content
        break;
      
      case 'example':
        // Keep examples together
        opts.targetSize = 800;
        opts.maxSize = 1200;
        opts.preserveExamples = true;
        break;
      
      case 'conceptual':
        // Larger chunks for conceptual content
        opts.targetSize = 800;
        opts.maxSize = 1000;
        opts.overlap = 100;
        break;
      
      case 'meta':
        // Very large chunks for meta content (low priority anyway)
        opts.targetSize = 1000;
        opts.maxSize = 1500;
        break;
    }
    
    return opts;
  }

  /**
   * Chunk a single document with quality awareness
   */
  private chunkDocument(doc: Document, quality: QualityScore, options: ChunkOptions): Chunk[] {
    const chunks: Chunk[] = [];
    
    // Parse document structure
    const sections = this.parseDocumentStructure(doc.content);
    
    // Process each section
    for (const section of sections) {
      // Detect if section has code
      const hasCode = this.detectCode(section.content);
      
      // Determine content type for this section
      const sectionType = hasCode ? 'technical' : quality.contentType;
      
      // Chunk the section
      const sectionChunks = this.chunkSection(section, sectionType, options);
      
      // Add metadata to each chunk
      sectionChunks.forEach((chunk, index) => {
        chunks.push({
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            documentId: doc.id,
            chunkIndex: chunks.length + index,
            contentType: sectionType as 'technical' | 'conceptual' | 'meta' | 'general',
            qualityScore: quality.score,
            boostFactor: quality.boostFactor,
            hasCode,
            sectionTitle: section.title,
            sectionLevel: section.level
          }
        });
      });
    }
    
    return chunks;
  }

  /**
   * Parse document into logical sections
   */
  private parseDocumentStructure(content: string): Section[] {
    const sections: Section[] = [];
    const lines = content.split('\n');
    
    let currentSection: Section = {
      title: 'Introduction',
      level: 1,
      content: '',
      startLine: 0
    };
    
    let inCodeBlock = false;
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      
      // Track code blocks
      if (line.trim().startsWith('```') || line.trim().startsWith('.. code-block::')) {
        inCodeBlock = !inCodeBlock;
      }
      
      // Detect headers (only outside code blocks)
      if (!inCodeBlock) {
        const header = this.detectHeader(line);
        if (header) {
          // Save current section if it has content
          if (currentSection.content.trim().length > 0) {
            sections.push(currentSection);
          }
          
          // Start new section
          currentSection = {
            title: header.title,
            level: header.level,
            content: '',
            startLine: lineNumber
          };
          continue;
        }
      }
      
      // Add line to current section
      currentSection.content += line + '\n';
    }
    
    // Add final section
    if (currentSection.content.trim().length > 0) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Chunk a section intelligently
   */
  private chunkSection(section: Section, contentType: string, options: ChunkOptions): Chunk[] {
    const chunks: Chunk[] = [];
    const content = section.content.trim();
    
    if (!content) return chunks;
    
    // Count tokens
    const tokens = this.encoder.encode(content);
    const tokenCount = tokens.length;
    
    // If section fits in one chunk, return as-is
    if (tokenCount <= options.targetSize!) {
      chunks.push(this.createChunk(content, tokenCount, contentType));
      return chunks;
    }
    
    // For code blocks, try to keep them together
    if (options.preserveCode && this.detectCode(content)) {
      const codeBlocks = this.extractCodeBlocks(content);
      
      for (const block of codeBlocks) {
        const blockTokens = this.encoder.encode(block.content).length;
        
        // If code block is too large, split it carefully
        if (blockTokens > options.maxSize!) {
          chunks.push(...this.splitLargeCodeBlock(block.content, options));
        } else {
          chunks.push(this.createChunk(block.content, blockTokens, 'technical'));
        }
      }
      
      return chunks;
    }
    
    // For regular content, split at sentence boundaries
    chunks.push(...this.splitBySentences(content, options, contentType));
    
    return chunks;
  }

  /**
   * Split content by sentences
   */
  private splitBySentences(content: string, options: ChunkOptions, contentType: string): Chunk[] {
    const chunks: Chunk[] = [];
    const sentences = this.splitIntoSentences(content);
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.encoder.encode(sentence).length;
      
      // Check if adding this sentence would exceed target size
      if (currentTokens + sentenceTokens > options.targetSize! && currentChunk.length > 0) {
        // Save current chunk
        chunks.push(this.createChunk(currentChunk.trim(), currentTokens, contentType));
        
        // Start new chunk with overlap if specified
        if (options.overlap && options.overlap > 0 && chunks.length > 0) {
          const overlapText = this.getOverlapText(currentChunk, options.overlap);
          currentChunk = overlapText + ' ' + sentence;
          currentTokens = this.encoder.encode(currentChunk).length;
        } else {
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    // Save final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(currentChunk.trim(), currentTokens, contentType));
    }
    
    return chunks;
  }

  /**
   * Extract code blocks from content
   */
  private extractCodeBlocks(content: string): Array<{content: string, language?: string}> {
    const blocks: Array<{content: string, language?: string}> = [];
    
    // Markdown code blocks
    const mdRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    while ((match = mdRegex.exec(content)) !== null) {
      blocks.push({
        content: match[2],
        language: match[1] || undefined
      });
    }
    
    // RST code blocks
    const rstRegex = /\.\. code-block::\s*(\w+)?\s*\n((?:\s{2,}.*\n?)*)/g;
    while ((match = rstRegex.exec(content)) !== null) {
      blocks.push({
        content: match[2].replace(/^\s{2,}/gm, ''),
        language: match[1] || undefined
      });
    }
    
    return blocks;
  }

  /**
   * Split large code block carefully
   */
  private splitLargeCodeBlock(code: string, options: ChunkOptions): Chunk[] {
    const chunks: Chunk[] = [];
    const lines = code.split('\n');
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const line of lines) {
      const lineTokens = this.encoder.encode(line + '\n').length;
      
      if (currentTokens + lineTokens > options.maxSize! && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk, currentTokens, 'technical'));
        currentChunk = line + '\n';
        currentTokens = lineTokens;
      } else {
        currentChunk += line + '\n';
        currentTokens += lineTokens;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(currentChunk, currentTokens, 'technical'));
    }
    
    return chunks;
  }

  /**
   * Get overlap text from previous chunk
   */
  private getOverlapText(text: string, overlapTokens: number): string {
    const sentences = this.splitIntoSentences(text);
    let overlap = '';
    let tokens = 0;
    
    // Add sentences from the end until we reach overlap size
    for (let i = sentences.length - 1; i >= 0 && tokens < overlapTokens; i--) {
      const sentence = sentences[i];
      const sentenceTokens = this.encoder.encode(sentence).length;
      
      if (tokens + sentenceTokens <= overlapTokens) {
        overlap = sentence + (overlap ? ' ' + overlap : '');
        tokens += sentenceTokens;
      }
    }
    
    return overlap;
  }

  /**
   * Create a chunk with metadata
   */
  private createChunk(content: string, tokenCount: number, contentType: string): Chunk {
    return {
      content: content.trim(),
      metadata: {
        hasCode: this.detectCode(content),
        tokenCount,
        contentType: contentType as any,
        contentHash: this.hashContent(content)
      }
    };
  }

  /**
   * Detect if content contains code
   */
  private detectCode(content: string): boolean {
    const codeIndicators = [
      /```[\w]*\n/,          // Markdown code blocks
      /\.\. code-block::/,   // RST code blocks
      /^\s{4,}\w+/m,         // Indented code
      /db\.\w+\.\w+\(/,      // MongoDB commands
      /\$\w+\s*:/,           // MongoDB operators
      /function\s*\(/,       // Functions
      /class\s+\w+/,         // Classes
      /import\s+/,           // Imports
      /const\s+\w+\s*=/,     // Const declarations
    ];
    
    return codeIndicators.some(pattern => pattern.test(content));
  }

  /**
   * Detect header in markdown or RST
   */
  private detectHeader(line: string): { title: string; level: number } | null {
    // Markdown headers
    const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      return {
        title: mdMatch[2].trim(),
        level: mdMatch[1].length
      };
    }
    
    // RST headers (simplified)
    if (line.length > 3 && !line.includes('::') && !line.startsWith('..')) {
      return {
        title: line.trim(),
        level: 2
      };
    }
    
    return null;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Improved sentence splitting
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Generate content hash
   */
  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}

interface Section {
  title: string;
  level: number;
  content: string;
  startLine: number;
}
