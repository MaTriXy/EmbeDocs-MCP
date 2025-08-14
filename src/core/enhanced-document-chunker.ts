/**
 * Enhanced Document Chunker for MongoDB Technical Documentation
 * Optimized for voyage-code-3 model with code-aware chunking
 */

import { encoding_for_model } from 'tiktoken';
import { Document, Chunk, ChunkedDocument } from '../types/index.js';
import { ContentQualityScorer, QualityScore } from './content-quality-scorer.js';
import crypto from 'crypto';

export interface EnhancedChunkOptions {
  chunkSize: number;           // Target tokens per chunk (512-768 for technical content)
  maxChunkSize: number;        // Maximum tokens per chunk
  minChunkSize: number;        // Minimum tokens per chunk
  preserveCodeBlocks: boolean; // Keep code blocks intact
  preserveExamples: boolean;   // Keep examples with explanations
  semanticBoundaries: boolean; // Split at headers/sections
  contextOverlap: number;      // Overlap for context (minimal for voyage-code-3)
}

interface DocumentSection {
  title: string;
  level: number;
  content: string;
  hasCode: boolean;
  isExample: boolean;
  startIndex: number;
  endIndex: number;
}

export class EnhancedDocumentChunker {
  private encoder = encoding_for_model('gpt-4');
  private qualityScorer = new ContentQualityScorer();
  
  private defaultOptions: EnhancedChunkOptions = {
    chunkSize: 600,           // Optimal for voyage-code-3
    maxChunkSize: 1000,       // Hard limit
    minChunkSize: 200,        // Minimum viable chunk
    preserveCodeBlocks: true,
    preserveExamples: true,
    semanticBoundaries: true,
    contextOverlap: 50        // Minimal overlap for voyage-code-3
  };

  /**
   * Chunk documents with enhanced technical content awareness
   */
  chunkDocuments(docs: Document[], options: Partial<EnhancedChunkOptions> = {}): ChunkedDocument[] {
    const opts = { ...this.defaultOptions, ...options };
    
    return docs.map(doc => {
      const qualityScore = this.qualityScorer.scoreDocument(doc);
      const chunks = this.chunkDocument(doc, opts, qualityScore);
      
      return {
        documentId: doc.id,
        totalChunks: chunks.length,
        documentMetadata: {
          ...doc.metadata,
          qualityScore: qualityScore.score,
          contentType: qualityScore.contentType,
          boostFactor: qualityScore.boostFactor
        },
        chunks
      };
    });
  }

  private chunkDocument(doc: Document, options: EnhancedChunkOptions, qualityScore: QualityScore): Chunk[] {
    // Parse document into semantic sections
    const sections = this.parseDocumentSections(doc.content);
    
    // Group sections into chunks based on content type
    if (qualityScore.contentType === 'technical') {
      return this.chunkTechnicalContent(sections, options, doc);
    } else {
      return this.chunkGeneralContent(sections, options, doc);
    }
  }

  private parseDocumentSections(content: string): DocumentSection[] {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    let currentSection: DocumentSection = {
      title: '',
      level: 0,
      content: '',
      hasCode: false,
      isExample: false,
      startIndex: 0,
      endIndex: 0
    };
    
    let inCodeBlock = false;
    let lineIndex = 0;
    
    for (const line of lines) {
      // Detect headers (Markdown and cleaned RST)
      const headerMatch = this.detectHeader(line);
      
      if (headerMatch && !inCodeBlock) {
        // Save current section if it has content
        if (currentSection.content.trim().length > 0) {
          currentSection.endIndex = lineIndex;
          sections.push({ ...currentSection });
        }
        
        // Start new section
        currentSection = {
          title: headerMatch.title,
          level: headerMatch.level,
          content: '',
          hasCode: false,
          isExample: this.isExampleSection(headerMatch.title),
          startIndex: lineIndex,
          endIndex: lineIndex
        };
      } else {
        // Add line to current section
        currentSection.content += line + '\n';
        
        // Track code blocks
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          currentSection.hasCode = true;
        }
        
        // Detect MongoDB code patterns
        if (/db\.\w+\.\w+\(|^\s*{|\$\w+/.test(line)) {
          currentSection.hasCode = true;
        }
      }
      
      lineIndex++;
    }
    
    // Add final section
    if (currentSection.content.trim().length > 0) {
      currentSection.endIndex = lineIndex;
      sections.push(currentSection);
    }
    
    return sections;
  }

  private chunkTechnicalContent(sections: DocumentSection[], options: EnhancedChunkOptions, doc: Document): Chunk[] {
    const chunks: Chunk[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    let chunkSections: DocumentSection[] = [];
    
    for (const section of sections) {
      const sectionTokens = this.encoder.encode(section.content).length;
      
      // If section has code or is an example, try to keep it intact
      if ((section.hasCode || section.isExample) && sectionTokens <= options.maxChunkSize) {
        // If adding this section would exceed chunk size, save current chunk
        if (currentTokens + sectionTokens > options.chunkSize && currentChunk.length > 0) {
          chunks.push(this.createTechnicalChunk(currentChunk, chunkSections, doc, chunks.length));
          currentChunk = '';
          currentTokens = 0;
          chunkSections = [];
        }
        
        // Add entire section
        currentChunk += section.content;
        currentTokens += sectionTokens;
        chunkSections.push(section);
      } else {
        // Split large sections at sentence boundaries
        const sentences = this.splitIntoSentences(section.content);
        
        for (const sentence of sentences) {
          const sentenceTokens = this.encoder.encode(sentence).length;
          
          if (currentTokens + sentenceTokens > options.chunkSize && currentChunk.length > 0) {
            chunks.push(this.createTechnicalChunk(currentChunk, chunkSections, doc, chunks.length));
            currentChunk = '';
            currentTokens = 0;
            chunkSections = [];
          }
          
          currentChunk += sentence + ' ';
          currentTokens += sentenceTokens;
        }
        
        chunkSections.push(section);
      }
    }
    
    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createTechnicalChunk(currentChunk, chunkSections, doc, chunks.length));
    }
    
    return chunks;
  }

  private chunkGeneralContent(sections: DocumentSection[], options: EnhancedChunkOptions, doc: Document): Chunk[] {
    // Simpler chunking for non-technical content
    const chunks: Chunk[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const section of sections) {
      const sentences = this.splitIntoSentences(section.content);
      
      for (const sentence of sentences) {
        const sentenceTokens = this.encoder.encode(sentence).length;
        
        if (currentTokens + sentenceTokens > options.chunkSize && currentChunk.length > 0) {
          chunks.push(this.createGeneralChunk(currentChunk, doc, chunks.length));
          currentChunk = '';
          currentTokens = 0;
        }
        
        currentChunk += sentence + ' ';
        currentTokens += sentenceTokens;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createGeneralChunk(currentChunk, doc, chunks.length));
    }
    
    return chunks;
  }

  private createTechnicalChunk(content: string, sections: DocumentSection[], doc: Document, index: number): Chunk {
    const hasCode = sections.some(s => s.hasCode);
    const isExample = sections.some(s => s.isExample);
    const tokenCount = this.encoder.encode(content).length;

    return {
      content: content.trim(),
      metadata: {
        chunkIndex: index,
        hasCode,
        isExample,
        sectionTitles: sections.map(s => s.title).filter(t => t),
        contentType: 'technical',
        tokenCount,
        ...doc.metadata
      }
    };
  }

  private createGeneralChunk(content: string, doc: Document, index: number): Chunk {
    const tokenCount = this.encoder.encode(content).length;

    return {
      content: content.trim(),
      metadata: {
        chunkIndex: index,
        hasCode: false,
        isExample: false,
        contentType: 'general',
        tokenCount,
        ...doc.metadata
      }
    };
  }

  private detectHeader(line: string): { title: string; level: number } | null {
    // Markdown headers
    const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      return { title: mdMatch[2], level: mdMatch[1].length };
    }
    
    // Detect cleaned content that looks like headers
    if (line.trim().length > 0 && line.trim().length < 100 && 
        /^[A-Z]/.test(line.trim()) && !line.includes('.')) {
      return { title: line.trim(), level: 1 };
    }
    
    return null;
  }

  private isExampleSection(title: string): boolean {
    return /example|sample|demo|tutorial|how.to/i.test(title);
  }

  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  }

  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
