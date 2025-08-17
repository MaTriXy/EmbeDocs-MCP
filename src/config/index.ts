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
    maxBatchSize: 32,
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
    batchSize: 16,
    rateLimit: 100 // ms between API calls
  },
  
  // Search Configuration
  search: {
    reranker: 'rerank-2.5',
    minVectorScore: 0.7,
    minKeywordScore: 0.3,
    vectorWeight: 0.6,
    keywordWeight: 0.4,
    maxResults: 20,
    numCandidates: 300
  },
  
  // Repository Configuration
  repositories: [
    {
      name: 'MongoDB Documentation',
      repo: 'mongodb/docs',
      branch: 'master',
      product: 'complete',
      version: '8.2',
      priority: 5
    }
  ]
} as const;

// Type exports for clean interfaces
export type EmbeddingConfig = typeof config.embedding;
export type StorageConfig = typeof config.storage;
export type IndexingConfig = typeof config.indexing;
export type SearchConfig = typeof config.search;