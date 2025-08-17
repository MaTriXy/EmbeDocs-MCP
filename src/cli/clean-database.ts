#!/usr/bin/env node

/**
 * CLEAN SLATE SCRIPT
 * Drops the MongoDB collection and prepares for a fresh start
 */

import { MongoClient } from 'mongodb';
import colors from 'colors';
import ora from 'ora';
import boxen from 'boxen';
import dotenv from 'dotenv';
import * as fs from 'fs/promises';

// Load environment variables
dotenv.config();

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
  
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error(colors.red('❌ Error: MONGODB_URI environment variable is required'));
    console.error(colors.yellow('Please set MONGODB_URI in your .env file or run: mongodocs-setup'));
    process.exit(1);
  }
  
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
    
    // Clean state files and local directories
    spinner.start(colors.cyan('Cleaning state files and directories...'));
    const stateFiles = [
      'indexing-state.json',
      'indexing-checkpoint.json', 
      '.indexing-progress'
    ];
    
    const directories = [
      'mongodb-docs'
    ];
    
    let cleanedFiles = 0;
    let cleanedDirs = 0;
    
    // Clean state files
    for (const file of stateFiles) {
      try {
        await fs.unlink(file);
        cleanedFiles++;
      } catch (error) {
        // File doesn't exist or already deleted - that's fine
      }
    }
    
    // Clean directories
    for (const dir of directories) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        cleanedDirs++;
      } catch (error) {
        // Directory doesn't exist or already deleted - that's fine
      }
    }
    
    const totalCleaned = cleanedFiles + cleanedDirs;
    if (totalCleaned > 0) {
      spinner.succeed(colors.green(`✅ Cleaned ${cleanedFiles} state files and ${cleanedDirs} directories!`));
    } else {
      spinner.succeed(colors.gray('✅ No state files or directories to clean'));
    }
    
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
