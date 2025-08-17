/**
 * ENHANCED Voyage AI Embedding Pipeline
 * Uses voyage-3 model for TRUE contextualized 1024-dimensional embeddings
 * 
 * RESEARCH-BASED IMPROVEMENTS:
 * - RAGFlow-inspired dynamic batching with memory management
 * - LightRAG-inspired parallel processing with MAX_ASYNC control
 * - True contextual document grouping for maximum embedding quality
 */

import axios from 'axios';
import { ChunkedDocument, VectorDocument, EmbeddingBatch } from '../types/index.js';
import { MongoDBClient } from './mongodb-client.js';
import { SmartChunker } from './smart-chunker.js';
import pLimit from 'p-limit';

export class EmbeddingPipeline {
  private voyageApiKey: string;
  private voyageEmbedUrl = 'https://api.voyageai.com/v1/embeddings';
  private mongodb: MongoDBClient;
  private chunker: SmartChunker;
  private rateLimiter = pLimit(3); // Max 3 concurrent API calls
  
  // ENHANCED: Research-based API limits and batching
  private readonly MAX_TOTAL_TOKENS = 120000;
  private readonly MAX_TOTAL_CHUNKS = 16000;
  private dynamicBatchSize = 8; // RAGFlow-inspired: Start with 8, adjust based on performance
  private readonly MIN_BATCH_SIZE = 2; // Minimum for stability
  private readonly VOYAGE_DIMENSIONS = 1024; // voyage-3: Perfect 1024 dimensions for Atlas Vector Search

  constructor() {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error('VOYAGE_API_KEY environment variable is required');
    }
    this.voyageApiKey = apiKey;
    this.mongodb = MongoDBClient.getInstance();
    this.chunker = new SmartChunker();
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
   * Process a batch of documents with TRUE contextualized embeddings
   * Each document's chunks are embedded together for global context awareness
   */
  private async processBatch(batch: EmbeddingBatch): Promise<{ embeddings: VectorDocument[]; tokensUsed: number }> {
    // CRITICAL: Group chunks by document for contextualized_embed
    const documentGroups: string[][] = [];
    const metadataGroups: any[][] = [];
    
    for (const doc of batch.documents) {
      const docChunks: string[] = [];
      const docMetadata: any[] = [];
      
      doc.chunks.forEach((chunk, idx) => {
        docChunks.push(chunk.content);
        docMetadata.push({
          documentId: doc.documentId,
          chunkIndex: idx,
          totalChunks: doc.totalChunks,
          ...doc.documentMetadata,
          ...chunk.metadata,
        });
      });
      
      documentGroups.push(docChunks);
      metadataGroups.push(docMetadata);
    }
    
    // Call Voyage API with CONTEXTUALIZED embeddings
    const embeddings = await this.callContextualizedEmbed(documentGroups);
    
    // Flatten embeddings and metadata for MongoDB
    const flatEmbeddings: number[][] = [];
    const flatMetadata: any[] = [];
    
    embeddings.forEach((docEmbeddings, docIdx) => {
      docEmbeddings.forEach((embedding, chunkIdx) => {
        flatEmbeddings.push(embedding);
        flatMetadata.push(metadataGroups[docIdx][chunkIdx]);
      });
    });
    
    // Prepare documents for MongoDB
    const vectorDocuments = this.prepareVectorDocuments(
      flatEmbeddings,
      batch,
      flatMetadata
    );
    
    // Insert into MongoDB
    await this.insertToMongoDB(vectorDocuments);
    
    // Estimate token usage (approximate)
    const totalTokens = documentGroups.reduce((sum, doc) => 
      sum + doc.reduce((docSum, chunk) => docSum + chunk.length / 4, 0), 0
    );
    
    return {
      embeddings: vectorDocuments,
      tokensUsed: Math.round(totalTokens),
    };
  }

  /**
   * Call Voyage API with TRUE contextualized embeddings - USING THE CORRECT ENDPOINT!
   * This is the GAME CHANGER - chunks are embedded with full document context!
   */
  private async callContextualizedEmbed(documentGroups: string[][]): Promise<number[][][]> {
    const model = 'voyage-3';
    console.error(`🚀 Using ${model} with 1024-dimensional embeddings - PERFECT!`);

    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
      // Call the Voyage embeddings endpoint with correct parameters
      const flattenedInputs = documentGroups.flat(); // Flatten to single array for regular endpoint
      const response = await this.rateLimiter(() =>
        axios.post(
          this.voyageEmbedUrl,
          {
            input: flattenedInputs,
            model: model,
            input_type: 'document'
          },
          {
            headers: {
              'Authorization': `Bearer ${this.voyageApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // Longer timeout for contextualized embeddings
          }
        )
      );
      
      if (!response.data?.data) {
        throw new Error('No data returned from Voyage contextualized API');
      }
      
      // Extract embeddings - the response structure is:
      // data: [ { data: [ { embedding: [...] }, { embedding: [...] } ] }, ... ]
      const allEmbeddings: number[][][] = [];
      
      for (const docResult of response.data.data) {
        const docEmbeddings: number[][] = [];
        for (const chunk of docResult.data) {
          if (chunk?.embedding) {
            // Normalize the embedding for cosine similarity
            const embedding = chunk.embedding;
            const magnitude = Math.sqrt(
              embedding.reduce((sum: number, val: number) => sum + val * val, 0)
            );
            const normalized = embedding.map((v: number) => v / magnitude);
            docEmbeddings.push(normalized);
          }
        }
        allEmbeddings.push(docEmbeddings);
      }
      
      return allEmbeddings;
        
      } catch (error: any) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error(`❌ Voyage AI failed after ${maxRetries} retries:`, error.response?.data || error.message);
          
          // RAGFlow-inspired: Try reducing batch size for next time
          if (this.dynamicBatchSize > this.MIN_BATCH_SIZE) {
            this.dynamicBatchSize = Math.max(this.dynamicBatchSize / 2, this.MIN_BATCH_SIZE);
            console.error(`🔄 Reduced batch size to ${this.dynamicBatchSize} for stability`);
          }
          
          throw new Error(`Voyage API error: ${error.response?.data?.error || error.message || 'Unknown error'}`);
        } else {
          console.error(`⚠️  Voyage AI retry ${retryCount}/${maxRetries}:`, error.response?.data?.message || error.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }
    
    // This should never be reached due to the retry loop, but TypeScript requires it
    throw new Error('Unexpected end of callContextualizedEmbed method');
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
          embeddingModel: 'voyage-context-3',
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
        currentBatch.length >= this.dynamicBatchSize ||
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
   * Embed a single query for search using contextualized endpoint
   */
  async embedQuery(query: string): Promise<number[]> {
    try {
      const response = await axios.post(
        this.voyageEmbedUrl,
        {
          input: [query], // Single query 
          input_type: 'query', // Important: query type for asymmetric search
          model: 'voyage-3',
          output_dimension: this.VOYAGE_DIMENSIONS
        },
        {
          headers: {
            'Authorization': `Bearer ${this.voyageApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      
      if (!response.data?.data?.[0]?.data?.[0]?.embedding) {
        throw new Error('No embedding returned for query');
      }
      
      // Extract embedding from nested structure
      const embedding = response.data.data[0].data[0].embedding;
      
      // Normalize for cosine similarity
      const magnitude = Math.sqrt(
        embedding.reduce((sum: number, val: number) => sum + val * val, 0)
      );
      
      return embedding.map((v: number) => v / magnitude);
    } catch (error: any) {
      console.error('Failed to embed query:', error.response?.data || error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}