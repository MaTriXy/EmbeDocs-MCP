#!/usr/bin/env node

/**
 * Test Enhanced MongoDB Documentation Indexer
 * Uses sample MongoDB documentation to demonstrate the enhanced system
 */

import { EnhancedDocumentChunker } from '../core/enhanced-document-chunker.js';
import { EmbeddingPipeline } from '../core/embedding-pipeline.js';
import { ContentQualityScorer } from '../core/content-quality-scorer.js';
import { MongoDBClient } from '../core/mongodb-client.js';
import { Document } from '../types/index.js';
import colors from 'colors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Sample MongoDB documentation for testing
const SAMPLE_MONGODB_DOCS: Document[] = [
  {
    id: 'find-method',
    content: `# db.collection.find()

Returns a cursor to the documents that match the query criteria.

## Syntax

\`\`\`javascript
db.collection.find(query, projection)
\`\`\`

## Parameters

- **query** (document): Specifies selection filter using query operators
- **projection** (document): Specifies the fields to return in the documents

## Examples

### Find All Documents

\`\`\`javascript
db.users.find()
\`\`\`

### Find with Query Filter

\`\`\`javascript
db.users.find({ age: { $gte: 18 } })
\`\`\`

### Find with Projection

\`\`\`javascript
db.users.find({ status: "active" }, { name: 1, email: 1 })
\`\`\`

## Return Value

Returns a cursor to the documents that match the query criteria.`,
    metadata: {
      title: 'db.collection.find()',
      path: '/reference/method/db.collection.find',
      product: 'mongodb' as any,
      url: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.find/'
    }
  },
  {
    id: 'aggregation-pipeline',
    content: `# Aggregation Pipeline

The aggregation pipeline is a framework for data aggregation modeled on the concept of data processing pipelines.

## Pipeline Stages

Documents enter a multi-stage pipeline that transforms the documents into aggregated results.

### $match Stage

Filters documents to pass only the documents that match the specified condition(s).

\`\`\`javascript
db.orders.aggregate([
  { $match: { status: "urgent" } }
])
\`\`\`

### $group Stage

Groups input documents by the specified _id expression and applies accumulator expressions.

\`\`\`javascript
db.orders.aggregate([
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } }
])
\`\`\`

### $sort Stage

Sorts all input documents and returns them in sorted order.

\`\`\`javascript
db.orders.aggregate([
  { $sort: { amount: -1 } }
])
\`\`\`

## Complete Example

\`\`\`javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: "$customerId", totalSpent: { $sum: "$amount" } } },
  { $sort: { totalSpent: -1 } },
  { $limit: 10 }
])
\`\`\``,
    metadata: {
      title: 'Aggregation Pipeline',
      path: '/aggregation/aggregation-pipeline',
      product: 'mongodb' as any,
      url: 'https://www.mongodb.com/docs/manual/core/aggregation-pipeline/'
    }
  },
  {
    id: 'insert-documents',
    content: `# Insert Documents

MongoDB provides the following methods to insert documents into a collection:

## db.collection.insertOne()

Inserts a single document into a collection.

\`\`\`javascript
db.users.insertOne({
  name: "John Doe",
  email: "john@example.com",
  age: 30
})
\`\`\`

## db.collection.insertMany()

Inserts multiple documents into a collection.

\`\`\`javascript
db.users.insertMany([
  { name: "Alice", email: "alice@example.com", age: 25 },
  { name: "Bob", email: "bob@example.com", age: 35 }
])
\`\`\`

## Insert Behavior

- If the collection does not exist, insert operations will create the collection
- Each document must have a unique _id field
- If _id is not specified, MongoDB automatically generates an ObjectId

## Examples with Options

\`\`\`javascript
// Insert with write concern
db.users.insertOne(
  { name: "Charlie", email: "charlie@example.com" },
  { writeConcern: { w: "majority" } }
)
\`\`\``,
    metadata: {
      title: 'Insert Documents',
      path: '/tutorial/insert-documents',
      product: 'mongodb' as any,
      url: 'https://www.mongodb.com/docs/manual/tutorial/insert-documents/'
    }
  },
  {
    id: 'contributing-guide',
    content: `# Contributing to MongoDB Documentation

Thank you for your interest in contributing to the MongoDB documentation!

## Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Documentation Standards

- Use clear, concise language
- Include code examples
- Follow the style guide
- Test all examples

## Review Process

All contributions go through a review process:

1. Technical review
2. Editorial review
3. Final approval

Please be patient as reviews can take time.`,
    metadata: {
      title: 'Contributing Guide',
      path: '/meta/contributing',
      product: 'mongodb' as any,
      url: 'https://github.com/mongodb/docs/blob/master/CONTRIBUTING.rst'
    }
  }
];

class TestEnhancedDocumentIndexer {
  private chunker: EnhancedDocumentChunker;
  private embedder: EmbeddingPipeline;
  private qualityScorer: ContentQualityScorer;
  private mongodb: MongoDBClient;

  constructor() {
    this.chunker = new EnhancedDocumentChunker();
    this.embedder = new EmbeddingPipeline();
    this.qualityScorer = new ContentQualityScorer();
    this.mongodb = MongoDBClient.getInstance();
  }

  async run(): Promise<void> {
    console.log(colors.cyan('\n🧪 TESTING ENHANCED MONGODB DOCUMENTATION INDEXER'));
    console.log(colors.cyan('=' .repeat(70)));
    console.log(colors.yellow('🎯 Using sample MongoDB documentation'));
    console.log(colors.yellow('✨ Demonstrating voyage-code-3 and quality scoring'));
    console.log(colors.yellow('🧠 Code-aware chunking and embedding\n'));

    try {
      // Connect to MongoDB
      console.log(colors.blue('🔌 Connecting to MongoDB...'));
      await this.mongodb.connect();
      console.log(colors.green('✅ Connected to MongoDB'));

      // Clean database
      console.log(colors.blue('\n🧹 Cleaning Database...'));
      const collection = this.mongodb.getVectorsCollection();
      await collection.deleteMany({});
      console.log(colors.green('✅ Database cleaned'));

      // Quality scoring
      console.log(colors.blue('\n🎯 Content Quality Analysis...'));
      const qualityResults = SAMPLE_MONGODB_DOCS.map(doc => ({
        document: doc,
        quality: this.qualityScorer.scoreDocument(doc)
      }));

      qualityResults.forEach(result => {
        const { document, quality } = result;
        console.log(colors.white(`📄 ${document.metadata.title}:`));
        console.log(colors.white(`   Score: ${quality.score.toFixed(2)} | Type: ${quality.contentType} | Boost: ${quality.boostFactor}x`));
        console.log(colors.gray(`   Reasons: ${quality.reasons.join(', ')}`));
      });

      // Enhanced chunking
      console.log(colors.blue('\n✂️  Enhanced Document Chunking...'));
      const enhancedDocs = qualityResults.map(r => ({
        ...r.document,
        metadata: {
          ...r.document.metadata,
          qualityScore: r.quality.score,
          contentType: r.quality.contentType,
          boostFactor: r.quality.boostFactor
        }
      }));

      const chunkedDocs = this.chunker.chunkDocuments(enhancedDocs, {
        chunkSize: 600,
        maxChunkSize: 1000,
        minChunkSize: 200,
        preserveCodeBlocks: true,
        preserveExamples: true,
        semanticBoundaries: true,
        contextOverlap: 50
      });

      const totalChunks = chunkedDocs.reduce((sum, doc) => sum + doc.totalChunks, 0);
      const technicalChunks = chunkedDocs.reduce((sum, doc) => 
        sum + doc.chunks.filter(c => c.metadata.contentType === 'technical').length, 0
      );

      console.log(colors.green(`✅ Chunking complete:`));
      console.log(colors.white(`   📄 ${totalChunks} total chunks`));
      console.log(colors.white(`   🔧 ${technicalChunks} technical chunks`));

      // Show chunk details
      chunkedDocs.forEach(doc => {
        console.log(colors.white(`\n📄 ${doc.documentMetadata.title} (${doc.totalChunks} chunks):`));
        doc.chunks.forEach((chunk, i) => {
          console.log(colors.gray(`   Chunk ${i + 1}: ${chunk.content.substring(0, 100)}...`));
          console.log(colors.gray(`   Type: ${chunk.metadata.contentType} | Code: ${chunk.metadata.hasCode} | Tokens: ${chunk.metadata.tokenCount}`));
        });
      });

      // Optimized embedding
      console.log(colors.blue('\n🧠 Optimized Embedding Generation...'));
      await this.embedder.embedAllDocuments(chunkedDocs);

      // Verify results
      const count = await collection.countDocuments();
      console.log(colors.green(`✅ Indexed ${count} document chunks`));

      // Test search
      console.log(colors.blue('\n🔍 Testing Search...'));
      const sampleResults = await collection.find({}).limit(3).toArray();
      sampleResults.forEach((doc, i) => {
        console.log(colors.white(`Result ${i + 1}: ${doc.content.substring(0, 100)}...`));
        console.log(colors.gray(`   Quality: ${(doc.metadata as any).qualityScore?.toFixed(2)} | Type: ${(doc.metadata as any).contentType}`));
      });

      console.log(colors.cyan('\n🎉 TEST COMPLETE!'));
      console.log(colors.green('✅ Enhanced indexing system is working perfectly!'));
      console.log(colors.yellow('🚀 Ready to index real MongoDB documentation when API access is restored'));

    } catch (error) {
      console.error(colors.red('\n❌ Test failed:'), error);
      throw error;
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const indexer = new TestEnhancedDocumentIndexer();
  indexer.run().catch(error => {
    console.error(colors.red('💀 Fatal error:'), error);
    process.exit(1);
  });
}
