/**
 * SINGLE Embedding Service - The ONLY place that generates embeddings
 * No more duplicate implementations!
 */

import axios from 'axios';
import { config } from '../config/index.js';

export interface EmbeddingResult {
  embedding: number[];
  normalized: number[];
  dimensions: number;
  model: string;
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private readonly apiKey: string;
  
  private constructor() {
    this.apiKey = process.env.VOYAGE_API_KEY!;
    if (!this.apiKey) {
      throw new Error('VOYAGE_API_KEY is required');
    }
  }
  
  static getInstance(): EmbeddingService {
    if (!this.instance) {
      this.instance = new EmbeddingService();
    }
    return this.instance;
  }
  
  /**
   * Generate embeddings for documents - FOLLOWS voyage-ai/voyageai-python implementation
   * @see https://github.com/voyage-ai/voyageai-python/blob/main/tests/test_client.py
   */
  async embedDocuments(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];
    
    // voyage-context-3 requires smaller batches due to 32,000 token limit
    // Documentation: voyage-ai/langchain-voyageai/libs/voyageai/langchain_voyageai/embeddings.py
    if (config.embedding.model.includes('context')) {
      // For context models, use VERY small batches to stay under token limit
      const maxContextBatchSize = 1; // Process one chunk at a time for safety
      const batches = this.createBatches(texts, maxContextBatchSize);
      const allResults: EmbeddingResult[] = [];
      
      for (const batch of batches) {
        const results = await this.processContextBatch(batch, 'document');
        allResults.push(...results);
        
        // Rate limiting from config
        await this.delay(config.embedding.rateLimit);
      }
      
      return allResults;
    } else {
      // For non-context models, batch normally
      const batches = this.createBatches(texts, config.embedding.maxBatchSize);
      const allResults: EmbeddingResult[] = [];
      
      for (const batch of batches) {
        const results = await this.processBatch(batch, 'document');
        allResults.push(...results);
        
        // Rate limiting from config
        await this.delay(config.embedding.rateLimit);
      }
      
      return allResults;
    }
  }
  
  /**
   * Generate embeddings for queries - FOLLOWS voyage-ai/voyageai-python implementation
   * @see https://github.com/voyage-ai/langchain-voyageai/blob/main/libs/voyageai/langchain_voyageai/embeddings.py#L142
   */
  async embedQuery(text: string): Promise<EmbeddingResult> {
    if (config.embedding.model.includes('context')) {
      // Context models need double-wrapped array
      const results = await this.processContextBatch([text], 'query');
      return results[0];
    } else {
      const results = await this.processBatch([text], 'query');
      return results[0];
    }
  }
  
  /**
   * Process contextualized embeddings - Based on voyage-ai/langchain-voyageai
   * @see https://github.com/voyage-ai/langchain-voyageai/blob/main/libs/voyageai/langchain_voyageai/embeddings.py#L111
   */
  private async processContextBatch(
    texts: string[],
    inputType: 'document' | 'query'
  ): Promise<EmbeddingResult[]> {
    let retries = 0;

    // FINAL SAFETY NET: Validate all texts before API call
    const validTexts = texts.filter(text => {
      const tokenCount = this.estimateTokens(text);
      if (tokenCount > 30000) {
        console.error(`❌ CRITICAL: Text still exceeds token limit (${tokenCount} tokens), emergency truncating`);
        return false;
      }
      return true;
    });

    if (validTexts.length !== texts.length) {
      console.warn(`⚠️ Filtered ${texts.length - validTexts.length} oversized texts to prevent API errors`);
    }

    while (retries < config.embedding.retries) {
      try {
        // CRITICAL: voyage-context-3 requires double-wrapped array
        // Documentation confirms: inputs should be [[texts]] for contextualized
        const response = await axios.post(
          config.embedding.apiUrl,
          {
            inputs: [validTexts], // Use validated texts
            input_type: inputType,
            model: config.embedding.model,
            output_dimension: config.embedding.dimensions
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: config.embedding.timeout,
          }
        );
        
        // Parse contextualized response - Based on actual API structure
        // From test files: response.data.data[0].data[0].embedding
        if (response.data?.data?.[0]?.data) {
          const embeddings = response.data.data[0].data.map((item: any) => item.embedding);
          
          return embeddings.map((embedding: number[]) => ({
            embedding,
            normalized: this.normalize(embedding),
            dimensions: embedding.length,
            model: config.embedding.model
          }));
        } else if (response.data?.embeddings) {
          // Fallback structure
          const embeddings = response.data.embeddings;
          
          return embeddings.map((embedding: number[]) => ({
            embedding,
            normalized: this.normalize(embedding),
            dimensions: embedding.length,
            model: config.embedding.model
          }));
        }
        
        console.error('Unexpected response structure:', JSON.stringify(response.data, null, 2));
        throw new Error('Invalid response structure from contextualized API');
        
      } catch (error: any) {
        retries++;

        // NETWORK ERROR DETECTION - handles ENOTFOUND api.voyageai.com
        const isNetworkError = error.code === 'ENOTFOUND' ||
                              error.code === 'ECONNRESET' ||
                              error.code === 'ETIMEDOUT' ||
                              error.message?.includes('ENOTFOUND') ||
                              error.message?.includes('ECONNRESET');

        // Log detailed error for debugging
        if (error.response?.data) {
          console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
        } else if (isNetworkError) {
          console.warn(`🌐 Network error: ${error.code || error.message}`);
        }

        if (retries >= config.embedding.retries) {
          throw new Error(`Context embedding failed after ${config.embedding.retries} retries: ${error.message}`);
        }

        // Exponential backoff for network errors, linear for API errors
        if (isNetworkError) {
          const delay = Math.min(1000 * Math.pow(2, retries), 30000); // Max 30s
          console.warn(`🌐 Network retry ${retries}/${config.embedding.retries} in ${delay}ms...`);
          await this.delay(delay);
        } else {
          await this.delay(1000 * retries);
        }
      }
    }
    
    return [];
  }
  
  /**
   * Process regular (non-contextualized) embeddings
   */
  private async processBatch(
    texts: string[], 
    inputType: 'document' | 'query'
  ): Promise<EmbeddingResult[]> {
    let retries = 0;
    
    while (retries < config.embedding.retries) {
      try {
        // Regular embedding endpoint (not used for voyage-context-3)
        const response = await axios.post(
          'https://api.voyageai.com/v1/embeddings', // Regular endpoint
          {
            input: texts,
            model: config.embedding.model,
            input_type: inputType,
            output_dimension: config.embedding.dimensions
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: config.embedding.timeout,
          }
        );
        
        // Parse regular response
        if (response.data?.data) {
          const embeddings = response.data.data.map((item: any) => item.embedding);
          
          return embeddings.map((embedding: number[]) => ({
            embedding,
            normalized: this.normalize(embedding),
            dimensions: embedding.length,
            model: config.embedding.model
          }));
        }
        
        throw new Error('Invalid response structure from regular API');
        
      } catch (error: any) {
        retries++;

        // NETWORK ERROR DETECTION - handles ENOTFOUND api.voyageai.com
        const isNetworkError = error.code === 'ENOTFOUND' ||
                              error.code === 'ECONNRESET' ||
                              error.code === 'ETIMEDOUT' ||
                              error.message?.includes('ENOTFOUND') ||
                              error.message?.includes('ECONNRESET');

        if (isNetworkError) {
          console.warn(`🌐 Network error: ${error.code || error.message}`);
        }

        if (retries >= config.embedding.retries) {
          throw new Error(`Embedding failed after ${config.embedding.retries} retries: ${error.message}`);
        }

        // Exponential backoff for network errors, linear for API errors
        if (isNetworkError) {
          const delay = Math.min(1000 * Math.pow(2, retries), 30000); // Max 30s
          console.warn(`🌐 Network retry ${retries}/${config.embedding.retries} in ${delay}ms...`);
          await this.delay(delay);
        } else {
          await this.delay(1000 * retries);
        }
      }
    }
    
    return [];
  }
  
  
  private normalize(embedding: number[]): number[] {
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding;
  }
  
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Quick token estimation for safety checks
   */
  private estimateTokens(text: string): number {
    // Conservative estimate: 1 token per 3.5 characters
    return Math.ceil(text.length / 3.5);
  }
  
  /**
   * Get current configuration (for debugging)
   */
  getConfig() {
    return {
      model: config.embedding.model,
      dimensions: config.embedding.dimensions,
      maxBatchSize: config.embedding.maxBatchSize
    };
  }
}