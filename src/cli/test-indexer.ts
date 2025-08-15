#!/usr/bin/env node

/**
 * TEST INDEXER - Minimal set for verification
 * Tests the complete flow with 3 repos only
 */

import { MongoClient, Db, Collection } from 'mongodb';
import axios from 'axios';
import ora from 'ora';
import dotenv from 'dotenv';
import colors from 'colors';
import { simpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

dotenv.config();

class TestIndexer {
  private mongoClient: MongoClient;
  private voyageApiKey: string;
  private voyageContextualUrl = 'https://api.voyageai.com/v1/contextualizedembeddings';
  private readonly VOYAGE_DIMENSIONS = 2048;
  private db!: Db;
  private collection!: Collection<any>;
  
  // TEST SET: 3 diverse repos
  private readonly TEST_SOURCES = [
    { 
      type: 'github' as const, 
      name: 'MongoDB Manual (Small Sample)', 
      repo: 'mongodb/docs', 
      branch: 'master', 
      product: 'manual', 
      version: '8.0',
      maxFiles: 10 // Limit files for testing
    },
    { 
      type: 'github' as const, 
      name: 'GenAI Showcase (README only)', 
      repo: 'mongodb-developer/GenAI-Showcase', 
      branch: 'main', 
      product: 'genai',
      version: 'latest',
      maxFiles: 5
    },
    { 
      type: 'github' as const, 
      name: 'Voyage Python SDK (Docs)', 
      repo: 'voyage-ai/voyageai-python', 
      branch: 'main', 
      product: 'voyage',
      version: 'latest',
      maxFiles: 5
    }
  ];
  
  constructor() {
    const mongoUri = process.env.MONGODB_URI!;
    const voyageKey = process.env.VOYAGE_API_KEY!;
    
    if (!mongoUri || !voyageKey) {
      throw new Error('Missing environment variables');
    }
    
    this.mongoClient = new MongoClient(mongoUri);
    this.voyageApiKey = voyageKey;
  }

  async run() {
    console.log(colors.cyan.bold('\n🧪 TEST INDEXER - Verifying Complete Flow\n'));
    
    const spinner = ora();
    const startTime = Date.now();
    
    try {
      // Connect
      spinner.start('Connecting to MongoDB...');
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('mongodb_semantic_docs');
      this.collection = this.db.collection('documents');
      spinner.succeed('Connected to MongoDB');
      
      // Check initial state
      const initialCount = await this.collection.countDocuments();
      console.log(colors.yellow(`📊 Initial documents: ${initialCount}`));
      
      let totalIndexed = 0;
      
      // Process each test source
      for (const source of this.TEST_SOURCES) {
        console.log(colors.cyan(`\n📦 Processing: ${source.name}`));
        
        // Clone repo
        const repoPath = path.join('test-repos', source.repo.replace('/', '_'));
        spinner.start('Cloning repository...');
        
        try {
          await fs.rm(repoPath, { recursive: true, force: true });
          await fs.mkdir(path.dirname(repoPath), { recursive: true });
          
          const git = simpleGit();
          await git.clone(
            `https://github.com/${source.repo}.git`,
            repoPath,
            ['--branch', source.branch, '--depth', '1']
          );
          spinner.succeed('Repository cloned');
        } catch (error) {
          spinner.fail('Clone failed');
          continue;
        }
        
        // Find markdown files
        const files = await this.findMarkdownFiles(repoPath, source.maxFiles);
        console.log(colors.gray(`  Found ${files.length} files`));
        
        // Process files
        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            
            // Create chunks (simple splitting for test)
            const chunks = this.createChunks(content, 500);
            
            for (const chunk of chunks) {
              // Generate embedding
              spinner.start('Generating embedding...');
              const response = await axios.post(
                this.voyageContextualUrl,
                {
                  inputs: [[chunk]], // Wrap in double array for contextualized
                  input_type: 'document',
                  model: 'voyage-context-3',
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
              
              if (response.data?.data?.[0]?.data?.[0]?.embedding) {
                const embedding = response.data.data[0].data[0].embedding;
                
                // Normalize embedding
                const magnitude = Math.sqrt(
                  embedding.reduce((sum: number, val: number) => sum + val * val, 0)
                );
                const normalized = embedding.map((v: number) => v / magnitude);
                
                // Store in MongoDB
                await this.collection.insertOne({
                  content: chunk,
                  embedding: normalized,
                  documentId: `${source.product}_test_${createHash('md5').update(chunk).digest('hex').substring(0, 8)}`,
                  product: source.product,
                  version: source.version,
                  title: path.basename(file),
                  embeddingModel: 'voyage-context-3',
                  indexedAt: new Date()
                });
                
                totalIndexed++;
                spinner.succeed(`Indexed chunk ${totalIndexed}`);
              }
            }
          } catch (error) {
            console.error(colors.red(`  Failed: ${error}`));
          }
        }
      }
      
      // Final stats
      const finalCount = await this.collection.countDocuments();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      console.log(colors.green.bold('\n✅ TEST INDEXING COMPLETE'));
      console.log(colors.white(`  Documents indexed: ${totalIndexed}`));
      console.log(colors.white(`  Total in database: ${finalCount}`));
      console.log(colors.white(`  Time elapsed: ${elapsed}s`));
      console.log(colors.white(`  Rate: ${(totalIndexed / elapsed).toFixed(1)} docs/sec`));
      
      // Cleanup test repos
      await fs.rm('test-repos', { recursive: true, force: true });
      
    } catch (error) {
      spinner.fail('Test failed');
      console.error(error);
    } finally {
      await this.mongoClient.close();
    }
  }
  
  private async findMarkdownFiles(dir: string, maxFiles: number): Promise<string[]> {
    const files: string[] = [];
    
    async function walk(currentDir: string) {
      if (files.length >= maxFiles) return;
      
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;
          
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore
      }
    }
    
    await walk(dir);
    return files;
  }
  
  private createChunks(content: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}

// Run
if (import.meta.url === `file://${process.argv[1]}` || 
    import.meta.url === `file://${process.argv[1]}.ts`) {
  const indexer = new TestIndexer();
  indexer.run().catch(console.error);
}

export { TestIndexer };
