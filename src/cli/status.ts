#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import colors from 'colors';

// Load environment variables
dotenv.config();

async function checkStatus() {
  console.log(colors.cyan('\n📊 MONGODB MCP STATUS CHECK'));
  console.log(colors.cyan('=' .repeat(50)));
  
  try {
    // Connect to MongoDB
    console.log(colors.yellow('\n🔌 Connecting to MongoDB...'));
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    
    const cluster = process.env.MONGODB_URI!.split('@')[1]?.split('/')[0] || 'Unknown';
    console.log(colors.green(`✅ Connected to: ${cluster}`));
    
    // Check database and collections
    const dbName = process.env.MONGODB_DATABASE || 'mongodb_semantic_docs';
    const collectionName = process.env.MONGODB_COLLECTION || 'documents';
    
    console.log(colors.yellow(`\n📚 Checking database: ${dbName}`));
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log(colors.red('❌ Database is empty!'));
      console.log(colors.yellow('💡 Run: mongodocs-index to populate the database'));
      await client.close();
      return;
    }
    
    console.log(colors.green(`✅ Found ${collections.length} collections:`));
    
    let totalDocuments = 0;
    let hasEmbeddings = false;
    
    for (const collection of collections) {
      const coll = db.collection(collection.name);
      const count = await coll.countDocuments();
      totalDocuments += count;
      
      const icon = collection.name === collectionName ? '🎯' : '📁';
      const status = collection.name === collectionName ? ' (ACTIVE)' : '';
      console.log(colors.white(`  ${icon} ${collection.name}: ${count} documents${status}`));
      
      if (count > 0 && collection.name === collectionName) {
        const sample = await coll.findOne();
        if (sample?.embedding) {
          hasEmbeddings = true;
          console.log(colors.green(`     ✅ Has embeddings (${sample.embedding.length} dimensions)`));
        } else {
          console.log(colors.red(`     ❌ No embeddings found`));
        }
      }
    }
    
    // Check vector search index
    console.log(colors.yellow('\n🔍 Checking vector search index...'));
    try {
      const collection = db.collection(collectionName);
      const indexes = await collection.listSearchIndexes().toArray();
      const vectorIndex = indexes.find((i: any) => i.name === 'semantic_search');
      
      if (vectorIndex) {
        const indexStatus = (vectorIndex as any).status || 'UNKNOWN';
        const status = indexStatus === 'READY' ? colors.green('READY') : colors.yellow(indexStatus);
        console.log(colors.white(`  📊 Vector index: ${status}`));
      } else {
        console.log(colors.red('  ❌ No vector search index found'));
        console.log(colors.yellow('  💡 Create index in MongoDB Atlas for vector search'));
      }
    } catch (error) {
      console.log(colors.red('  ❌ Cannot check vector index (may not be supported)'));
    }
    
    // Environment check
    console.log(colors.yellow('\n⚙️  Environment Configuration:'));
    console.log(colors.white(`  📍 Database: ${dbName}`));
    console.log(colors.white(`  📁 Collection: ${collectionName}`));
    console.log(colors.white(`  🔑 Voyage API: ${process.env.VOYAGE_API_KEY ? '✅ Set' : '❌ Missing'}`));
    
    // Overall status
    console.log(colors.cyan('\n🎯 OVERALL STATUS:'));
    
    if (totalDocuments === 0) {
      console.log(colors.red('❌ NOT READY - No documents indexed'));
      console.log(colors.yellow('   Run: mongodocs-index'));
    } else if (!hasEmbeddings) {
      console.log(colors.red('❌ NOT READY - Documents exist but no embeddings'));
      console.log(colors.yellow('   Run: mongodocs-index to generate embeddings'));
    } else {
      console.log(colors.green('✅ READY FOR MCP!'));
      console.log(colors.white(`   📊 ${totalDocuments} documents with embeddings`));
      console.log(colors.white('   🚀 Run: mongodocs-mcp to start server'));
    }
    
    await client.close();
    
  } catch (error) {
    console.log(colors.red('\n❌ Status check failed:'));
    console.log(colors.red(`   ${error instanceof Error ? error.message : 'Unknown error'}`));
    
    if (error instanceof Error && error.message.includes('authentication')) {
      console.log(colors.yellow('\n💡 Check your MONGODB_URI credentials'));
    }
    
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkStatus().catch(error => {
    console.error(colors.red('❌ Fatal error:'), error);
    process.exit(1);
  });
}
