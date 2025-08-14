/**
 * Simple Query Expansion for MongoDB Semantic MCP
 * Expands common MongoDB terms to improve search recall
 */

export class QueryExpander {
  // MongoDB-specific term expansions
  private expansions: Record<string, string[]> = {
    // Indexing terms
    'index': ['index', 'indexes', 'indexing', 'createIndex', 'ensureIndex', 'indices'],
    'indexes': ['index', 'indexes', 'indexing', 'createIndex', 'indices'],
    'indexing': ['index', 'indexes', 'indexing', 'createIndex', 'performance'],
    
    // Aggregation terms
    'aggregate': ['aggregate', 'aggregation', 'pipeline', '$group', '$match'],
    'aggregation': ['aggregate', 'aggregation', 'pipeline', '$group', '$match'],
    'pipeline': ['pipeline', 'aggregation', 'aggregate', 'stages'],
    
    // Replication terms
    'replica': ['replica', 'replication', 'replica set', 'replset', 'secondary'],
    'replication': ['replication', 'replica', 'replica set', 'replset', 'oplog'],
    'replset': ['replica set', 'replication', 'replica', 'replset'],
    
    // Sharding terms
    'shard': ['shard', 'sharding', 'sharded', 'chunks', 'balancer'],
    'sharding': ['sharding', 'shard', 'sharded', 'distribution', 'horizontal scaling'],
    
    // Query terms
    'query': ['query', 'find', 'findOne', 'search', 'filter'],
    'find': ['find', 'findOne', 'query', 'search', 'retrieve'],
    'search': ['search', 'find', 'query', 'text search', '$text'],
    
    // CRUD operations
    'insert': ['insert', 'insertOne', 'insertMany', 'create', 'add'],
    'update': ['update', 'updateOne', 'updateMany', 'modify', '$set'],
    'delete': ['delete', 'deleteOne', 'deleteMany', 'remove', 'drop'],
    'crud': ['crud', 'create', 'read', 'update', 'delete', 'operations'],
    
    // Performance terms
    'performance': ['performance', 'optimization', 'speed', 'latency', 'throughput'],
    'optimize': ['optimize', 'optimization', 'performance', 'tuning', 'improve'],
    'slow': ['slow', 'performance', 'latency', 'timeout', 'long running'],
    
    // Atlas terms
    'atlas': ['atlas', 'cloud', 'managed', 'cluster', 'deployment'],
    'cluster': ['cluster', 'deployment', 'replica set', 'sharded cluster'],
    
    // Connection terms
    'connect': ['connect', 'connection', 'connection string', 'uri', 'driver'],
    'connection': ['connection', 'connect', 'connection string', 'pool', 'client'],
    
    // Schema terms
    'schema': ['schema', 'validation', 'structure', 'model', 'design'],
    'validation': ['validation', 'schema', 'validator', 'jsonSchema', 'rules'],
    
    // Transaction terms
    'transaction': ['transaction', 'transactions', 'ACID', 'atomicity', 'commit'],
    'transactions': ['transactions', 'transaction', 'ACID', 'multi-document'],
    
    // Backup terms
    'backup': ['backup', 'mongodump', 'restore', 'snapshot', 'export'],
    'restore': ['restore', 'mongorestore', 'backup', 'recovery', 'import'],
    
    // Security terms
    'auth': ['auth', 'authentication', 'authorization', 'security', 'users'],
    'authentication': ['authentication', 'auth', 'login', 'credentials', 'password'],
    'security': ['security', 'authentication', 'authorization', 'encryption', 'TLS'],
    
    // Common abbreviations
    'db': ['database', 'db', 'databases'],
    'doc': ['document', 'doc', 'documents'],
    'docs': ['documentation', 'documents', 'docs'],
    'ops': ['operations', 'ops', 'operators'],
    
    // Voyage AI terms
    'voyage': ['voyage', 'voyage ai', 'voyageai', 'embeddings'],
    'embedding': ['embedding', 'embeddings', 'vector', 'encode'],
    'embeddings': ['embeddings', 'embedding', 'vectors', 'encoding'],
    'context': ['context', 'contextualized', 'contextual', 'context-3'],
    'contextualized': ['contextualized', 'contextual', 'context', 'context-3'],
    'rerank': ['rerank', 'reranking', 'reranker', 'ranking'],
    'reranking': ['reranking', 'rerank', 'reranker', 'ranking'],
    'vector': ['vector', 'vectors', 'embedding', 'embeddings'],
    'vectors': ['vectors', 'vector', 'embeddings', 'embedding'],
    'similarity': ['similarity', 'similar', 'cosine', 'distance'],
    'semantic': ['semantic', 'meaning', 'similarity', 'search'],
    'chunk': ['chunk', 'chunks', 'chunking', 'segment'],
    'chunks': ['chunks', 'chunk', 'chunking', 'segments'],
    'api': ['api', 'API', 'endpoint', 'interface'],
    'model': ['model', 'models', 'voyage-3', 'context-3', 'voyage-finance-2'],
  };

  /**
   * Expand a query into multiple variations
   * Returns array of expanded terms (including original)
   */
  expandQuery(query: string): string[] {
    const terms = query.toLowerCase().split(/\s+/);
    const expandedSets: string[][] = [];

    // Process each term
    for (const term of terms) {
      if (this.expansions[term]) {
        expandedSets.push(this.expansions[term]);
      } else {
        expandedSets.push([term]);
      }
    }

    // Generate combinations (but limit to avoid explosion)
    if (expandedSets.length === 1) {
      return expandedSets[0];
    }

    // For multi-term queries, create a few key variations
    const variations = new Set<string>();
    
    // Add original query
    variations.add(query);
    
    // Add individual expanded terms
    for (let i = 0; i < expandedSets.length; i++) {
      for (const expansion of expandedSets[i]) {
        const termsCopy = [...terms];
        termsCopy[i] = expansion;
        variations.add(termsCopy.join(' '));
      }
    }

    // Limit to top 5 variations to avoid too many embeddings
    return Array.from(variations).slice(0, 5);
  }

  /**
   * Get related terms for a given term
   */
  getRelatedTerms(term: string): string[] {
    const lowerTerm = term.toLowerCase();
    return this.expansions[lowerTerm] || [term];
  }

  /**
   * Add custom expansion rule
   */
  addExpansion(term: string, expansions: string[]): void {
    this.expansions[term.toLowerCase()] = expansions;
  }

  /**
   * Check if a term has expansions
   */
  hasExpansion(term: string): boolean {
    return term.toLowerCase() in this.expansions;
  }
}