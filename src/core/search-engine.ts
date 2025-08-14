/**
 * Semantic Search Engine using MongoDB Atlas Vector Search
 */

import { MongoDBClient } from './mongodb-client.js';
import { EmbeddingPipeline } from './embedding-pipeline.js';
import { QueryExpander } from './query-expander.js';
import { SearchOptions, SearchResult } from '../types/index.js';

export class SemanticSearchEngine {
  private mongodb: MongoDBClient;
  private embeddingPipeline: EmbeddingPipeline;
  private queryExpander: QueryExpander;
  private initialized = false;

  constructor() {
    this.mongodb = MongoDBClient.getInstance();
    this.embeddingPipeline = new EmbeddingPipeline();
    this.queryExpander = new QueryExpander();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.mongodb.connect();
    await this.mongodb.createVectorSearchIndex();
    this.initialized = true;
    
    console.error('✅ Search engine initialized');
  }

  /**
   * Perform semantic search using MongoDB Atlas Vector Search
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    console.error(`🔍 Searching for: "${query}"`);
    
    // Check if we have any data
    const collection = this.mongodb.getVectorsCollection();
    const count = await collection.countDocuments();
    if (count === 0) {
      console.error('⚠️ No documents in database. Run refresh first.');
      return [];
    }
    
    // Step 1: Expand query for better recall
    const expandedQueries = this.queryExpander.expandQuery(query);
    console.error(`  📝 Expanded to ${expandedQueries.length} query variations`);
    
    // Step 2: Search with all query variations
    const allResults: SearchResult[] = [];
    const seenDocIds = new Set<string>();
    
    for (const expandedQuery of expandedQueries) {
      // Embed the query using Voyage
      const queryEmbedding = await this.embeddingPipeline.embedQuery(expandedQuery);
      
      // Build MongoDB aggregation pipeline with $vectorSearch
      const pipeline = this.buildSearchPipeline(queryEmbedding, options);
      
      // Execute search
      const collection = this.mongodb.getVectorsCollection();
      const results = await collection.aggregate(pipeline).toArray() as SearchResult[];
      
      // Add unique results
      for (const result of results) {
        const docId = (result as any)._id || result.documentId;
        if (!seenDocIds.has(docId)) {
          seenDocIds.add(docId);
          allResults.push(result);
        }
      }
    }
    
    // Step 3: Sort by max score
    allResults.sort((a, b) => b.maxScore - a.maxScore);
    
    // Step 4: Limit to requested number
    const finalResults = allResults.slice(0, options.limit || 5);
    
    // Step 5: Track analytics
    await this.trackSearch(query, finalResults.length);
    
    console.error(`✅ Found ${finalResults.length} unique results`);
    return finalResults;
  }

  /**
   * Build MongoDB aggregation pipeline for vector search
   */
  private buildSearchPipeline(queryEmbedding: number[], options: SearchOptions): any[] {
    const pipeline: any[] = [];
    
    // Stage 1: Vector search with $vectorSearch
    const vectorSearchStage: any = {
      $vectorSearch: {
        index: 'semantic_search',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 200,  // Candidates to consider
        limit: 50,           // Initial results before grouping
      },
    };
    
    // Don't add filter to $vectorSearch - it doesn't support dynamic filters
    pipeline.push(vectorSearchStage);
    
    // Stage 2: Add search score
    pipeline.push({
      $addFields: {
        searchScore: { $meta: 'vectorSearchScore' },
      },
    });
    
    // Stage 3: Apply filters after vector search if provided
    if (options.filter) {
      pipeline.push({
        $match: options.filter
      });
    }
    
    // Stage 4: Group chunks by document for better context
    pipeline.push({
      $group: {
        _id: '$metadata.documentId',
        chunks: {
          $push: {
            content: '$content',
            score: '$searchScore',
            chunkIndex: '$metadata.chunkIndex',
          },
        },
        maxScore: { $max: '$searchScore' },
        metadata: { $first: '$metadata' },
      },
    });
    
    // Stage 5: Sort by best match score
    pipeline.push({
      $sort: { maxScore: -1 },
    });
    
    // Stage 6: Limit final results
    pipeline.push({
      $limit: options.limit || 5,
    });
    
    // Stage 7: Sort chunks within each document
    pipeline.push({
      $addFields: {
        chunks: {
          $sortArray: {
            input: '$chunks',
            sortBy: { score: -1 },
          },
        },
      },
    });
    
    return pipeline;
  }

  /**
   * Find documents similar to provided content
   */
  async findSimilar(content: string, limit: number = 5): Promise<any[]> {
    // Embed the content
    const embedding = await this.embeddingPipeline.embedQuery(content);
    
    // Search for similar documents
    const pipeline = [
      {
        $vectorSearch: {
          index: 'semantic_search',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: 100,
          limit: limit * 2, // Get more candidates
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $group: {
          _id: '$metadata.documentId',
          title: { $first: '$metadata.title' },
          url: { $first: '$metadata.url' },
          product: { $first: '$metadata.product' },
          score: { $max: '$score' },
        },
      },
      {
        $sort: { score: -1 },
      },
      {
        $limit: limit,
      },
    ];
    
    const collection = this.mongodb.getVectorsCollection();
    return await collection.aggregate(pipeline).toArray();
  }

  /**
   * Explain a MongoDB concept by gathering related documentation
   */
  async explainConcept(concept: string, depth: 'beginner' | 'intermediate' | 'advanced'): Promise<string> {
    // Search for all related documentation
    const results = await this.search(concept, {
      limit: 10,
    });
    
    if (results.length === 0) {
      return `No documentation found for "${concept}". Please try a different search term.`;
    }
    
    // Build explanation based on depth
    let explanation = `# MongoDB Concept: ${concept}\n\n`;
    
    if (depth === 'beginner') {
      explanation += '## Overview\n\n';
      
      // Use first result's top chunk for simple explanation
      const firstResult = results[0];
      explanation += firstResult.chunks[0].content.substring(0, 500) + '...\n\n';
      
      explanation += '## Related Topics\n\n';
      results.slice(0, 3).forEach(result => {
        explanation += `- **${result.metadata.title}**: ${result.metadata.url}\n`;
      });
      
    } else if (depth === 'intermediate') {
      explanation += '## Detailed Explanation\n\n';
      
      // Include top chunks from multiple results
      results.slice(0, 5).forEach(result => {
        explanation += `### ${result.metadata.title}\n\n`;
        explanation += result.chunks[0].content.substring(0, 400) + '...\n\n';
      });
      
    } else {
      // Advanced - include comprehensive information
      explanation += '## Comprehensive Documentation\n\n';
      
      results.forEach(result => {
        explanation += `### ${result.metadata.title}\n`;
        explanation += `*Source: ${result.metadata.product} | Score: ${result.maxScore.toFixed(3)}*\n\n`;
        
        // Include top 2 chunks
        result.chunks.slice(0, 2).forEach(chunk => {
          explanation += chunk.content + '\n\n';
        });
        
        explanation += `[Full Documentation](${result.metadata.url})\n\n---\n\n`;
      });
    }
    
    return explanation;
  }

  /**
   * Get system status and statistics
   */
  async getStatus(): Promise<any> {
    const stats = await this.mongodb.getCollectionStats();
    const collection = this.mongodb.getVectorsCollection();
    
    // Get latest document
    const latestDoc = await collection
      .findOne({}, { sort: { embeddedAt: -1 } });
    
    // Get search count for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const analyticsCollection = this.mongodb.getAnalyticsCollection();
    const searchesToday = await analyticsCollection.countDocuments({
      type: 'search',
      timestamp: { $gte: today },
    });
    
    // Get average query time
    const avgQueryTime = await analyticsCollection
      .aggregate([
        {
          $match: {
            type: 'search',
            responseTime: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$responseTime' },
          },
        },
      ])
      .toArray();
    
    return {
      totalDocuments: stats.documentCount,
      totalChunks: stats.documentCount,
      indexStatus: 'READY',
      lastUpdate: latestDoc?.embeddedAt || 'Never',
      avgQueryTime: avgQueryTime[0]?.avgTime || 0,
      searchesToday,
      dbSize: this.formatBytes(stats.storageSize),
      indexSize: this.formatBytes(stats.indexSize),
      health: stats.documentCount > 0 ? 'Healthy' : 'No data',
    };
  }

  /**
   * Track search analytics
   */
  private async trackSearch(query: string, resultCount: number): Promise<void> {
    try {
      const analyticsCollection = this.mongodb.getAnalyticsCollection();
      await analyticsCollection.insertOne({
        type: 'search',
        query,
        timestamp: new Date(),
        resultCount,
        responseTime: Date.now(),
      });
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  }
}