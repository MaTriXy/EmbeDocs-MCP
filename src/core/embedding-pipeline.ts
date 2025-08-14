/**
 * Voyage AI Embedding Pipeline
 * Uses voyage-3 model for high-quality 1024-dimensional embeddings
 */

import axios from 'axios';
import { ChunkedDocument, VectorDocument, EmbeddingBatch } from '../types/index.js';
import { MongoDBClient } from './mongodb-client.js';
import { DocumentChunker } from './document-chunker.js';
import pLimit from 'p-limit';

interface VoyageResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export class EmbeddingPipeline {
  private voyageApiKey: string;
  private voyageApiUrl = 'https://api.voyageai.com/v1/embeddings';
  private mongodb: MongoDBClient;
  private chunker: DocumentChunker;
  private rateLimiter = pLimit(3); // Max 3 concurrent API calls
  
  // Voyage API limits
  // private readonly MAX_INPUTS = 1000; // Not currently used
  private readonly MAX_TOTAL_TOKENS = 120000;
  private readonly MAX_TOTAL_CHUNKS = 16000;
  private readonly BATCH_SIZE = 50; // Documents per batch

  constructor() {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error('VOYAGE_API_KEY environment variable is required');
    }
    this.voyageApiKey = apiKey;
    this.mongodb = MongoDBClient.getInstance();
    this.chunker = new DocumentChunker();
  }

  /**
   * Embed all documents using Voyage Context-3's contextualized embeddings
   * This is the KEY differentiator - chunks are embedded with document context
   */
  async embedAllDocuments(chunkedDocs: ChunkedDocument[]): Promise<void> {
    console.error(`🧠 Starting Voyage Context-3 embedding pipeline...`);
    console.error(`📊 Processing ${chunkedDocs.length} documents with ${chunkedDocs.reduce((sum, d) => sum + d.chunks.length, 0)} total chunks`);
    
    // Create batches respecting API limits
    const batches = this.createBatches(chunkedDocs);
    console.error(`📦 Created ${batches.length} batches for processing`);
    
    let processedChunks = 0;
    let totalTokensUsed = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.error(`\n🔄 Processing batch ${i + 1}/${batches.length} (${batch.documents.length} documents, ${batch.totalChunks} chunks)`);
      
      try {
        const { embeddings, tokensUsed } = await this.processBatch(batch);
        processedChunks += embeddings.length;
        totalTokensUsed += tokensUsed;
        
        console.error(`✅ Batch ${i + 1} complete: ${embeddings.length} chunks embedded, ${tokensUsed} tokens used`);
        
        // Rate limiting
        if (i < batches.length - 1) {
          await this.sleep(1000); // 1 second between batches
        }
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);
        throw error;
      }
    }
    
    console.error(`\n🎉 Embedding complete! Processed ${processedChunks} chunks using ${totalTokensUsed} tokens`);
  }

  /**
   * Process a batch of documents with embeddings
   * Using voyage-3 model for high-quality 1024-dimensional embeddings
   */
  private async processBatch(batch: EmbeddingBatch): Promise<{ embeddings: VectorDocument[]; tokensUsed: number }> {
    // Prepare input for Voyage API - flatten all chunks into single array
    const inputs: string[] = [];
    const metadataMap: any[] = [];
    
    for (const doc of batch.documents) {
      // Add each chunk as a separate input
      doc.chunks.forEach((chunk, idx) => {
        inputs.push(chunk.content);
        metadataMap.push({
          documentId: doc.documentId,
          chunkIndex: idx,
          totalChunks: doc.totalChunks,
          ...doc.documentMetadata,
          ...chunk.metadata,
        });
      });
    }
    
    // Call Voyage API with flattened inputs
    const response = await this.callVoyageAPI(inputs, metadataMap);
    
    // Prepare documents for MongoDB
    const vectorDocuments = this.prepareVectorDocuments(
      response.data.map(d => d.embedding),
      batch,
      metadataMap
    );
    
    // Insert into MongoDB
    await this.insertToMongoDB(vectorDocuments);
    
    return {
      embeddings: vectorDocuments,
      tokensUsed: response.usage.total_tokens,
    };
  }

  /**
   * Call Voyage API for embeddings with optimized model selection
   * Uses voyage-code-3 for technical content, voyage-3 for general content
   */
  private async callVoyageAPI(inputs: string[], metadataMap: any[]): Promise<VoyageResponse> {
    // Determine optimal model based on content type
    const technicalCount = metadataMap.filter(m => m.contentType === 'technical').length;
    const totalCount = metadataMap.length;
    const technicalRatio = technicalCount / totalCount;

    // Use voyage-code-3 if majority is technical content
    const model = technicalRatio > 0.5 ? 'voyage-code-3' : 'voyage-3';

    console.error(`🤖 Using ${model} for batch (${technicalCount}/${totalCount} technical chunks)`);

    try {
      const response = await this.rateLimiter(() =>
        axios.post(
          this.voyageApiUrl,
          {
            input: inputs,
            model,
            input_type: 'document',
            output_dimension: 1024,
            output_dtype: 'float',
          },
          {
            headers: {
              'Authorization': `Bearer ${this.voyageApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        )
      );
      
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error('Voyage API error:', error.response.data);
        throw new Error(`Voyage API error: ${error.response.data.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  /**
   * Prepare vector documents for MongoDB insertion
   */
  private prepareVectorDocuments(
    embeddings: number[][],
    batch: EmbeddingBatch,
    metadataMap: any[]
  ): VectorDocument[] {
    const documents: VectorDocument[] = [];
    let embeddingIndex = 0;
    
    for (const doc of batch.documents) {
      for (const chunk of doc.chunks) {
        const vectorDoc: VectorDocument = {
          content: chunk.content,
          contentHash: this.chunker.hashContent(chunk.content),
          embedding: embeddings[embeddingIndex],
          embeddingModel: 'voyage-3',
          embeddedAt: new Date(),
          metadata: metadataMap[embeddingIndex],
          searchMeta: {
            clickCount: 0,
            boostFactor: 1.0,
          },
        };
        
        documents.push(vectorDoc);
        embeddingIndex++;
      }
    }
    
    return documents;
  }

  /**
   * Insert vector documents into MongoDB Atlas
   */
  private async insertToMongoDB(documents: VectorDocument[]): Promise<void> {
    const collection = this.mongodb.getVectorsCollection();
    
    try {
      // Use unordered insert to continue on duplicate errors
      const result = await collection.insertMany(documents, {
        ordered: false,
      });
      
      console.error(`  📝 Inserted ${result.insertedCount} documents to MongoDB`);
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error - some documents already exist
        console.error('  ⚠️ Some documents already exist, updating...');
        await this.updateExistingDocuments(documents);
      } else {
        throw error;
      }
    }
  }

  /**
   * Update existing documents with new embeddings
   */
  private async updateExistingDocuments(documents: VectorDocument[]): Promise<void> {
    const collection = this.mongodb.getVectorsCollection();
    let updated = 0;
    
    for (const doc of documents) {
      try {
        await collection.replaceOne(
          { contentHash: doc.contentHash },
          doc,
          { upsert: true }
        );
        updated++;
      } catch (error) {
        console.error('Failed to update document:', error);
      }
    }
    
    console.error(`  📝 Updated ${updated} existing documents`);
  }

  /**
   * Create batches of documents respecting Voyage API limits
   */
  private createBatches(chunkedDocs: ChunkedDocument[]): EmbeddingBatch[] {
    const batches: EmbeddingBatch[] = [];
    let currentBatch: ChunkedDocument[] = [];
    let currentTokens = 0;
    let currentChunks = 0;
    
    for (const doc of chunkedDocs) {
      // Estimate tokens (rough approximation)
      const docTokens = doc.chunks.reduce((sum, chunk) => sum + chunk.metadata.tokenCount, 0);
      const docChunks = doc.chunks.length;
      
      // Check if adding this document would exceed limits
      if (
        currentBatch.length >= this.BATCH_SIZE ||
        currentTokens + docTokens > this.MAX_TOTAL_TOKENS ||
        currentChunks + docChunks > this.MAX_TOTAL_CHUNKS
      ) {
        // Save current batch
        if (currentBatch.length > 0) {
          batches.push({
            documents: currentBatch,
            totalTokens: currentTokens,
            totalChunks: currentChunks,
          });
        }
        
        // Start new batch
        currentBatch = [];
        currentTokens = 0;
        currentChunks = 0;
      }
      
      // Add document to current batch
      currentBatch.push(doc);
      currentTokens += docTokens;
      currentChunks += docChunks;
    }
    
    // Save final batch
    if (currentBatch.length > 0) {
      batches.push({
        documents: currentBatch,
        totalTokens: currentTokens,
        totalChunks: currentChunks,
      });
    }
    
    return batches;
  }

  /**
   * Embed a single query for search
   */
  async embedQuery(query: string): Promise<number[]> {
    try {
      const response = await axios.post(
        this.voyageApiUrl,
        {
          input: query,
          model: 'voyage-3',
          input_type: 'query', // Important: query type for search
          output_dimension: 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.voyageApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Failed to embed query:', error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}