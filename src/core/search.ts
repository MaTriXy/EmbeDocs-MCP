/**
 * SINGLE Search Service - Implements MongoDB Atlas Vector Search + Hybrid Search
 * Based on official MongoDB documentation
 * @see https://github.com/mongodb/mongo/blob/master/src/mongo/db/pipeline/document_source_rank_fusion.h
 */

import { config } from '../config/index.js';
import { EmbeddingService } from './embeddings.js';
import { StorageService } from './storage.js';
import axios from 'axios';

export interface SearchResult {
  documentId: string;
  content: string;
  score: number;
  title?: string;
  product?: string;
  metadata?: Record<string, any>;
}

export class SearchService {
  private static instance: SearchService;
  private embeddingService: EmbeddingService;
  private storageService: StorageService;
  private voyageApiKey: string;
  
  private constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    this.storageService = StorageService.getInstance();
    this.voyageApiKey = process.env.VOYAGE_API_KEY!;
  }
  
  static getInstance(): SearchService {
    if (!this.instance) {
      this.instance = new SearchService();
    }
    return this.instance;
  }
  
  /**
   * Hybrid Search using Reciprocal Rank Fusion (RRF) algorithm
   * NOTE: We implement RRF manually since $rankFusion is not yet available in MongoDB 8.0
   * This follows the same algorithm that MongoDB will use when $rankFusion becomes available
   * @see https://github.com/JohnGUnderwood/atlas-hybrid-search for reference implementation
   */
  async hybridSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    await this.storageService.connect();
    
    // Generate query embedding
    const embeddingResult = await this.embeddingService.embedQuery(query);
    
    // Parallel search: Vector + Keyword
    const [vectorResults, keywordResults] = await Promise.all([
      this.storageService.vectorSearch(embeddingResult.normalized, limit * 2),
      this.storageService.keywordSearch(query, limit * 2)
    ]);
    
    // Apply Reciprocal Rank Fusion (RRF)
    const fusedResults = this.reciprocalRankFusion(
      vectorResults,
      keywordResults,
      config.search.vectorWeight,
      config.search.keywordWeight
    );
    
    // Rerank if we have enough results
    if (fusedResults.length > 3) {
      return this.rerankResults(query, fusedResults, limit);
    }
    
    return fusedResults.slice(0, limit);
  }
  
  /**
   * Pure Vector Search using MongoDB Atlas $vectorSearch
   * @see https://github.com/mongodb/laravel-mongodb/blob/master/src/Query/Builder.php
   */
  async vectorSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    await this.storageService.connect();
    
    // Generate query embedding
    const embeddingResult = await this.embeddingService.embedQuery(query);
    
    // Perform vector search
    const results = await this.storageService.vectorSearch(
      embeddingResult.normalized,
      limit
    );
    
    // Map to SearchResult
    return results.map(doc => ({
      documentId: doc.documentId,
      content: doc.content,
      score: (doc as any).searchScore || 0,
      title: doc.title,
      product: doc.product,
      metadata: doc.metadata
    }));
  }

  /**
   * MMR Vector Search - Maximum Marginal Relevance
   * Balances relevance and diversity for superior results
   * Based on Harry-231's approach: +21.2% retrieval accuracy improvement
   * 
   * @param query - Search query string
   * @param options - MMR configuration options
   */
  async mmrVectorSearch(
    query: string, 
    options: {
      limit?: number;
      fetchK?: number;
      lambdaMult?: number;
      filter?: any;
    } = {}
  ): Promise<SearchResult[]> {
    await this.storageService.connect();
    
    // Use config defaults if not provided
    const mmrOptions = {
      limit: options.limit || config.search.mmr.defaultLimit,
      fetchK: options.fetchK || config.search.mmr.fetchK,
      lambdaMult: options.lambdaMult || config.search.mmr.lambdaMult,
      filter: options.filter
    };
    
    // Generate query embedding
    const embeddingResult = await this.embeddingService.embedQuery(query);
    
    // Perform MMR vector search
    const results = await this.storageService.vectorSearchMMR(
      embeddingResult.normalized,
      mmrOptions
    );
    
    // Map to SearchResult
    return results.map(doc => ({
      documentId: doc.documentId,
      content: doc.content,
      score: (doc as any).searchScore || 0,
      title: doc.title,
      product: doc.product,
      metadata: doc.metadata
    }));
  }
  
  /**
   * Reciprocal Rank Fusion (RRF) - Standard hybrid search algorithm
   * Implements the same algorithm that MongoDB $rankFusion will use (not yet available in 8.0)
   * Formula: score = Σ(weight / (k + rank_i))
   * k=60 is the standard constant from RRF research papers
   */
  private reciprocalRankFusion(
    vectorResults: any[],
    keywordResults: any[],
    vectorWeight: number,
    keywordWeight: number
  ): SearchResult[] {
    const k = 60; // Standard RRF constant from research
    const fusedScores = new Map<string, { doc: any; score: number }>();
    
    // Process vector results
    vectorResults.forEach((doc, rank) => {
      const id = doc.documentId;
      const rrfScore = vectorWeight / (k + rank + 1);
      
      if (fusedScores.has(id)) {
        fusedScores.get(id)!.score += rrfScore;
      } else {
        fusedScores.set(id, { doc, score: rrfScore });
      }
    });
    
    // Process keyword results
    keywordResults.forEach((doc, rank) => {
      const id = doc.documentId;
      const rrfScore = keywordWeight / (k + rank + 1);
      
      if (fusedScores.has(id)) {
        fusedScores.get(id)!.score += rrfScore;
      } else {
        fusedScores.set(id, { doc, score: rrfScore });
      }
    });
    
    // Sort by fused score
    const sorted = Array.from(fusedScores.values())
      .sort((a, b) => b.score - a.score);
    
    // Map to SearchResult
    return sorted.map(item => ({
      documentId: item.doc.documentId,
      content: item.doc.content,
      score: item.score,
      title: item.doc.title,
      product: item.doc.product,
      metadata: item.doc.metadata
    }));
  }
  
  /**
   * Rerank results using Voyage AI Reranker
   * Using latest rerank-2.5 model (2025)
   * @see voyage-ai documentation
   */
  private async rerankResults(
    query: string,
    results: SearchResult[],
    limit: number
  ): Promise<SearchResult[]> {
    if (!this.voyageApiKey) {
      return results.slice(0, limit);
    }
    
    try {
      const documents = results.map(r => r.content.substring(0, 1000));
      
      const response = await axios.post(
        'https://api.voyageai.com/v1/rerank',
        {
          query,
          documents,
          model: config.search.reranker,
          top_k: Math.min(results.length, limit)
        },
        {
          headers: {
            'Authorization': `Bearer ${this.voyageApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      
      if (response.data?.data) {
        // Reorder based on reranking scores
        const reranked: SearchResult[] = [];
        
        response.data.data.forEach((item: any) => {
          const idx = item.index;
          if (idx < results.length) {
            reranked.push({
              ...results[idx],
              score: item.relevanceScore || item.score || results[idx].score
            });
          }
        });
        
        return reranked;
      }
    } catch (error: any) {
      // NETWORK ERROR DETECTION
      const isNetworkError = error.code === 'ENOTFOUND' ||
                            error.code === 'ECONNRESET' ||
                            error.code === 'ETIMEDOUT' ||
                            error.message?.includes('ENOTFOUND');

      if (isNetworkError) {
        console.warn('🌐 Reranking network error, using original order:', error.code || error.message);
      } else {
        console.warn('Reranking failed, using original order:', error.message);
      }
    }
    
    return results.slice(0, limit);
  }
  
  /**
   * Get search statistics
   */
  async getStats() {
    return {
      embeddingConfig: this.embeddingService.getConfig(),
      searchConfig: {
        reranker: config.search.reranker,
        minVectorScore: config.search.minVectorScore,
        vectorWeight: config.search.vectorWeight,
        keywordWeight: config.search.keywordWeight,
        mmr: config.search.mmr
      }
    };
  }
}