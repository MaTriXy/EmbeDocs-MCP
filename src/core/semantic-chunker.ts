/**
 * Advanced Semantic Chunking Service 
 * Inspired by Harry-231/Contextual_RAG + curiousily/ragbase + research benchmarks
 * 
 * Combines:
 * - Harry-231's voyage-context-3 integration patterns
 * - curiousily/ragbase hybrid chunking approach  
 * - monami44's benchmark-proven methods
 */

import { EmbeddingService, EmbeddingResult } from './embeddings.js';
import { config } from '../config/index.js';
import { getEncoding } from 'js-tiktoken';

// Interface removed - not needed in current implementation

interface ChunkingMetrics {
  totalChunks: number;
  averageChunkSize: number;
  semanticBoundaries: number;
  fallbackUsage: number;
  totalRequests: number;
}

export class AdvancedSemanticChunker {
  private embeddingService: EmbeddingService;
  private metricsCollected: ChunkingMetrics;
  private tokenEncoder = getEncoding('gpt2'); // MongoDB Dev's proven approach
  
  constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    this.metricsCollected = {
      totalChunks: 0,
      averageChunkSize: 0,
      semanticBoundaries: 0,
      fallbackUsage: 0,
      totalRequests: 0
    };
  }

  /**
   * Multi-strategy semantic chunking based on research
   * 1. Try interquartile method (highest benchmark score: 41.71)
   * 2. Fallback to gradient method (Harry-231's choice)
   * 3. Ultimate fallback to hybrid approach (curiousily/ragbase)
   */
  async chunkContent(content: string, strategy: 'auto' | 'interquartile' | 'gradient' | 'hybrid' = 'auto'): Promise<string[]> {
    this.metricsCollected.totalRequests++;
    
    try {
      // Preprocess content like Harry-231's implementation
      const cleanContent = this.preprocessContent(content);
      
      // Split into sentences (following LangChain + Harry-231 patterns)
      const sentences = this.splitIntoSentences(cleanContent);
      
      if (sentences.length <= 3) {
        return [cleanContent]; // Too short for semantic chunking
      }

      // Choose strategy based on content type and research
      const chosenStrategy = strategy === 'auto' ? this.selectOptimalStrategy(content) : strategy;
      
      let chunks: string[];
      
      switch (chosenStrategy) {
        case 'interquartile':
          chunks = await this.interquartileChunking(sentences);
          break;
        case 'gradient':
          chunks = await this.gradientChunking(sentences);
          break;
        case 'hybrid':
          chunks = await this.hybridChunking(sentences);
          break;
        default:
          chunks = await this.interquartileChunking(sentences);
      }
      
      // Apply Harry-231's post-processing constraints
      const finalChunks = this.applyProductionConstraints(chunks);
      
      // Update metrics
      this.updateMetrics(finalChunks);
      
      return finalChunks;
      
    } catch (error) {
      console.warn('Advanced semantic chunking failed, using fallback:', error);
      this.metricsCollected.fallbackUsage++;
      return this.fallbackChunking(content);
    }
  }

  /**
   * Content preprocessing inspired by Harry-231's approach
   */
  private preprocessContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([.!?])\s*\n/g, '$1 ') // Handle line breaks after sentences
      .trim();
  }

  /**
   * Smart strategy selection based on content analysis
   */
  private selectOptimalStrategy(content: string): 'interquartile' | 'gradient' | 'hybrid' {
    // Technical documentation → interquartile (best benchmark performance)
    if (content.includes('function') || content.includes('API') || content.includes('method')) {
      return 'interquartile';
    }
    
    // Policy/legal documents → gradient (Harry-231's choice for policies)  
    if (content.includes('policy') || content.includes('requirement') || content.includes('shall')) {
      return 'gradient';
    }
    
    // Mixed content → hybrid approach
    return 'hybrid';
  }

  /**
   * Interquartile method - highest benchmark score (41.71)
   * Based on monami44/Langchain-Semantic-Chunking-Arena research
   */
  private async interquartileChunking(sentences: string[]): Promise<string[]> {
    // Get embeddings for all sentences using our voyage-context-3 service
    const embeddings = await this.embeddingService.embedDocuments(sentences);
    
    // Calculate similarity scores
    const similarities = this.calculateSimilarities(embeddings);
    
    // Interquartile breakpoint detection (research-proven)
    const sorted = [...similarities].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const threshold = q1 - (1.5 * iqr); // IQR outlier detection
    
    const breakpoints = similarities.map(sim => sim < threshold);
    
    return this.createChunks(sentences, breakpoints);
  }

  /**
   * Gradient method - Harry-231's choice for production
   * Proven with policy documents in Contextual_RAG
   */
  private async gradientChunking(sentences: string[]): Promise<string[]> {
    const embeddings = await this.embeddingService.embedDocuments(sentences);
    const similarities = this.calculateSimilarities(embeddings);
    
    // Gradient-based breakpoint detection (Harry-231's approach)
    const gradients: number[] = [];
    for (let i = 1; i < similarities.length; i++) {
      gradients.push(similarities[i] - similarities[i - 1]);
    }
    
    const meanGradient = gradients.reduce((a, b) => a + b, 0) / gradients.length;
    const stdGradient = Math.sqrt(
      gradients.reduce((sum, g) => sum + Math.pow(g - meanGradient, 2), 0) / gradients.length
    );
    
    const threshold = meanGradient - stdGradient;
    const breakpoints = gradients.map(g => g < threshold);
    
    return this.createChunks(sentences, [false, ...breakpoints]); // Adjust for offset
  }

  /**
   * Hybrid approach inspired by curiousily/ragbase
   * Combines semantic + size-based chunking
   */
  private async hybridChunking(sentences: string[]): Promise<string[]> {
    // First pass: semantic chunking
    const semanticChunks = await this.interquartileChunking(sentences);
    
    // Second pass: size-based adjustment (ragbase pattern)
    const { chunkSize, chunkOverlap } = config.indexing;
    const finalChunks: string[] = [];
    
    for (const chunk of semanticChunks) {
      if (chunk.length <= chunkSize) {
        finalChunks.push(chunk);
      } else {
        // Split oversized semantic chunks while preserving boundaries
        const subChunks = this.recursiveChunkSplit(chunk, chunkSize, chunkOverlap);
        finalChunks.push(...subChunks);
      }
    }
    
    return finalChunks;
  }

  /**
   * Advanced sentence splitting (Harry-231 + LangChain patterns)
   */
  private splitIntoSentences(text: string): string[] {
    // Advanced sentence splitting that handles technical documentation
    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z])/) // Basic sentence split
      .filter(s => s.trim().length > 20) // Filter very short sentences
      .map(s => s.trim());
    
    return sentences;
  }

  /**
   * Calculate cosine similarities (same as Harry-231's approach)
   */
  private calculateSimilarities(embeddings: EmbeddingResult[]): number[] {
    const similarities: number[] = [];
    
    for (let i = 0; i < embeddings.length - 1; i++) {
      const sim = this.cosineSimilarity(
        embeddings[i].normalized,
        embeddings[i + 1].normalized
      );
      similarities.push(sim);
    }
    
    return similarities;
  }

  /**
   * Create chunks from sentences and breakpoints
   */
  private createChunks(sentences: string[], breakpoints: boolean[]): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [sentences[0]];
    
    for (let i = 0; i < breakpoints.length; i++) {
      if (breakpoints[i] && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        this.metricsCollected.semanticBoundaries++;
        currentChunk = [sentences[i + 1]];
      } else {
        currentChunk.push(sentences[i + 1]);
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
  }

  /**
   * Production constraints inspired by Harry-231's implementation + MongoDB Dev token validation
   * CRITICAL: voyage-context-3 has 32,000 token limit - ULTRA SAFE limits
   */
  private applyProductionConstraints(chunks: string[]): string[] {
    const { chunkSize, chunkOverlap } = config.indexing;
    const minChunkSize = 100;
    const maxChunkSize = 2500; // EMERGENCY FIX: Increased to handle 2246 char chunks from retryable-reads.txt  
    const constrainedChunks: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // CRITICAL: Hard token limit for voyage-context-3 (32,000 token limit)
      const tokenCount = this.getTokenCount(chunk);
      
      // EMERGENCY: Split chunks that exceed safe token limits
      if (tokenCount > 6000) { // 20% of context window - ultra safe
        console.warn(`🚨 SPLITTING oversized chunk: ${tokenCount} tokens -> splitting`);
        const subChunks = this.recursiveChunkSplit(chunk, 1000, 100); // Aggressive split
        constrainedChunks.push(...subChunks);
        continue; // Skip normal processing for this chunk
      }
      
      // Apply size constraints
      if (chunk.length < minChunkSize) {
        // Merge with next chunk if too small
        if (i < chunks.length - 1 && constrainedChunks.length > 0) {
          constrainedChunks[constrainedChunks.length - 1] += ' ' + chunk;
        } else if (constrainedChunks.length > 0) {
          constrainedChunks[constrainedChunks.length - 1] += ' ' + chunk;
        } else {
          constrainedChunks.push(chunk);
        }
      } else if (chunk.length > maxChunkSize) {
        // Split oversized chunks
        const subChunks = this.recursiveChunkSplit(chunk, chunkSize, chunkOverlap);
        constrainedChunks.push(...subChunks);
      } else {
        constrainedChunks.push(chunk);
      }
    }
    
    return constrainedChunks.filter(chunk => chunk.length >= minChunkSize);
  }

  /**
   * Token counting using MongoDB Dev's proven js-tiktoken approach
   */
  private getTokenCount(text: string): number {
    return this.tokenEncoder.encode(text).length;
  }

  /**
   * Recursive chunk splitting with overlap
   */
  private recursiveChunkSplit(chunk: string, maxSize: number, overlap: number): string[] {
    const words = chunk.split(' ');
    const chunks: string[] = [];
    const wordsPerChunk = Math.floor(maxSize / 6); // Rough estimate: 6 chars per word
    const overlapWords = Math.floor(overlap / 6);
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      if (chunkWords.length > 0) {
        chunks.push(chunkWords.join(' '));
      }
    }
    
    return chunks;
  }

  /**
   * Fallback chunking (existing method)
   */
  private fallbackChunking(content: string): string[] {
    const { chunkSize, chunkOverlap } = config.indexing;
    const chunks: string[] = [];
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    
    let currentChunk = '';
    let overlap = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
        chunks.push(overlap + currentChunk);
        
        const words = currentChunk.split(' ');
        overlap = words.slice(-Math.floor(chunkOverlap / 10)).join(' ') + ' ';
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(overlap + currentChunk);
    }
    
    return chunks.map(c => c.trim()).filter(c => c.length > 100);
  }

  /**
   * Cosine similarity (same as Harry-231)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(chunks: string[]): void {
    this.metricsCollected.totalChunks += chunks.length;
    const avgSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length;
    this.metricsCollected.averageChunkSize = 
      (this.metricsCollected.averageChunkSize + avgSize) / 2;
  }

  /**
   * Get performance metrics for monitoring
   */
  getMetrics(): ChunkingMetrics {
    return { ...this.metricsCollected };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metricsCollected = {
      totalChunks: 0,
      averageChunkSize: 0,
      semanticBoundaries: 0,
      fallbackUsage: 0,
      totalRequests: 0
    };
  }
}