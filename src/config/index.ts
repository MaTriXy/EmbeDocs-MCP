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
  
  // Repository Configuration - OPTIMIZED FOR PRODUCTION v10.0.0
  // No redundancy - each repo has unique, valuable content
  repositories: [
    {
      name: 'MongoDB Official Documentation (Core)',
      repo: 'mongodb/docs',
      branch: 'master',
      product: 'docs',
      version: '8.2',
      priority: 10  // Essential: Complete MongoDB documentation
    },
    {
      name: 'GenAI Showcase (3.9k⭐ - Best AI/RAG Examples)',
      repo: 'mongodb-developer/GenAI-Showcase',
      branch: 'main',
      product: 'genai',
      version: 'latest',
      priority: 9  // Critical: Most comprehensive AI/Vector Search examples
    },
    {
      name: 'MongoDB Chatbot (Official RAG Implementation)',
      repo: 'mongodb/chatbot',
      branch: 'main',
      product: 'rag',
      version: 'latest',
      priority: 8  // Important: Production RAG with Atlas Vector Search
    },
    {
      name: 'Vector Search Notebooks (Tutorials)',
      repo: 'mongodb/docs-notebooks',
      branch: 'main',
      product: 'tutorials',
      version: 'latest',
      priority: 7  // Valuable: Step-by-step Vector Search tutorials
    },
    {
      name: 'Multimodal AI Agents Lab',
      repo: 'mongodb-developer/multimodal-agents-lab',
      branch: 'main',
      product: 'agents',
      version: 'latest',
      priority: 6  // Cutting-edge: Multimodal AI with MongoDB + LangGraph
    }
  ]
} as const;

// Type exports for clean interfaces
export type EmbeddingConfig = typeof config.embedding;
export type StorageConfig = typeof config.storage;
export type IndexingConfig = typeof config.indexing;
export type SearchConfig = typeof config.search;