/**
 * Hybrid Search Engine - Combines Vector Search with Keyword Search
 * This fixes the relevance issues by using multiple retrieval strategies
 */

import { MongoDBClient } from './mongodb-client.js';
import { MongoDBQueryExpander } from './mongodb-query-expander.js';
import { SearchOptions, SearchResult } from '../types/index.js';
import { VoyageAIClient } from 'voyageai';

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
  private voyageClient: VoyageAIClient;
  private initialized = false;
  
  // Scoring thresholds
  private readonly MIN_VECTOR_SCORE = 0.7;  // Reject vector results below this
  private readonly MIN_KEYWORD_SCORE = 0.3; // Minimum keyword relevance
  private readonly VECTOR_WEIGHT = 0.6;     // Weight for vector search
  private readonly KEYWORD_WEIGHT = 0.4;    // Weight for keyword search
  
  constructor() {
    this.mongodb = MongoDBClient.getInstance();
    this.queryExpander = new MongoDBQueryExpander();
    this.voyageClient = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY!
    });
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
    console.error(`🔍 Hybrid Search for: "${query}"`);
    
    const collection = this.mongodb.getVectorsCollection();
    const count = await collection.countDocuments();
    
    if (count === 0) {
      console.error('⚠️ No documents in database. Run mega-refresh first!');
      return [];
    }
    
    console.error(`  📊 Searching ${count} documents...`);
    
    // Expand query for better coverage
    const expandedQueries = this.queryExpander.expandQuery(query);
    console.error(`  📝 Expanded to ${expandedQueries.length} query variations`);
    
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
              index: 'vector_index',
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
        
        docs.forEach(doc => {
          results.push({
            document: doc,
            vectorScore: doc.searchScore || 0,
            keywordScore: 0,
            hybridScore: doc.searchScore || 0,
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
   * Merge vector and keyword results
   */
  private mergeResults(
    vectorResults: ScoredDocument[],
    keywordResults: ScoredDocument[]
  ): ScoredDocument[] {
    const merged = new Map<string, ScoredDocument>();
    
    // Add vector results
    vectorResults.forEach(result => {
      const id = result.document._id.toString();
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
      
      // Call Voyage reranker
      const response = await this.voyageClient.rerank({
        query,
        documents,
        model: 'rerank-2',
        topK: Math.min(results.length, 20)
      });
      
      // Update scores based on reranking
      if (response.data) {
        response.data.forEach((item: any) => {
          // CRITICAL FIX: Voyage API returns 'relevanceScore' not 'relevance_score'!
          const score = item.relevanceScore;
          if (item.index < results.length && score !== undefined) {
            results[item.index].hybridScore = 
              (results[item.index].hybridScore + score) / 2;
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
      const response = await this.voyageClient.embed({
        input: queries,
        model: 'voyage-3',
        inputType: 'query'
      });
      
      const embeddings = response.data?.map(d => d.embedding) || [];
      // Ensure we always return number[][], filtering out undefined
      return embeddings.filter((e): e is number[] => e !== undefined);
    } catch (error) {
      console.error('Embedding generation failed:', error);
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
   * Format results for output
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
        }));
      
      formatted.push({
        documentId: docId,
        chunks: relatedChunks.slice(0, 3).map((chunk, idx) => ({
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
      vectorModel: 'voyage-3',
      rerankerModel: 'rerank-2',
      minVectorScore: this.MIN_VECTOR_SCORE,
      minKeywordScore: this.MIN_KEYWORD_SCORE,
      weights: {
        vector: this.VECTOR_WEIGHT,
        keyword: this.KEYWORD_WEIGHT
      }
    };
  }
}