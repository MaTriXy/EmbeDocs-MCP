/**
 * MongoDB Atlas Connection Manager
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { VectorDocument } from '../types/index.js';

export class MongoDBClient {
  private static instance: MongoDBClient;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {}

  static getInstance(): MongoDBClient {
    if (!MongoDBClient.instance) {
      MongoDBClient.instance = new MongoDBClient();
    }
    return MongoDBClient.instance;
  }

  async connect(): Promise<void> {
    if (this.client && this.db) {
      return; // Already connected
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    try {
      this.client = new MongoClient(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
      });

      await this.client.connect();
      await this.client.db('admin').command({ ping: 1 });

      const dbName = process.env.MONGODB_DATABASE || 'mongodb_semantic_docs';
      this.db = this.client.db(dbName);

      console.error(`Connected to MongoDB Atlas (database: ${dbName})`);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      // Clean up on error
      if (this.client) {
        await this.client.close().catch(() => {});
        this.client = null;
        this.db = null;
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  getDatabase(): Db {
    if (!this.db) {
      throw new Error('Not connected to MongoDB');
    }
    return this.db;
  }

  getVectorsCollection(): Collection<VectorDocument> {
    const collectionName = process.env.MONGODB_COLLECTION || 'documents';
    return this.getDatabase().collection<VectorDocument>(collectionName);
  }

  getDocumentsCollection(): Collection {
    return this.getDatabase().collection('documents');
  }

  getAnalyticsCollection(): Collection {
    return this.getDatabase().collection('analytics');
  }

  async checkConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.db('admin').command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async createVectorSearchIndex(): Promise<void> {
    const collection = this.getVectorsCollection();
    
    // Ensure collection exists
    try {
      const collectionName = process.env.MONGODB_COLLECTION || 'documents';
      await this.getDatabase().createCollection(collectionName);
    } catch (error: any) {
      // Collection might already exist, that's fine
      if (error.code !== 48) { // 48 = NamespaceExists
        console.error('Warning: Could not create collection:', error.message);
      }
    }
    
    // Check if index exists
    const indexes = await collection.listSearchIndexes().toArray();
    
    if (!indexes.find((i: any) => i.name === 'semantic_search')) {
      console.error('Creating vector search index...');
      
      await collection.createSearchIndex({
        name: 'semantic_search',
        type: 'vectorSearch',
        definition: {
          fields: [
            {
              type: 'vector',
              path: 'embedding',
              numDimensions: 2048, // DOUBLED for maximum performance!
              similarity: 'cosine',
            },
          ],
        },
      });
      
      console.error('Vector search index created successfully');
      
      // Wait for index to be ready
      await this.waitForIndexReady('semantic_search');
    } else {
      console.error('Vector search index already exists');
    }
  }

  private async waitForIndexReady(indexName: string, maxWaitTime = 60000): Promise<void> {
    const startTime = Date.now();
    const collection = this.getVectorsCollection();
    
    while (Date.now() - startTime < maxWaitTime) {
      const indexes = await collection.listSearchIndexes().toArray();
      const index = indexes.find((i: any) => i.name === indexName);
      
      if (index && (index as any).status === 'READY') {
        console.error(`Index ${indexName} is ready`);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Index ${indexName} did not become ready within ${maxWaitTime}ms`);
  }

  async getCollectionStats(): Promise<any> {
    const collection = this.getVectorsCollection();
    
    const [count, stats] = await Promise.all([
      collection.countDocuments(),
      (collection as any).stats(),
    ]);
    
    return {
      documentCount: count,
      storageSize: stats.storageSize,
      indexSize: stats.totalIndexSize,
      avgDocumentSize: stats.avgObjSize,
    };
  }
}