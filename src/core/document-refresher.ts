/**
 * Document Refresher for MongoDB Semantic MCP
 * Handles incremental updates to keep documentation current
 */

import { MongoDBClient } from './mongodb-client.js';
import { DocumentFetcher } from './document-fetcher.js';
import { VoyageDocumentFetcher } from './voyage-fetcher.js';
import { DocumentChunker } from './document-chunker.js';
import { EmbeddingPipeline } from './embedding-pipeline.js';
import { RefreshResult, Document, MongoDBProduct } from '../types/index.js';
import crypto from 'crypto';

interface RefreshOptions {
  mode: 'incremental' | 'full';
  products?: MongoDBProduct[];
}

export class DocumentRefresher {
  private mongodb: MongoDBClient;
  private fetcher: DocumentFetcher;
  private voyageFetcher: VoyageDocumentFetcher;
  private chunker: DocumentChunker;
  private pipeline: EmbeddingPipeline;
  private initialized = false;

  constructor() {
    this.mongodb = MongoDBClient.getInstance();
    this.fetcher = new DocumentFetcher();
    this.voyageFetcher = new VoyageDocumentFetcher();
    this.chunker = new DocumentChunker();
    this.pipeline = new EmbeddingPipeline();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.mongodb.connect();
    this.initialized = true;
  }

  /**
   * Refresh documentation based on mode
   */
  async refresh(options: RefreshOptions): Promise<RefreshResult> {
    console.error(`🔄 Starting ${options.mode} refresh...`);

    try {
      if (options.mode === 'full') {
        return await this.fullRefresh(options);
      } else {
        return await this.incrementalRefresh(options);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      throw error;
    }
  }

  /**
   * Incremental refresh - only update changed documents
   */
  private async incrementalRefresh(options: RefreshOptions): Promise<RefreshResult> {
    const result: RefreshResult = {
      documentsChecked: 0,
      documentsUpdated: 0,
      newDocuments: 0,
      deletedDocuments: 0,
      errors: [],
    };

    // Fetch current documentation from GitHub
    console.error('📥 Fetching latest documentation...');
    const mongoDocs = await this.fetcher.fetchAllDocumentation();
    
    // Also fetch Voyage AI documentation if requested
    let voyageDocs: Document[] = [];
    if (!options.products || options.products.includes('voyage')) {
      console.error('🚀 Fetching Voyage AI documentation...');
      voyageDocs = await this.voyageFetcher.fetchAllVoyageDocumentation();
    }
    
    const currentDocs = [...mongoDocs, ...voyageDocs];
    result.documentsChecked = currentDocs.length;

    // Get existing document hashes from MongoDB
    const existingHashes = await this.getExistingDocumentHashes();
    
    // Compare and identify changes
    const newDocs: Document[] = [];
    const updatedDocs: Document[] = [];
    const currentHashes = new Set<string>();

    for (const doc of currentDocs) {
      const hash = this.hashDocument(doc);
      currentHashes.add(doc.id);

      if (!existingHashes.has(doc.id)) {
        // New document
        newDocs.push(doc);
        result.newDocuments++;
      } else if (existingHashes.get(doc.id) !== hash) {
        // Updated document
        updatedDocs.push(doc);
        result.documentsUpdated++;
      }
    }

    // Identify deleted documents
    const deletedDocIds = Array.from(existingHashes.keys()).filter(
      id => !currentHashes.has(id)
    );
    result.deletedDocuments = deletedDocIds.length;

    // Process new documents
    if (newDocs.length > 0) {
      console.error(`📄 Processing ${newDocs.length} new documents...`);
      await this.processNewDocuments(newDocs);
    }

    // Process updated documents
    if (updatedDocs.length > 0) {
      console.error(`📝 Updating ${updatedDocs.length} documents...`);
      await this.updateDocuments(updatedDocs);
    }

    // Remove deleted documents
    if (deletedDocIds.length > 0) {
      console.error(`🗑️ Removing ${deletedDocIds.length} deleted documents...`);
      await this.removeDocuments(deletedDocIds);
    }

    // Update metadata
    await this.updateRefreshMetadata(result);

    console.error(`✅ Refresh complete: ${result.newDocuments} new, ${result.documentsUpdated} updated, ${result.deletedDocuments} deleted`);
    return result;
  }

  /**
   * Full refresh - reprocess all documentation
   */
  private async fullRefresh(options: RefreshOptions): Promise<RefreshResult> {
    console.error('🔄 Starting full refresh...');
    
    const result: RefreshResult = {
      documentsChecked: 0,
      documentsUpdated: 0,
      newDocuments: 0,
      deletedDocuments: 0,
      errors: [],
    };

    // Clear existing data
    console.error('🗑️ Clearing existing data...');
    const collection = this.mongodb.getVectorsCollection();
    const deleteResult = await collection.deleteMany({});
    result.deletedDocuments = deleteResult.deletedCount || 0;

    // Fetch all documentation
    console.error('📥 Fetching all documentation...');
    const mongoDocs = await this.fetcher.fetchAllDocumentation();
    
    // Also fetch Voyage AI documentation if requested
    let voyageDocs: Document[] = [];
    if (!options.products || options.products.includes('voyage')) {
      console.error('🚀 Fetching Voyage AI documentation...');
      voyageDocs = await this.voyageFetcher.fetchAllVoyageDocumentation();
    }
    
    const documents = [...mongoDocs, ...voyageDocs];
    result.documentsChecked = documents.length;
    result.newDocuments = documents.length;

    // Process all documents
    await this.processNewDocuments(documents);

    console.error(`✅ Full refresh complete: ${result.newDocuments} documents processed`);
    return result;
  }

  /**
   * Get existing document hashes from MongoDB
   */
  private async getExistingDocumentHashes(): Promise<Map<string, string>> {
    const collection = this.mongodb.getDocumentsCollection();
    const docs = await collection
      .find({}, { projection: { documentId: 1, contentHash: 1 } })
      .toArray();

    const hashes = new Map<string, string>();
    for (const doc of docs) {
      hashes.set(doc.documentId, doc.contentHash);
    }
    return hashes;
  }

  /**
   * Process new documents
   */
  private async processNewDocuments(documents: Document[]): Promise<void> {
    if (documents.length === 0) return;

    // Chunk documents
    const chunkedDocs = await this.chunker.chunkDocuments(documents);

    // Generate embeddings and store
    await this.pipeline.embedAllDocuments(chunkedDocs);

    // Store document metadata
    const docsCollection = this.mongodb.getDocumentsCollection();
    const docMetadata = documents.map(doc => ({
      documentId: doc.id,
      contentHash: this.hashDocument(doc),
      metadata: doc.metadata,
      lastUpdated: new Date(),
    }));

    await docsCollection.insertMany(docMetadata, { ordered: false }).catch((err: any) => {
      if (err.code !== 11000) { // Ignore duplicate key errors
        throw err;
      }
    });
  }

  /**
   * Update existing documents
   */
  private async updateDocuments(documents: Document[]): Promise<void> {
    const collection = this.mongodb.getVectorsCollection();
    const docsCollection = this.mongodb.getDocumentsCollection();

    for (const doc of documents) {
      try {
        // Remove old chunks
        await collection.deleteMany({ 'metadata.documentId': doc.id });

        // Process and add new chunks
        const chunked = await this.chunker.chunkDocuments([doc]);
        await this.pipeline.embedAllDocuments(chunked);

        // Update document metadata
        await docsCollection.updateOne(
          { documentId: doc.id },
          {
            $set: {
              contentHash: this.hashDocument(doc),
              metadata: doc.metadata,
              lastUpdated: new Date(),
            },
          },
          { upsert: true }
        );
      } catch (error) {
        console.error(`Failed to update document ${doc.id}:`, error);
      }
    }
  }

  /**
   * Remove deleted documents
   */
  private async removeDocuments(documentIds: string[]): Promise<void> {
    if (documentIds.length === 0) return;

    const collection = this.mongodb.getVectorsCollection();
    const docsCollection = this.mongodb.getDocumentsCollection();

    // Remove vectors
    await collection.deleteMany({
      'metadata.documentId': { $in: documentIds },
    });

    // Remove document metadata
    await docsCollection.deleteMany({
      documentId: { $in: documentIds },
    });
  }

  /**
   * Generate hash for document content
   */
  private hashDocument(doc: Document): string {
    const content = JSON.stringify({
      content: doc.content,
      metadata: doc.metadata,
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Update refresh metadata
   */
  private async updateRefreshMetadata(result: RefreshResult): Promise<void> {
    const collection = this.mongodb.getDatabase().collection('metadata');
    
    await collection.updateOne(
      { type: 'refresh' },
      {
        $set: {
          lastRefresh: new Date(),
          lastResult: result,
        },
        $inc: {
          totalRefreshes: 1,
        },
      },
      { upsert: true }
    );
  }

  /**
   * Get last refresh information
   */
  async getLastRefreshInfo(): Promise<any> {
    const collection = this.mongodb.getDatabase().collection('metadata');
    const metadata = await collection.findOne({ type: 'refresh' });
    return metadata || { lastRefresh: null, totalRefreshes: 0 };
  }
}