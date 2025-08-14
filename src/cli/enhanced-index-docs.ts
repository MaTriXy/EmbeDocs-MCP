#!/usr/bin/env node

/**
 * Enhanced MongoDB Documentation Indexer
 * Optimized for voyage-code-3 and rerank-2.5 with content quality scoring
 */

import { DocumentFetcher } from '../core/document-fetcher.js';
import { EnhancedDocumentChunker } from '../core/enhanced-document-chunker.js';
import { EmbeddingPipeline } from '../core/embedding-pipeline.js';
import { ContentQualityScorer, QualityScore } from '../core/content-quality-scorer.js';
import { MongoDBClient } from '../core/mongodb-client.js';
import { Document } from '../types/index.js';
import colors from 'colors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface IndexingStats {
  totalDocuments: number;
  filteredDocuments: number;
  totalChunks: number;
  technicalChunks: number;
  averageQualityScore: number;
  processingTime: number;
}

class EnhancedDocumentIndexer {
  private fetcher: DocumentFetcher;
  private chunker: EnhancedDocumentChunker;
  private embedder: EmbeddingPipeline;
  private qualityScorer: ContentQualityScorer;
  private mongodb: MongoDBClient;

  constructor() {
    this.fetcher = new DocumentFetcher();
    this.chunker = new EnhancedDocumentChunker();
    this.embedder = new EmbeddingPipeline();
    this.qualityScorer = new ContentQualityScorer();
    this.mongodb = MongoDBClient.getInstance();
  }

  /**
   * Run the complete enhanced indexing pipeline
   */
  async run(): Promise<void> {
    console.log(colors.cyan('\n🚀 ENHANCED MONGODB DOCUMENTATION INDEXER'));
    console.log(colors.cyan('=' .repeat(60)));
    console.log(colors.yellow('✨ Optimized for voyage-code-3 and rerank-2.5'));
    console.log(colors.yellow('🎯 Content quality scoring and filtering'));
    console.log(colors.yellow('🧠 Code-aware chunking and embedding\n'));

    const startTime = Date.now();
    let stats: IndexingStats = {
      totalDocuments: 0,
      filteredDocuments: 0,
      totalChunks: 0,
      technicalChunks: 0,
      averageQualityScore: 0,
      processingTime: 0
    };

    try {
      // Step 0: Connect to MongoDB
      console.log(colors.blue('\n🔌 STEP 0: Connecting to MongoDB'));
      await this.mongodb.connect();
      console.log(colors.green('✅ Connected to MongoDB'));

      // Step 1: Clean existing data
      await this.cleanDatabase();

      // Step 2: Fetch documents with enhanced filtering
      console.log(colors.blue('\n📚 STEP 2: Fetching MongoDB Documentation'));
      console.log(colors.gray('Enhanced filtering: Excluding meta-docs, build files, etc.'));
      
      const documents = await this.fetcher.fetchAllDocumentation();
      stats.totalDocuments = documents.length;
      console.log(colors.green(`✅ Fetched ${documents.length} documents`));

      // Step 3: Quality scoring and filtering
      console.log(colors.blue('\n🎯 STEP 3: Content Quality Analysis'));
      const qualityResults: Array<{document: Document, quality: QualityScore}> = documents.map((doc: Document) => ({
        document: doc,
        quality: this.qualityScorer.scoreDocument(doc)
      }));

      // Filter out very low quality content
      const filteredResults = qualityResults.filter((r: {document: Document, quality: QualityScore}) => r.quality.score > 0.2);
      stats.filteredDocuments = filteredResults.length;
      stats.averageQualityScore = filteredResults.reduce((sum: number, r: {document: Document, quality: QualityScore}) => sum + r.quality.score, 0) / filteredResults.length;

      console.log(colors.green(`✅ Quality analysis complete:`));
      console.log(colors.white(`   📊 ${stats.totalDocuments} total → ${stats.filteredDocuments} after filtering`));
      console.log(colors.white(`   ⭐ Average quality score: ${stats.averageQualityScore.toFixed(2)}`));

      const technicalDocs = filteredResults.filter((r: {document: Document, quality: QualityScore}) => r.quality.contentType === 'technical').length;
      const conceptualDocs = filteredResults.filter((r: {document: Document, quality: QualityScore}) => r.quality.contentType === 'conceptual').length;
      const metaDocs = filteredResults.filter((r: {document: Document, quality: QualityScore}) => r.quality.contentType === 'meta').length;

      console.log(colors.white(`   🔧 Technical: ${technicalDocs}, 💭 Conceptual: ${conceptualDocs}, 📋 Meta: ${metaDocs}`));

      // Step 4: Enhanced chunking
      console.log(colors.blue('\n✂️  STEP 4: Enhanced Document Chunking'));
      console.log(colors.gray('Code-aware chunking with semantic boundaries'));

      const filteredDocs: Document[] = filteredResults.map((r: {document: Document, quality: QualityScore}) => ({
        ...r.document,
        metadata: {
          ...r.document.metadata,
          qualityScore: r.quality.score,
          contentType: r.quality.contentType,
          boostFactor: r.quality.boostFactor
        }
      }));

      const chunkedDocs = this.chunker.chunkDocuments(filteredDocs, {
        chunkSize: 600,        // Optimal for voyage-code-3
        maxChunkSize: 1000,
        minChunkSize: 200,
        preserveCodeBlocks: true,
        preserveExamples: true,
        semanticBoundaries: true,
        contextOverlap: 50
      });

      stats.totalChunks = chunkedDocs.reduce((sum, doc) => sum + doc.totalChunks, 0);
      stats.technicalChunks = chunkedDocs.reduce((sum, doc) =>
        sum + doc.chunks.filter(c => c.metadata.contentType === 'technical').length, 0
      );

      console.log(colors.green(`✅ Chunking complete:`));
      console.log(colors.white(`   📄 ${stats.totalChunks} total chunks`));
      console.log(colors.white(`   🔧 ${stats.technicalChunks} technical chunks (voyage-code-3)`));
      console.log(colors.white(`   💭 ${stats.totalChunks - stats.technicalChunks} general chunks (voyage-3)`));

      // Step 5: Optimized embedding with model selection
      console.log(colors.blue('\n🧠 STEP 5: Optimized Embedding Generation'));
      console.log(colors.gray('voyage-code-3 for technical content, voyage-3 for general content'));

      await this.embedder.embedAllDocuments(chunkedDocs);

      // Step 6: Create vector search index
      console.log(colors.blue('\n🔍 STEP 6: Vector Search Index'));
      await this.createVectorSearchIndex();

      // Final stats
      stats.processingTime = Date.now() - startTime;
      this.printFinalStats(stats);

    } catch (error) {
      console.error(colors.red('\n❌ Indexing failed:'), error);
      throw error;
    }
  }

  private async cleanDatabase(): Promise<void> {
    console.log(colors.blue('\n🧹 STEP 1: Cleaning Database'));
    
    try {
      const collection = this.mongodb.getVectorsCollection();
      const count = await collection.countDocuments();
      
      if (count > 0) {
        console.log(colors.yellow(`⚠️  Found ${count} existing documents`));
        await collection.deleteMany({});
        console.log(colors.green('✅ Database cleaned'));
      } else {
        console.log(colors.green('✅ Database already clean'));
      }
    } catch (error) {
      console.error(colors.red('❌ Failed to clean database:'), error);
      throw error;
    }
  }

  private async createVectorSearchIndex(): Promise<void> {
    console.log(colors.gray('Creating vector search index for optimal performance...'));
    
    try {
      // Note: Vector search index creation requires MongoDB Atlas UI or API
      // This is a placeholder for the index creation logic
      console.log(colors.yellow('⚠️  Vector search index must be created in MongoDB Atlas'));
      console.log(colors.white('   Index name: semantic_search'));
      console.log(colors.white('   Field: embedding'));
      console.log(colors.white('   Dimensions: 1024'));
      console.log(colors.white('   Similarity: cosine'));
    } catch (error) {
      console.error(colors.red('❌ Index creation guidance failed:'), error);
    }
  }

  private printFinalStats(stats: IndexingStats): void {
    const minutes = Math.floor(stats.processingTime / 60000);
    const seconds = Math.floor((stats.processingTime % 60000) / 1000);

    console.log(colors.cyan('\n🎉 INDEXING COMPLETE!'));
    console.log(colors.cyan('=' .repeat(40)));
    console.log(colors.green(`✅ Documents processed: ${stats.filteredDocuments}/${stats.totalDocuments}`));
    console.log(colors.green(`✅ Chunks created: ${stats.totalChunks}`));
    console.log(colors.green(`✅ Technical chunks: ${stats.technicalChunks} (${((stats.technicalChunks/stats.totalChunks)*100).toFixed(1)}%)`));
    console.log(colors.green(`✅ Average quality: ${stats.averageQualityScore.toFixed(2)}/1.0`));
    console.log(colors.green(`✅ Processing time: ${minutes}m ${seconds}s`));
    
    console.log(colors.yellow('\n🚀 READY FOR ENHANCED SEARCH!'));
    console.log(colors.white('   • voyage-code-3 embeddings for technical content'));
    console.log(colors.white('   • rerank-2.5 with instruction-following'));
    console.log(colors.white('   • Quality-boosted search results'));
    console.log(colors.white('   • Code-aware chunking and ranking'));
    
    console.log(colors.cyan('\n🔥 Start the MCP server: mongodocs-mcp'));
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const indexer = new EnhancedDocumentIndexer();
  indexer.run().catch(error => {
    console.error(colors.red('💀 Fatal error:'), error);
    process.exit(1);
  });
}
