/**
 * Document Chunker for Voyage Context-3
 * Creates non-overlapping chunks optimized for contextualized embeddings
 */

import { encoding_for_model } from 'tiktoken';
import { Document, Chunk, ChunkedDocument } from '../types/index.js';
import crypto from 'crypto';

export interface ChunkOptions {
  chunkSize: number;      // Target tokens per chunk
  chunkOverlap: number;   // Overlap between chunks (0 for Context-3)
  minChunkSize: number;   // Minimum tokens per chunk
  maxChunkSize: number;   // Maximum tokens per chunk
  preserveStructure: boolean;
}

export class DocumentChunker {
  private encoder = encoding_for_model('gpt-3.5-turbo');
  private defaultOptions: ChunkOptions = {
    chunkSize: 512,        // Optimal for Context-3
    chunkOverlap: 0,       // NO overlap for contextualized embeddings
    minChunkSize: 100,     // Don't create tiny chunks
    maxChunkSize: 1000,    // Stay within limits
    preserveStructure: true,
  };

  /**
   * Chunk multiple documents for Voyage Context-3
   * Returns documents ready for contextualized embedding
   */
  async chunkDocuments(documents: Document[]): Promise<ChunkedDocument[]> {
    console.error(`📄 Chunking ${documents.length} documents...`);
    const chunkedDocs: ChunkedDocument[] = [];
    
    for (const doc of documents) {
      try {
        const chunks = this.chunkDocument(doc);
        
        if (chunks.length > 0) {
          chunkedDocs.push({
            documentId: doc.id,
            documentMetadata: doc.metadata,
            chunks,
            totalChunks: chunks.length,
          });
        }
      } catch (error) {
        console.error(`Failed to chunk document ${doc.id}:`, error);
      }
    }
    
    console.error(`✅ Created ${chunkedDocs.reduce((sum, d) => sum + d.chunks.length, 0)} chunks from ${chunkedDocs.length} documents`);
    return chunkedDocs;
  }

  /**
   * Chunk a single document
   * Optimized for Voyage Context-3's contextualized embeddings
   */
  private chunkDocument(doc: Document, options: Partial<ChunkOptions> = {}): Chunk[] {
    const opts = { ...this.defaultOptions, ...options };
    const chunks: Chunk[] = [];
    
    // Parse document structure
    const sections = this.parseDocumentStructure(doc.content);
    
    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, opts);
      chunks.push(...sectionChunks);
    }
    
    // Add chunk index to metadata
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
      },
    }));
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
      hasCode: false,
    };
    
    let inCodeBlock = false;
    
    for (const line of lines) {
      // Detect headers (Markdown and reStructuredText)
      const headerMatch = this.detectHeader(line);
      
      if (headerMatch && !inCodeBlock) {
        // Save current section if it has content
        if (currentSection.content.trim().length > 0) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: headerMatch.title,
          level: headerMatch.level,
          content: '',
          hasCode: false,
        };
      } else {
        // Add line to current section
        currentSection.content += line + '\n';
        
        // Track code blocks
        if (line.trim().startsWith('```') || line.trim().startsWith('.. code-block::')) {
          inCodeBlock = !inCodeBlock;
          currentSection.hasCode = true;
        }
      }
    }
    
    // Add final section
    if (currentSection.content.trim().length > 0) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Detect headers in Markdown and reStructuredText
   */
  private detectHeader(line: string): { title: string; level: number } | null {
    // Markdown headers
    const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      return {
        title: mdMatch[2].trim(),
        level: mdMatch[1].length,
      };
    }
    
    // reStructuredText headers (simplified detection)
    if (line.length > 3 && !line.includes('::') && !line.startsWith('..')) {
      return {
        title: line.trim(),
        level: 2,
      };
    }
    
    return null;
  }

  /**
   * Chunk a section into smaller pieces
   * Optimized for Context-3 (no overlap needed)
   */
  private chunkSection(section: Section, options: ChunkOptions): Chunk[] {
    const chunks: Chunk[] = [];
    const tokens = this.encoder.encode(section.content);
    const tokenCount = tokens.length;
    
    // If section fits in one chunk, return as-is
    if (tokenCount <= options.chunkSize) {
      chunks.push(this.createChunk(section.content, section, tokenCount));
      return chunks;
    }
    
    // Split large sections at natural boundaries
    const sentences = this.splitIntoSentences(section.content);
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.encoder.encode(sentence).length;
      
      // Check if adding this sentence would exceed chunk size
      if (currentTokens + sentenceTokens > options.chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push(this.createChunk(currentChunk, section, currentTokens, chunks.length > 0));
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Add sentence to current chunk
      currentChunk += sentence + ' ';
      currentTokens += sentenceTokens;
    }
    
    // Save final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(currentChunk, section, currentTokens, chunks.length > 0));
    }
    
    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be improved with NLP library)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Create a chunk with metadata
   */
  private createChunk(
    content: string,
    section: Section,
    tokenCount: number,
    isContinuation = false
  ): Chunk {
    return {
      content: content.trim(),
      metadata: {
        sectionTitle: section.title,
        sectionLevel: section.level,
        hasCode: section.hasCode,
        tokenCount,
        isContinuation,
      },
    };
  }

  /**
   * Generate hash for content deduplication
   */
  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

interface Section {
  title: string;
  level: number;
  content: string;
  hasCode: boolean;
}