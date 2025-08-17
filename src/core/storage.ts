/**
 * SINGLE Storage Service - The ONLY place that interacts with MongoDB
 * Clean, simple, testable
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../config/index.js';

export interface Document {
  documentId: string;
  content: string;
  embedding: number[];
  title?: string;
  product?: string;
  version?: string;
  metadata?: Record<string, any>;
  embeddingModel: string;
  embeddingDimensions: number;
  indexedAt: Date;
}

export class StorageService {
  private static instance: StorageService;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  
  private constructor() {}
  
  static getInstance(): StorageService {
    if (!this.instance) {
      this.instance = new StorageService();
    }
    return this.instance;
  }
  
  async connect(): Promise<void> {
    if (this.client && this.db) return;
    
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is required');
    }
    
    this.client = new MongoClient(uri, {
      maxPoolSize: config.storage.maxPoolSize,
      minPoolSize: config.storage.minPoolSize,
    });
    
    await this.client.connect();
    this.db = this.client.db(config.storage.database);
    
    // Ensure BOTH vector and text indexes exist
    await this.ensureVectorIndex();
    await this.ensureTextIndex();
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
  
  private getCollection(): Collection<Document> {
    if (!this.db) throw new Error('Not connected to MongoDB');
    return this.db.collection<Document>(config.storage.collection);
  }
  
  /**
   * Upsert documents in batches
   */
  async upsertDocuments(documents: Document[]): Promise<void> {
    const collection = this.getCollection();
    
    const bulkOps = documents.map(doc => ({
      updateOne: {
        filter: { documentId: doc.documentId },
        update: { $set: doc },
        upsert: true
      }
    }));
    
    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps, { ordered: false });
    }
  }
  
  /**
   * Clean the database
   */
  async clean(): Promise<void> {
    const collection = this.getCollection();
    await collection.deleteMany({});
  }
  
  /**
   * Get document count
   */
  async count(filter: any = {}): Promise<number> {
    const collection = this.getCollection();
    return collection.countDocuments(filter);
  }
  
  /**
   * Vector search
   */
  async vectorSearch(
    embedding: number[], 
    limit: number = 10,
    filter?: any
  ): Promise<Document[]> {
    const collection = this.getCollection();
    
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: config.storage.vectorIndexName,
          path: 'embedding',
          queryVector: embedding,
          numCandidates: config.search.numCandidates,
          limit,
          ...(filter && { filter })
        }
      },
      {
        $addFields: {
          searchScore: { $meta: 'vectorSearchScore' }
        }
      },
      {
        $project: {
          embedding: 0 // Exclude embeddings from results
        }
      }
    ];
    
    return collection.aggregate<Document>(pipeline).toArray();
  }
  
  /**
   * Keyword search using MongoDB Atlas Search
   * Based on: https://github.com/JohnGUnderwood/atlas-hybrid-search
   */
  async keywordSearch(
    query: string,
    limit: number = 10
  ): Promise<Document[]> {
    const collection = this.getCollection();
    
    // Use MongoDB Atlas Search with text index
    const pipeline: any[] = [
      {
        $search: {
          index: 'text_index',
          text: {
            query: query,
            path: ['content', 'title'],
            fuzzy: {
              maxEdits: 2,
              prefixLength: 3
            }
          }
        }
      },
      {
        $limit: limit
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' }
        }
      },
      {
        $project: {
          embedding: 0 // Exclude embeddings from results
        }
      }
    ];
    
    try {
      return await collection.aggregate<Document>(pipeline).toArray();
    } catch (error) {
      // Fallback to regex search if Atlas Search is not available
      console.warn('Atlas Search failed, falling back to regex search:', error);
      return collection.find({
        $or: [
          { content: { $regex: query, $options: 'i' } },
          { title: { $regex: query, $options: 'i' } }
        ]
      })
      .limit(limit)
      .toArray();
    }
  }
  
  /**
   * Ensure vector index exists
   */
  private async ensureVectorIndex(): Promise<void> {
    const collection = this.getCollection();
    
    try {
      const indexes = await collection.listSearchIndexes().toArray();
      
      if (!indexes.find((i: any) => i.name === config.storage.vectorIndexName)) {
        await collection.createSearchIndex({
          name: config.storage.vectorIndexName,
          type: 'vectorSearch',
          definition: {
            fields: [
              {
                type: 'vector',
                path: 'embedding',
                numDimensions: config.embedding.dimensions,
                similarity: 'cosine',
              },
            ],
          },
        });
        
        console.log(`✅ Created vector index with ${config.embedding.dimensions} dimensions`);
      }
    } catch (error) {
      console.warn('Could not create vector index:', error);
    }
  }
  
  /**
   * Ensure text index exists for keyword search
   * Based on: https://github.com/JohnGUnderwood/atlas-hybrid-search/blob/main/create-search-indexes.mjs
   */
  private async ensureTextIndex(): Promise<void> {
    const collection = this.getCollection();
    
    try {
      const indexes = await collection.listSearchIndexes().toArray();
      
      if (!indexes.find((i: any) => i.name === 'text_index')) {
        await collection.createSearchIndex({
          name: 'text_index',
          definition: {
            mappings: {
              dynamic: false,
              fields: {
                content: {
                  type: 'string',
                  analyzer: 'lucene.english',
                  multi: {
                    standardAnalyzer: {
                      type: 'string',
                      analyzer: 'lucene.standard'
                    }
                  }
                },
                title: {
                  type: 'string',
                  analyzer: 'lucene.standard',
                  multi: {
                    keywordAnalyzer: {
                      type: 'string',
                      analyzer: 'lucene.keyword'
                    }
                  }
                },
                product: {
                  type: 'string',
                  analyzer: 'lucene.keyword'
                },
                version: {
                  type: 'string',
                  analyzer: 'lucene.keyword'
                }
              }
            }
          }
        });
        
        console.log('✅ Created text search index for keyword search');
      }
    } catch (error) {
      console.warn('Could not create text index:', error);
    }
  }
  
  /**
   * Get statistics
   */
  async getStats(): Promise<any> {
    const collection = this.getCollection();
    
    const [total, products, models] = await Promise.all([
      collection.countDocuments(),
      collection.distinct('product'),
      collection.distinct('embeddingModel')
    ]);
    
    return {
      totalDocuments: total,
      products,
      models,
      expectedDimensions: config.embedding.dimensions,
      expectedModel: config.embedding.model
    };
  }
}