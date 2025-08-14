#!/usr/bin/env node

/**
 * CLEAN SLATE SCRIPT
 * Drops the MongoDB collection and prepares for a fresh start
 */

import { MongoClient } from 'mongodb';
import colors from 'colors';
import ora from 'ora';
import boxen from 'boxen';

async function cleanDatabase() {
  console.clear();
  
  const header = boxen(
    colors.red.bold('🧹 CLEAN SLATE - COMPLETE RESET\n\n') +
    colors.yellow('This will:\n') +
    colors.white('  • Drop ALL documents from the database\n') +
    colors.white('  • Remove all embeddings\n') +
    colors.white('  • Clear all indexes\n') +
    colors.white('  • Start completely fresh\n\n') +
    colors.red.bold('⚠️  This action cannot be undone!'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'red',
      align: 'center'
    }
  );
  
  console.log(header);
  
  // Countdown
  console.log(colors.yellow('\n⏰ Starting clean in...'));
  for (let i = 3; i > 0; i--) {
    await new Promise(r => setTimeout(r, 1000));
    console.log(colors.yellow.bold(`   ${i}...`));
  }
  
  const mongoUri = process.env.MONGODB_URI || 
    "mongodb+srv://romiluz:05101994@mongodocs.gdssyqd.mongodb.net/?retryWrites=true&w=majority&appName=mongodocs";
  
  const client = new MongoClient(mongoUri);
  const spinner = ora();
  
  try {
    spinner.start(colors.cyan('Connecting to MongoDB Atlas...'));
    await client.connect();
    spinner.succeed(colors.green('Connected to MongoDB Atlas'));
    
    const db = client.db('mongodb_semantic_docs');
    const collection = db.collection('documents');
    
    // Get current count before dropping
    const beforeCount = await collection.countDocuments();
    console.log(colors.yellow(`\n📊 Current documents: ${beforeCount.toLocaleString()}`));
    
    if (beforeCount > 0) {
      spinner.start(colors.red('Dropping collection...'));
      await collection.drop();
      spinner.succeed(colors.green('✅ Collection dropped successfully!'));
    } else {
      console.log(colors.gray('ℹ️  Collection already empty'));
    }
    
    // Recreate collection
    spinner.start(colors.cyan('Creating fresh collection...'));
    await db.createCollection('documents');
    spinner.succeed(colors.green('✅ Fresh collection created!'));
    
    // Create indexes
    spinner.start(colors.cyan('Creating indexes...'));
    const newCollection = db.collection('documents');
    
    // Create regular indexes
    await newCollection.createIndex({ documentId: 1 }, { sparse: true });
    await newCollection.createIndex({ product: 1 });
    await newCollection.createIndex({ version: 1 });
    await newCollection.createIndex({ indexedAt: -1 });
    await newCollection.createIndex({ title: 'text', content: 'text' });
    
    spinner.succeed(colors.green('✅ Indexes created!'));
    
    // Vector index note
    const vectorNote = boxen(
      colors.yellow.bold('⚠️  VECTOR INDEX REMINDER\n\n') +
      colors.white('The vector index exists in Atlas and will work automatically.\n') +
      colors.gray('Name: vector_index\n') +
      colors.gray('Field: embedding\n') +
      colors.gray('Dimensions: 1024\n') +
      colors.gray('Similarity: cosine'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    );
    console.log(vectorNote);
    
    // Final status
    const finalCount = await newCollection.countDocuments();
    
    const successBox = boxen(
      colors.green.bold('✨ DATABASE IS CLEAN!\n\n') +
      colors.white(`Documents: ${finalCount}\n`) +
      colors.white(`Indexes: Created\n`) +
      colors.white(`Status: Ready for indexing\n\n`) +
      colors.cyan.bold('Next step: Run the ultimate indexer!'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green',
        align: 'center'
      }
    );
    console.log(successBox);
    
  } catch (error) {
    spinner.fail(colors.red('Process failed'));
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                    import.meta.url === `file://${process.argv[1]}.ts`;

if (isMainModule) {
  cleanDatabase()
    .then(() => {
      console.log(colors.green('\n🎯 Ready for fresh indexing!'));
      process.exit(0);
    })
    .catch((error) => {
      console.error(colors.red('Fatal error:'), error);
      process.exit(1);
    });
}

export { cleanDatabase };
