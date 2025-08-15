/**
 * MongoDB-Specific Query Expander
 * Uses deep MongoDB knowledge to expand queries intelligently
 */

export class MongoDBQueryExpander {
  // MongoDB-specific synonyms and related terms
  private readonly mongoTerms = new Map<string, string[]>([
    // Core concepts
    ['insert', ['insertOne', 'insertMany', 'create', 'add', 'save', 'write', 'bulk insert', 'batch insert']],
    ['query', ['find', 'findOne', 'findMany', 'search', 'filter', 'match', 'select', 'retrieve', 'get', 'fetch']],
    ['update', ['updateOne', 'updateMany', 'findOneAndUpdate', 'findAndModify', 'modify', 'change', 'patch', 'replace', 'set', '$set', 'upsert']],
    ['delete', ['deleteOne', 'deleteMany', 'remove', 'drop', 'findOneAndDelete', 'findAndRemove', 'destroy']],
    ['aggregate', ['aggregation', 'pipeline', '$match', '$group', '$project', '$sort', '$limit', '$skip', '$lookup', '$unwind', '$out', '$merge']],
    
    // Operators
    ['operator', ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$type', '$regex', '$and', '$or', '$nor', '$not']],
    ['comparison', ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', 'equal', 'not equal', 'greater', 'less']],
    ['array', ['$push', '$pull', '$pop', '$addToSet', '$each', '$slice', '$size', '$elemMatch', 'array operators']],
    
    // Indexing
    ['index', ['indexes', 'indexing', 'createIndex', 'create index', 'ensureIndex', 'compound index', 'multikey', 'text index', 'geospatial', '2dsphere', 'unique', 'sparse', 'ttl', 'partial', 'single field index', 'compound indexes']],
    ['create', ['create', 'createIndex', 'createCollection', 'insert', 'insertOne', 'insertMany', 'new', 'add']],
    ['performance', ['optimization', 'explain', 'executionStats', 'index scan', 'collection scan', 'covered query', 'hint', 'profile', 'slow query']],
    
    // Atlas specific
    ['atlas', ['mongodb atlas', 'cloud', 'cluster', 'serverless', 'dedicated', 'shared', 'M0', 'M10', 'M20', 'managed']],
    ['search', ['atlas search', '$search', 'lucene', 'fuzzy', 'autocomplete', 'highlight', 'facets', 'synonyms', 'text search']],
    ['vector', ['vector search', '$vectorSearch', 'embedding', 'similarity', 'knn', 'ann', 'cosine', 'euclidean', 'dot product']],
    
    // Replication & Sharding
    ['replica', ['replica set', 'replication', 'primary', 'secondary', 'arbiter', 'rs.status', 'rs.conf', 'oplog', 'majority']],
    ['shard', ['sharding', 'sharded cluster', 'shard key', 'chunks', 'balancer', 'mongos', 'config server', 'zone sharding']],
    
    // Transactions
    ['transaction', ['transactions', 'ACID', 'commit', 'abort', 'rollback', 'session', 'readConcern', 'writeConcern', 'readPreference']],
    
    // Data modeling
    ['schema', ['data model', 'document structure', 'embedded', 'referenced', 'normalized', 'denormalized', 'one-to-many', 'many-to-many']],
    ['validation', ['schema validation', 'jsonSchema', 'validator', 'validationLevel', 'validationAction', 'required', 'bsonType']],
    
    // Drivers
    ['nodejs', ['node.js', 'javascript', 'driver', 'mongoose', 'mongodb-native', 'npm', 'async', 'await', 'callback', 'promise']],
    ['python', ['pymongo', 'motor', 'python driver', 'mongoengine', 'pip', 'async', 'sync']],
    
    // Common issues
    ['connection', ['connect', 'connection string', 'mongodb://', 'mongodb+srv://', 'connection pool', 'poolSize', 'timeout', 'auth']],
    ['error', ['exception', 'error code', 'duplicate key', 'network error', 'timeout error', 'write error', 'validation error']],
    
    // Voyage AI specific
    ['embedding', ['embeddings', 'vector', 'voyage', 'voyage-3', 'voyage-large-2', 'contextualized', 'semantic']],
    ['rerank', ['reranking', 'reranker', 'voyage-rerank-2', 'relevance', 'scoring', 'ranking']],
  ]);

  // MongoDB aggregation stages
  private readonly aggregationStages = [
    '$match', '$group', '$project', '$sort', '$limit', '$skip',
    '$lookup', '$unwind', '$out', '$merge', '$facet', '$bucket',
    '$bucketAuto', '$addFields', '$replaceRoot', '$replaceWith',
    '$count', '$sortByCount', '$redact', '$sample', '$geoNear',
    '$graphLookup', '$indexStats', '$listSessions', '$search',
    '$searchMeta', '$set', '$unset', '$unionWith', '$vectorSearch'
  ];


  /**
   * Expand a query with MongoDB-specific knowledge
   */
  expandQuery(query: string): string[] {
    const expanded = new Set<string>();
    expanded.add(query); // Original query
    
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);
    
    // 🧠 MONGODB INTELLIGENCE: Detect patterns first
    const mongoPatterns = this.detectMongoDBPatterns(queryLower);
    console.error(`🧠 Query patterns: [${mongoPatterns.join(', ')}]`);
    
    // 🎯 Add pattern-specific expansions
    this.addPatternBasedExpansions(query, mongoPatterns, expanded);
    
    // 1. Check for exact MongoDB terms
    for (const word of words) {
      // Check if it's an aggregation stage
      if (this.aggregationStages.some(stage => stage.toLowerCase().includes(word))) {
        expanded.add(`mongodb aggregation ${word}`);
        expanded.add(`${word} aggregation pipeline`);
      }
      
      // Check if it's in our term map
      for (const [key, values] of this.mongoTerms) {
        if (key.includes(word) || word.includes(key)) {
          values.forEach(v => {
            expanded.add(query.replace(word, v));
          });
        }
        // Also check if any synonym matches
        if (values.some(v => v.toLowerCase().includes(word))) {
          expanded.add(query.replace(word, key));
        }
      }
    }
    
    // 2. Detect intent and add specific expansions
    const intent = this.detectIntent(queryLower);
    
    switch (intent) {
      case 'tutorial':
        expanded.add(`${query} tutorial`);
        expanded.add(`how to ${query}`);
        expanded.add(`${query} example`);
        expanded.add(`${query} guide`);
        break;
        
      case 'error':
        expanded.add(`${query} error`);
        expanded.add(`${query} troubleshooting`);
        expanded.add(`${query} solution`);
        expanded.add(`fix ${query}`);
        break;
        
      case 'performance':
        expanded.add(`${query} performance`);
        expanded.add(`optimize ${query}`);
        expanded.add(`${query} index`);
        expanded.add(`${query} explain plan`);
        break;
        
      case 'aggregation':
        expanded.add(`${query} aggregation pipeline`);
        expanded.add(`$${words[words.length - 1]}`); // Add $ prefix for operators
        expanded.add(`mongodb aggregate ${query}`);
        break;
        
      case 'driver':
        expanded.add(`${query} driver`);
        expanded.add(`${query} mongodb`);
        expanded.add(`${query} connection`);
        break;
    }
    
    // 3. Add MongoDB-specific context
    if (!queryLower.includes('mongodb')) {
      expanded.add(`mongodb ${query}`);
    }
    
    // 4. Handle common abbreviations
    const abbreviations = {
      'crud': 'create read update delete',
      'ttl': 'time to live index',
      'wc': 'write concern',
      'rc': 'read concern',
      'rp': 'read preference',
      'rs': 'replica set',
      'sh': 'sharding',
      'agg': 'aggregation',
      'idx': 'index',
      'doc': 'document',
      'col': 'collection',
      'db': 'database',
    };
    
    for (const [abbr, full] of Object.entries(abbreviations)) {
      if (queryLower.includes(abbr)) {
        expanded.add(query.replace(new RegExp(abbr, 'gi'), full));
      }
    }
    
    // 5. Add version-specific queries if needed
    if (queryLower.match(/\bv?\d+\.\d+\b/)) {
      expanded.add(`${query} compatibility`);
      expanded.add(`${query} changes`);
      expanded.add(`${query} migration`);
    }
    
    // Add programming language specific terms
    this.addProgrammingLanguageTerms(query, expanded);
    
    // Add API and method specific terms  
    this.addAPITerms(query, expanded);
    
    // Limit to top 10 most relevant expansions
    return Array.from(expanded).slice(0, 10);
  }

  /**
   * Detect the intent of the query
   */
  private detectIntent(query: string): string {
    if (query.includes('how') || query.includes('tutorial') || query.includes('example')) {
      return 'tutorial';
    }
    if (query.includes('error') || query.includes('fail') || query.includes('not work')) {
      return 'error';
    }
    if (query.includes('slow') || query.includes('performance') || query.includes('optimize')) {
      return 'performance';
    }
    if (query.includes('aggregate') || query.includes('pipeline') || query.includes('$')) {
      return 'aggregation';
    }
    if (query.includes('node') || query.includes('python') || query.includes('java') || query.includes('driver')) {
      return 'driver';
    }
    return 'general';
  }

  /**
   * Generate smart suggestions when no results found
   */
  generateSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Suggest correct MongoDB terminology
    if (queryLower.includes('search')) {
      suggestions.push('Try "find" for basic queries or "$search" for Atlas Search');
    }
    if (queryLower.includes('join')) {
      suggestions.push('Try "$lookup" for joining collections in MongoDB');
    }
    if (queryLower.includes('group by')) {
      suggestions.push('Try "$group" in aggregation pipeline');
    }
    if (queryLower.includes('where')) {
      suggestions.push('Try "$match" or "find" with query filters');
    }
    if (queryLower.includes('select')) {
      suggestions.push('Try "$project" or field projection in find()');
    }
    
    // Suggest common next steps
    if (suggestions.length === 0) {
      suggestions.push(
        'Try using MongoDB terminology (e.g., "find" instead of "select")',
        'Add "mongodb" to your query for better results',
        'Check our documentation sections: CRUD, Aggregation, Indexes, Atlas'
      );
    }
    
    return suggestions;
  }

  /**
   * Add programming language specific terms
   */
  private addProgrammingLanguageTerms(query: string, expanded: Set<string>): void {
    const queryLower = query.toLowerCase();
    
    // Node.js specific
    if (queryLower.includes('node') || queryLower.includes('javascript') || queryLower.includes('js')) {
      expanded.add(`${query} node.js driver`);
      expanded.add(`${query} mongoose`);
      expanded.add(`${query} async await`);
      expanded.add(`${query} callback`);
    }
    
    // Python specific
    if (queryLower.includes('python') || queryLower.includes('py')) {
      expanded.add(`${query} pymongo`);
      expanded.add(`${query} motor async`);
      expanded.add(`${query} mongoengine`);
    }
    
    // Java specific
    if (queryLower.includes('java')) {
      expanded.add(`${query} java driver`);
      expanded.add(`${query} spring data`);
      expanded.add(`${query} morphia`);
    }
    
    // C# specific
    if (queryLower.includes('c#') || queryLower.includes('csharp') || queryLower.includes('.net')) {
      expanded.add(`${query} c# driver`);
      expanded.add(`${query} .net`);
      expanded.add(`${query} entity framework`);
    }
  }

  /**
   * Add API and method specific terms
   */
  private addAPITerms(query: string, expanded: Set<string>): void {
    const queryLower = query.toLowerCase();
    
    // Vector search specific
    if (queryLower.includes('vector') || queryLower.includes('embedding') || queryLower.includes('semantic')) {
      expanded.add(`${query} $vectorSearch`);
      expanded.add(`${query} createSearchIndex`);
      expanded.add(`${query} cosine similarity`);
      expanded.add(`${query} numDimensions`);
      expanded.add(`${query} Atlas Vector Search`);
    }
    
    // Aggregation specific
    if (queryLower.includes('aggregate') || queryLower.includes('pipeline')) {
      expanded.add(`${query} $match $group $sort`);
      expanded.add(`${query} $lookup $unwind`);
      expanded.add(`${query} $project $limit`);
    }
    
    // Index specific
    if (queryLower.includes('index') || queryLower.includes('performance')) {
      expanded.add(`${query} createIndex`);
      expanded.add(`${query} compound index`);
      expanded.add(`${query} explain executionStats`);
      expanded.add(`${query} hint optimization`);
    }
    
    // Authentication specific
    if (queryLower.includes('auth') || queryLower.includes('login') || queryLower.includes('connect')) {
      expanded.add(`${query} connection string`);
      expanded.add(`${query} mongodb+srv`);
      expanded.add(`${query} authentication mechanisms`);
      expanded.add(`${query} username password`);
    }
  }

  /**
   * Detect MongoDB-specific patterns (CRUSHING Octocode with intelligence!)
   */
  private detectMongoDBPatterns(query: string): string[] {
    const patterns = [];
    
    // CRUD patterns
    if (/insert|create|add|save/.test(query)) patterns.push('crud-insert');
    if (/find|query|search|get|fetch/.test(query)) patterns.push('crud-read');
    if (/update|modify|change|set/.test(query)) patterns.push('crud-update');
    if (/delete|remove|drop/.test(query)) patterns.push('crud-delete');
    
    // Advanced MongoDB patterns
    if (/aggregate|pipeline|\$match|\$group/.test(query)) patterns.push('aggregation');
    if (/vector|embedding|similarity|semantic/.test(query)) patterns.push('vector-search');
    if (/index|performance|optimize|slow/.test(query)) patterns.push('performance');
    if (/error|problem|fix|troubleshoot/.test(query)) patterns.push('troubleshooting');
    if (/replica|shard|cluster|scale/.test(query)) patterns.push('scaling');
    if (/transaction|acid|session/.test(query)) patterns.push('transactions');
    if (/schema|model|design|validation/.test(query)) patterns.push('data-modeling');
    
    // Driver patterns
    if (/node|javascript|mongoose/.test(query)) patterns.push('nodejs');
    if (/python|pymongo|motor/.test(query)) patterns.push('python');
    if (/java|spring/.test(query)) patterns.push('java');
    
    return patterns;
  }

  /**
   * Add expansions based on detected patterns
   */
  private addPatternBasedExpansions(originalQuery: string, patterns: string[], expanded: Set<string>): void {
    patterns.forEach(pattern => {
      switch (pattern) {
        case 'crud-insert':
          ['insertOne', 'insertMany', 'create document', 'add record', 'bulk insert'].forEach(term => {
            expanded.add(`${originalQuery} ${term}`);
          });
          break;
          
        case 'crud-read':
          ['find', 'findOne', 'findMany', 'query documents', 'search collection'].forEach(term => {
            expanded.add(`${originalQuery} ${term}`);
          });
          break;
          
        case 'aggregation':
          ['aggregation pipeline', '$match stage', '$group operator', 'pipeline stages'].forEach(term => {
            expanded.add(`${originalQuery} ${term}`);
          });
          break;
          
        case 'vector-search':
          ['$vectorSearch', 'Atlas Vector Search', 'semantic search', 'similarity search', 'vector index'].forEach(term => {
            expanded.add(`${originalQuery} ${term}`);
          });
          break;
          
        case 'performance':
          ['explain plan', 'execution stats', 'index optimization', 'query performance', 'slow query log'].forEach(term => {
            expanded.add(`${originalQuery} ${term}`);
          });
          break;
      }
    });
  }
}