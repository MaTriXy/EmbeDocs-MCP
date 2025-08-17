#!/usr/bin/env node

/**
 * ULTRA-CLEAN CLI - Just a thin wrapper around core services
 * No business logic here!
 */

import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { config } from './config/index.js';
import { Indexer } from './core/indexer.js';
import { EmbeddingService } from './core/embeddings.js';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

async function main() {
  console.clear();
  
  // Show config
  const configBox = boxen(
    chalk.cyan.bold('🚀 MongoDB Documentation Indexer\n\n') +
    chalk.white(`Model: ${chalk.green(config.embedding.model)}\n`) +
    chalk.white(`Dimensions: ${chalk.green(config.embedding.dimensions)}\n`) +
    chalk.white(`Repositories: ${chalk.green(config.repositories.length)}\n`) +
    chalk.white(`Batch Size: ${chalk.green(config.embedding.maxBatchSize)}`),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan'
    }
  );
  
  console.log(configBox);
  
  // Check environment
  if (!process.env.MONGODB_URI || !process.env.VOYAGE_API_KEY) {
    console.error(chalk.red('\n❌ Missing environment variables!'));
    console.log(chalk.yellow('\nRequired:'));
    console.log('  MONGODB_URI=your-connection-string');
    console.log('  VOYAGE_API_KEY=your-api-key');
    process.exit(1);
  }
  
  const spinner = ora();
  const indexer = new Indexer();
  
  // Set up progress reporting
  indexer.onProgress((progress) => {
    spinner.text = chalk.cyan(
      `${progress.phase}: ${progress.currentRepo} ` +
      `(${progress.current}/${progress.total})`
    );
  });
  
  try {
    // Parse command
    const command = process.argv[2];
    
    switch (command) {
      case 'clean':
        spinner.start('Cleaning database...');
        await indexer.clean();
        spinner.succeed('Database cleaned');
        break;
        
      case 'stats':
        spinner.start('Getting statistics...');
        const stats = await indexer.getStats();
        spinner.succeed('Statistics retrieved');
        
        console.log(chalk.cyan('\n📊 Database Statistics:'));
        console.log(chalk.white(`  Documents: ${stats.totalDocuments}`));
        console.log(chalk.white(`  Products: ${stats.products.join(', ')}`));
        console.log(chalk.white(`  Models: ${stats.models.join(', ')}`));
        console.log(chalk.white(`  Expected: ${stats.expectedModel} (${stats.expectedDimensions}d)`));
        break;
        
      case 'test':
        // Test embedding service
        spinner.start('Testing embedding service...');
        const embedService = EmbeddingService.getInstance();
        const testResult = await embedService.embedQuery('test query');
        spinner.succeed('Embedding service working');
        
        console.log(chalk.green('\n✅ Embedding Test Result:'));
        console.log(chalk.white(`  Model: ${testResult.model}`));
        console.log(chalk.white(`  Dimensions: ${testResult.dimensions}`));
        console.log(chalk.white(`  Expected: ${config.embedding.dimensions}`));
        console.log(chalk.white(`  Match: ${testResult.dimensions === config.embedding.dimensions ? '✅' : '❌'}`));
        break;
        
      case 'update':
        // Smart update - only re-index changed files
        spinner.start('Checking for repository updates...');
        await indexer.update();
        spinner.succeed('Update complete');
        
        // Show final stats
        const updateStats = await indexer.getStats();
        console.log(chalk.cyan('\n📊 Updated Database:'));
        console.log(chalk.white(`  Total Documents: ${updateStats.totalDocuments}`));
        console.log(chalk.white(`  Products: ${updateStats.products.join(', ')}`));
        break;
        
      default:
        // Default: run indexing
        spinner.start('Starting indexing...');
        await indexer.index();
        spinner.succeed('Indexing complete');
        
        // Show final stats
        const finalStats = await indexer.getStats();
        
        const successBox = boxen(
          chalk.green.bold('✅ Indexing Complete!\n\n') +
          chalk.white(`Total Documents: ${chalk.yellow(finalStats.totalDocuments)}\n`) +
          chalk.white(`Model: ${chalk.green(finalStats.expectedModel)}\n`) +
          chalk.white(`Dimensions: ${chalk.green(finalStats.expectedDimensions)}`),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'double',
            borderColor: 'green'
          }
        );
        
        console.log(successBox);
    }
    
    process.exit(0);
    
  } catch (error) {
    spinner.fail('Process failed');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);