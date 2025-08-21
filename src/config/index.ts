/**
 * SINGLE SOURCE OF TRUTH - All configuration in ONE place
 * No more scattered hardcoded values!
 */

export const config = {
  // Model Configuration
  embedding: {
    provider: 'voyage',
    model: 'voyage-context-3',
    dimensions: 1024,
    apiUrl: 'https://api.voyageai.com/v1/contextualizedembeddings',
    maxBatchSize: 8, // Reduced to prevent token limit errors
    maxTokens: 8000,
    timeout: 60000,
    retries: 3,
    rateLimit: 100 // ms between API calls
  },
  
  // MongoDB Configuration
  storage: {
    database: 'mongodb_semantic_docs',
    collection: 'documents',
    vectorIndexName: 'semantic_search',
    maxPoolSize: 10,
    minPoolSize: 2
  },
  
  // Indexing Configuration
  indexing: {
    chunkSize: 1500, // Reduced to avoid token limits with voyage-context-3
    chunkOverlap: 150,
    maxParallelDocs: 100,
    batchSize: 8, // Reduced to prevent EPIPE errors
    rateLimit: 100 // ms between API calls
  },
  
  // Search Configuration - OPTIMIZED with MongoDB Dev's proven parameters
  search: {
    reranker: 'rerank-2.5',
    minVectorScore: 0.7,
    minKeywordScore: 0.3,
    vectorWeight: 0.6,
    keywordWeight: 0.4,
    maxResults: 20,
    numCandidates: 40,     // OPTIMIZED: MongoDB Dev's proven 40 (vs 300) = 7.5x faster!
    // MMR Configuration - inspired by Harry-231's approach
    mmr: {
      fetchK: 20,        // More candidates to consider for diversity
      lambdaMult: 0.7,   // Balance: 0.7 relevance, 0.3 diversity
      defaultLimit: 5    // OPTIMIZED: MongoDB Dev's proven limit (vs 10)
    }
  },
  
  // Repository Configuration
  // REMOVED: Hardcoded repositories are no longer used
  // The system now ONLY uses repositories explicitly added by users via:
  // 1. Web UI (npm run web)
  // 2. Manual editing of .repos/metadata.json
  // This ensures users have full control over what gets indexed
  repositories: []  // Empty - all repos come from .repos/metadata.json
} as const;

// Type exports for clean interfaces
export type EmbeddingConfig = typeof config.embedding;
export type StorageConfig = typeof config.storage;
export type IndexingConfig = typeof config.indexing;
export type SearchConfig = typeof config.search;