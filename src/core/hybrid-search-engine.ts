/**
 * Hybrid Search Engine - Combines Vector Search with Keyword Search
 * This fixes the relevance issues by using multiple retrieval strategies
 */

import { MongoDBClient } from './mongodb-client.js';
import { MongoDBQueryExpander } from './mongodb-query-expander.js';
import { SearchOptions, SearchResult } from '../types/index.js';
import axios from 'axios';

interface ScoredDocument {
  document: any;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
  source: 'vector' | 'keyword' | 'both';
}

export class HybridSearchEngine {
  private mongodb: MongoDBClient;
  private queryExpander: MongoDBQueryExpander;
  private voyageApiKey: string;
  private voyageContextualUrl = 'https://api.voyageai.com/v1/contextualizedembeddings';
  private readonly VOYAGE_DIMENSIONS = 2048;
  private initialized = false;
  
  // Scoring thresholds
  private readonly MIN_VECTOR_SCORE = 0.7;  // Reject vector results below this
  private readonly MIN_KEYWORD_SCORE = 0.3; // Minimum keyword relevance
  private readonly VECTOR_WEIGHT = 0.6;     // Weight for vector search
  private readonly KEYWORD_WEIGHT = 0.4;    // Weight for keyword search
  
  constructor() {
    this.mongodb = MongoDBClient.getInstance();
    this.queryExpander = new MongoDBQueryExpander();
    this.voyageApiKey = process.env.VOYAGE_API_KEY!;
    if (!this.voyageApiKey) {
      throw new Error('VOYAGE_API_KEY environment variable is required');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.mongodb.connect();
    await this.mongodb.createVectorSearchIndex();
    this.initialized = true;
    
    console.error('✅ Hybrid Search Engine initialized');
  }

  /**
   * Perform hybrid search combining vector and keyword strategies
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    console.error(`🚀 MONGODB-OPTIMIZED Search: "${query}"`);
    
    const collection = this.mongodb.getVectorsCollection();
    const count = await collection.countDocuments();
    
    if (count === 0) {
      console.error('⚠️ No documents in database. Run indexer first!');
      return [];
    }
    
    console.error(`📊 Searching ${count} docs with MongoDB intelligence...`);
    
    // 🧠 MongoDB-specific query understanding
    const mongoIntent = this.detectMongoDBIntent(query);
    console.error(`🧠 Intent: ${mongoIntent.type} (${mongoIntent.confidence.toFixed(2)} confidence)`);
    
    // 🔍 Enhanced query expansion with MongoDB context
    const expandedQueries = this.queryExpander.expandQuery(query);
    console.error(`🔍 Expanded to ${expandedQueries.length} MongoDB-aware variations`);
    
    // Run both search strategies in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, expandedQueries, options),
      this.keywordSearch(query, expandedQueries, options)
    ]);
    
    console.error(`  🔢 Vector results: ${vectorResults.length}, Keyword results: ${keywordResults.length}`);
    
    // Merge and re-rank results
    const mergedResults = this.mergeResults(vectorResults, keywordResults);
    
    // Apply score threshold
    const filteredResults = mergedResults.filter(r => r.hybridScore >= this.MIN_VECTOR_SCORE);
    
    // Re-rank using Voyage AI if available
    const rerankedResults = await this.rerankResults(query, filteredResults);
    
    // Format final results
    const finalResults = this.formatResults(rerankedResults, options.limit || 5);
    
    console.error(`✅ Found ${finalResults.length} relevant results`);
    
    // If no results, provide suggestions
    if (finalResults.length === 0) {
      const suggestions = this.queryExpander.generateSuggestions(query);
      console.error('💡 Suggestions:', suggestions.join('\n  '));
    }
    
    return finalResults;
  }

  /**
   * MongoDB-specific intent detection (our SECRET WEAPON!)
   */
  private detectMongoDBIntent(query: string): { type: string; confidence: number; components: string[]; language?: string } {
    const queryLower = query.toLowerCase();
    
    // MongoDB operation patterns
    const patterns = {
      crud: ['insert', 'find', 'update', 'delete', 'replace', 'upsert', 'insertone', 'updateone'],
      aggregation: ['aggregate', 'pipeline', '$match', '$group', '$project', '$sort', '$lookup', '$unwind'],
      vectorSearch: ['vector search', '$vectorsearch', 'embedding', 'similarity', 'cosine', 'semantic'],
      indexing: ['index', 'createindex', 'compound', 'text index', 'performance'],
      troubleshooting: ['error', 'problem', 'fix', 'timeout', 'connection', 'slow'],
      drivers: {
        nodejs: ['node', 'javascript', 'mongoose', 'async', 'await'],
        python: ['python', 'pymongo', 'motor'],
        java: ['java', 'spring'],
        csharp: ['c#', '.net'],
        go: ['golang', 'go'],
        php: ['php', 'laravel'],
        ruby: ['ruby']
      }
    };
    
    let intent = { type: 'general', confidence: 0.5, components: [] as string[], language: undefined as string | undefined };
    
    // Detect primary intent
    if (patterns.vectorSearch.some(p => queryLower.includes(p))) {
      intent = { type: 'vector_search', confidence: 0.9, components: ['vector-search'], language: undefined };
    } else if (patterns.aggregation.some(p => queryLower.includes(p))) {
      intent = { type: 'aggregation', confidence: 0.8, components: ['aggregation'], language: undefined };
    } else if (patterns.crud.some(p => queryLower.includes(p))) {
      intent = { type: 'crud', confidence: 0.8, components: ['crud'], language: undefined };
    } else if (patterns.indexing.some(p => queryLower.includes(p))) {
      intent = { type: 'indexing', confidence: 0.7, components: ['indexing'], language: undefined };
    } else if (patterns.troubleshooting.some(p => queryLower.includes(p))) {
      intent = { type: 'troubleshooting', confidence: 0.7, components: ['troubleshooting'], language: undefined };
    }
    
    // Detect programming language
    for (const [lang, indicators] of Object.entries(patterns.drivers)) {
      if (indicators.some(indicator => queryLower.includes(indicator))) {
        intent.language = lang;
        intent.confidence += 0.1;
        break;
      }
    }
    
    return intent;
  }

  /**
   * Vector search using embeddings
   */
  private async vectorSearch(
    _query: string, 
    expandedQueries: string[], 
    options: SearchOptions
  ): Promise<ScoredDocument[]> {
    const results: ScoredDocument[] = [];
    
    try {
      // Generate embeddings for all query variations
      const embeddings = await this.generateQueryEmbeddings(expandedQueries);
      
      const collection = this.mongodb.getVectorsCollection();
      
      // Search with each embedding
      for (let i = 0; i < embeddings.length; i++) {
        const embedding = embeddings[i];
        const queryText = expandedQueries[i];
        
        // CRITICAL FIX: Normalize the query embedding for dot product similarity!
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        const normalizedEmbedding = embedding.map(val => val / magnitude);
        
        const pipeline = [
          {
            $vectorSearch: {
              index: 'semantic_search',
              path: 'embedding',
              queryVector: normalizedEmbedding,  // USE NORMALIZED!
              numCandidates: 150,  // Increased for better recall
              limit: 20  // Get more candidates for re-ranking
            }
          },
          {
            $addFields: {
              searchScore: { $meta: 'vectorSearchScore' },
              queryUsed: queryText
            }
          }
        ];
        
        // Add filters if provided
        if (options.filter) {
          pipeline.push({ $match: options.filter } as any);
        }
        
        const docs = await collection.aggregate(pipeline).toArray();
        
        docs.forEach((doc, index) => {
          // CRITICAL FIX: Normalize vector scores and add diversity penalty
          const baseScore = doc.searchScore || 0;
          const diversityPenalty = index * 0.01; // Slight penalty for lower-ranked results
          const normalizedScore = Math.max(0, Math.min(1, baseScore - diversityPenalty));
          
          results.push({
            document: doc,
            vectorScore: normalizedScore,
            keywordScore: 0,
            hybridScore: normalizedScore,
            source: 'vector'
          });
        });
      }
    } catch (error) {
      console.error('Vector search error:', error);
    }
    
    return results;
  }

  /**
   * Keyword search using MongoDB text search and regex
   */
  private async keywordSearch(
    query: string,
    expandedQueries: string[],
    options: SearchOptions
  ): Promise<ScoredDocument[]> {
    const results: ScoredDocument[] = [];
    
    try {
      const collection = this.mongodb.getVectorsCollection();
      
      // Build keyword search queries
      const keywordQueries = this.buildKeywordQueries(query, expandedQueries);
      
      for (const kQuery of keywordQueries) {
        const pipeline = [
          {
            $match: {
              $or: [
                { content: { $regex: kQuery.regex, $options: 'i' } },
                { 'title': { $regex: kQuery.regex, $options: 'i' } },
                { 'metadata.path': { $regex: kQuery.regex, $options: 'i' } }
              ]
            }
          },
          {
            $addFields: {
              keywordScore: this.calculateKeywordScore(kQuery.terms)
            }
          },
          {
            $limit: 20
          }
        ];
        
        // Add filters if provided
        if (options.filter) {
          const matchStage = { $match: options.filter };
          pipeline.push(matchStage);
        }
        
        const docs = await collection.aggregate(pipeline).toArray();
        
        docs.forEach(doc => {
          results.push({
            document: doc,
            vectorScore: 0,
            keywordScore: doc.keywordScore || 0.5,
            hybridScore: doc.keywordScore || 0.5,
            source: 'keyword'
          });
        });
      }
    } catch (error) {
      console.error('Keyword search error:', error);
    }
    
    return results;
  }

  /**
   * Merge vector and keyword results with product diversity
   */
  private mergeResults(
    vectorResults: ScoredDocument[],
    keywordResults: ScoredDocument[]
  ): ScoredDocument[] {
    const merged = new Map<string, ScoredDocument>();
    const productCounts = new Map<string, number>();
    
    // Add vector results with product diversity tracking
    vectorResults.forEach(result => {
      const id = result.document._id.toString();
      const product = result.document.product || 'unknown';
      
      // Apply diversity boost for underrepresented products
      const currentCount = productCounts.get(product) || 0;
      const diversityBoost = Math.max(0, (5 - currentCount) * 0.05); // Boost less common products
      
      result.hybridScore += diversityBoost;
      productCounts.set(product, currentCount + 1);
      
      merged.set(id, result);
    });
    
    // Merge keyword results
    keywordResults.forEach(result => {
      const id = result.document._id.toString();
      
      if (merged.has(id)) {
        // Document found in both - calculate hybrid score
        const existing = merged.get(id)!;
        existing.keywordScore = result.keywordScore;
        existing.hybridScore = this.calculateHybridScore(
          existing.vectorScore,
          result.keywordScore
        );
        existing.source = 'both';
      } else {
        // Only in keyword results
        merged.set(id, result);
      }
    });
    
    // Sort by hybrid score
    return Array.from(merged.values())
      .sort((a, b) => b.hybridScore - a.hybridScore);
  }

  /**
   * Re-rank results using Voyage AI reranker
   */
  private async rerankResults(
    query: string,
    results: ScoredDocument[]
  ): Promise<ScoredDocument[]> {
    if (results.length === 0) return results;
    
    try {
      // Prepare documents for reranking
      const documents = results.map(r => 
        r.document.content?.substring(0, 1000) || '' // Use first 1000 chars
      );
      
      // Call Voyage reranker with latest 2025 model
      const response = await axios.post(
        'https://api.voyageai.com/v1/rerank',
        {
          query,
          documents,
          model: 'rerank-2.5', // 2025: Latest cross-encoder model
          top_k: Math.min(results.length, 20)
        },
        {
          headers: {
            'Authorization': `Bearer ${this.voyageApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      
      // Update scores based on reranking
      if (response.data?.data) {
        response.data.data.forEach((item: any, index: number) => {
          // CRITICAL FIX: Voyage API returns nested structure with relevanceScore
          const score = item.relevanceScore || item.score;
          const resultIndex = item.index !== undefined ? item.index : index;
          
          if (resultIndex < results.length && score !== undefined) {
            // Use reranking score as primary, with original as fallback
            const rerankWeight = 0.7;
            const originalWeight = 0.3;
            results[resultIndex].hybridScore = 
              (score * rerankWeight) + (results[resultIndex].hybridScore * originalWeight);
          }
        });
      }
      
      // Re-sort by new scores
      results.sort((a, b) => b.hybridScore - a.hybridScore);
      
    } catch (error) {
      console.error('Reranking failed (using original scores):', error);
    }
    
    return results;
  }

  /**
   * Generate embeddings for query variations
   */
  private async generateQueryEmbeddings(queries: string[]): Promise<number[][]> {
    try {
      // Use the contextualized embeddings endpoint for queries
      const response = await axios.post(
        this.voyageContextualUrl,
        {
          inputs: queries.map(q => [q]), // Each query wrapped in array
          input_type: 'query', // Critical: asymmetric embeddings for query-document matching
          model: 'voyage-context-3',
          output_dimension: this.VOYAGE_DIMENSIONS
        },
        {
          headers: {
            'Authorization': `Bearer ${this.voyageApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      
      if (!response.data?.data) {
        console.error('No data returned from Voyage API');
        return [];
      }
      
      // Extract and normalize embeddings
      const normalizedEmbeddings: number[][] = [];
      
      for (const queryResult of response.data.data) {
        if (queryResult?.data?.[0]?.embedding) {
          const embedding = queryResult.data[0].embedding;
          const magnitude = Math.sqrt(
            embedding.reduce((sum: number, val: number) => sum + val * val, 0)
          );
          const normalized = embedding.map((v: number) => v / magnitude);
          normalizedEmbeddings.push(normalized);
        }
      }
      
      return normalizedEmbeddings;
    } catch (error: any) {
      console.error('Embedding generation failed:', error.response?.data || error);
      return [];
    }
  }

  /**
   * Build keyword search queries
   */
  private buildKeywordQueries(query: string, expandedQueries: string[]) {
    const queries = [];
    
    // Original query terms
    const terms = query.toLowerCase().split(/\s+/);
    queries.push({
      regex: terms.join('|'),
      terms
    });
    
    // Expanded query terms (top 3)
    expandedQueries.slice(0, 3).forEach(eq => {
      const eqTerms = eq.toLowerCase().split(/\s+/);
      queries.push({
        regex: eqTerms.join('|'),
        terms: eqTerms
      });
    });
    
    return queries;
  }

  /**
   * Calculate keyword relevance score
   */
  private calculateKeywordScore(terms: string[]): number {
    // Simple TF-IDF style scoring
    const baseScore = 0.5;
    const termBoost = 0.1;
    return Math.min(1.0, baseScore + (terms.length * termBoost));
  }

  /**
   * Calculate hybrid score combining vector and keyword scores
   */
  private calculateHybridScore(vectorScore: number, keywordScore: number): number {
    return (vectorScore * this.VECTOR_WEIGHT) + (keywordScore * this.KEYWORD_WEIGHT);
  }

  /**
   * Format results for output with "Lost in the Middle" mitigation (2025 best practice)
   */
  private formatResults(results: ScoredDocument[], limit: number): SearchResult[] {
    const formatted: SearchResult[] = [];
    const seen = new Set<string>();
    
    for (const result of results) {
      if (formatted.length >= limit) break;
      
      const docId = result.document.documentId;
      if (seen.has(docId)) continue;
      seen.add(docId);
      
      // Group chunks by document
      const relatedChunks = results
        .filter(r => r.document.documentId === docId)
        .map(r => ({
          content: r.document.content,
          score: r.hybridScore,
          metadata: r.document.metadata
        }))
        .sort((a, b) => b.score - a.score); // Sort by score
      
      // 2025: Apply "Lost in the Middle" mitigation
      // Place most relevant chunks at beginning and end
      const reorderedChunks = this.reorderChunksForLLM(relatedChunks);
      
      formatted.push({
        documentId: docId,
        chunks: reorderedChunks.slice(0, 3).map((chunk, idx) => ({
          ...chunk,
          chunkIndex: idx
        })) as any, // Top 3 chunks with index
        metadata: result.document.metadata,
        maxScore: result.hybridScore,
        source: result.source
      } as any);
    }
    
    return formatted;
  }

  /**
   * Reorder chunks to mitigate "Lost in the Middle" problem (2025 best practice)
   * LLMs have U-shaped attention - best recall at beginning and end
   */
  private reorderChunksForLLM(chunks: any[]): any[] {
    if (chunks.length <= 2) return chunks;
    
    const reordered: any[] = [];
    const sorted = [...chunks].sort((a, b) => b.score - a.score);
    
    // Place most relevant at beginning
    reordered.push(sorted[0]);
    
    // Place second most relevant at end
    if (sorted.length > 1) {
      const secondBest = sorted[1];
      sorted.splice(1, 1);
      
      // Fill middle with remaining chunks
      for (let i = 2; i < sorted.length; i++) {
        reordered.push(sorted[i]);
      }
      
      // Add second best at the end
      reordered.push(secondBest);
    }
    
    return reordered;
  }

  /**
   * Find similar documents to provided content
   */
  async findSimilar(content: string, limit: number = 5): Promise<any[]> {
    // Generate embedding for the content
    const embedding = await this.generateQueryEmbeddings([content]);
    
    if (embedding.length === 0) {
      return [];
    }
    
    // Use vector search to find similar
    const results = await this.vectorSearch(content, [content], { limit });
    
    return results.slice(0, limit).map(r => ({
      title: r.document.title || r.document.metadata?.title || 'Untitled',
      url: r.document.metadata?.url || '',
      score: r.vectorScore,
      content: r.document.content?.substring(0, 200) || ''
    }));
  }

  /**
   * Explain a concept using the documentation
   */
  async explainConcept(concept: string, depth: string = 'intermediate'): Promise<string> {
    // Search for the concept
    const results = await this.search(concept, { limit: 5 });
    
    if (results.length === 0) {
      return `No documentation found for "${concept}". Try a different search term.`;
    }
    
    // Format explanation based on depth
    let explanation = `# ${concept}\n\n`;
    
    if (depth === 'beginner') {
      explanation += '## Simple Explanation\n\n';
      explanation += results[0].chunks[0]?.content.substring(0, 500) || '';
    } else if (depth === 'advanced') {
      explanation += '## Detailed Explanation\n\n';
      results.forEach(result => {
        explanation += `### ${result.metadata?.title || 'Document'}\n`;
        result.chunks.forEach(chunk => {
          explanation += chunk.content + '\n\n';
        });
      });
    } else {
      // intermediate
      explanation += '## Overview\n\n';
      explanation += results[0].chunks[0]?.content || '';
      explanation += '\n\n## Related Documentation\n\n';
      results.slice(1, 3).forEach(result => {
        explanation += `- [${result.metadata?.title || 'Document'}](${result.metadata?.url || '#'})\n`;
      });
    }
    
    return explanation;
  }

  /**
   * Get search engine status
   */
  async getStatus(): Promise<any> {
    const collection = this.mongodb.getVectorsCollection();
    const count = await collection.countDocuments();
    
    // Get sample of products and versions
    const products = await collection.distinct('metadata.product');
    const versions = await collection.distinct('metadata.version');
    
    return {
      totalDocuments: count,
      products,
      versions,
      searchEngine: 'Hybrid (Vector + Keyword)',
      vectorModel: 'voyage-context-3',
      rerankerModel: 'rerank-2.5',
      minVectorScore: this.MIN_VECTOR_SCORE,
      minKeywordScore: this.MIN_KEYWORD_SCORE,
      weights: {
        vector: this.VECTOR_WEIGHT,
        keyword: this.KEYWORD_WEIGHT
      }
    };
  }
}