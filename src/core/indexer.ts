/**
 * SINGLE Indexer - Orchestrates the indexing process
 * Uses EmbeddingService and StorageService, no duplicate logic!
 */

import { simpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { EmbeddingService } from './embeddings.js';
import { StorageService, Document } from './storage.js';

export interface IndexingProgress {
  current: number;
  total: number;
  currentRepo: string;
  phase: 'cloning' | 'scanning' | 'processing' | 'embedding' | 'storing';
}

export class Indexer {
  private embeddingService: EmbeddingService;
  private storageService: StorageService;
  private progressCallback?: (progress: IndexingProgress) => void;
  
  constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    this.storageService = StorageService.getInstance();
  }
  
  /**
   * Set progress callback for UI updates
   */
  onProgress(callback: (progress: IndexingProgress) => void) {
    this.progressCallback = callback;
  }
  
  /**
   * Main indexing method - SIMPLE and CLEAN
   */
  async index(): Promise<void> {
    await this.storageService.connect();
    
    for (const repo of config.repositories) {
      await this.indexRepository(repo);
    }
  }
  
  /**
   * Clean the database
   */
  async clean(): Promise<void> {
    await this.storageService.connect();
    await this.storageService.clean();
    console.log('✅ Database cleaned');
  }
  
  /**
   * Index a single repository
   */
  private async indexRepository(repo: any): Promise<void> {
    this.updateProgress({ 
      phase: 'cloning', 
      currentRepo: repo.name,
      current: 0,
      total: 0
    });
    
    // Clone repository
    const repoPath = await this.cloneRepo(repo.repo, repo.branch);
    
    this.updateProgress({ phase: 'scanning', currentRepo: repo.name, current: 0, total: 0 });
    
    // Find all markdown files
    const files = await this.findMarkdownFiles(repoPath);
    
    let processed = 0;
    const totalFiles = files.length;
    
    // Process files in smaller batches to avoid token limits
    const fileBatchSize = 10; // Process fewer files at once
    
    for (let i = 0; i < files.length; i += fileBatchSize) {
      const batch = files.slice(i, i + fileBatchSize);
      
      this.updateProgress({
        phase: 'processing',
        currentRepo: repo.name,
        current: processed,
        total: totalFiles
      });
      
      // Process batch
      const documents = await this.processBatch(batch, repo);
      
      if (documents.length > 0) {
        this.updateProgress({
          phase: 'embedding',
          currentRepo: repo.name,
          current: processed,
          total: totalFiles
        });
        
        // Process embeddings in smaller chunks to avoid token limits
        const embeddingBatchSize = 8; // Even smaller batches for embeddings
        const allEmbeddings: any[] = [];
        
        for (let j = 0; j < documents.length; j += embeddingBatchSize) {
          const docBatch = documents.slice(j, j + embeddingBatchSize);
          const texts = docBatch.map(d => d.content);
          
          try {
            const embeddings = await this.embeddingService.embedDocuments(texts);
            allEmbeddings.push(...embeddings);
          } catch (error) {
            console.warn(`Failed to embed batch ${j}-${j + embeddingBatchSize}:`, error);
            // Create empty embeddings for failed batch
            for (let k = 0; k < docBatch.length; k++) {
              allEmbeddings.push({
                embedding: new Array(config.embedding.dimensions).fill(0),
                normalized: new Array(config.embedding.dimensions).fill(0),  
                dimensions: config.embedding.dimensions,
                model: 'failed'
              });
            }
          }
        }
        
        const embeddings = allEmbeddings;
        
        // Combine documents with embeddings
        const enrichedDocs = documents.map((doc, idx) => ({
          ...doc,
          embedding: embeddings[idx].normalized,
          embeddingModel: embeddings[idx].model,
          embeddingDimensions: embeddings[idx].dimensions,
          indexedAt: new Date()
        }));
        
        this.updateProgress({
          phase: 'storing',
          currentRepo: repo.name,
          current: processed,
          total: totalFiles
        });
        
        // Store in MongoDB - USING THE SERVICE
        await this.storageService.upsertDocuments(enrichedDocs);
      }
      
      processed += batch.length;
    }
    
    console.log(`✅ Indexed ${repo.name}: ${processed} files`);
  }
  
  /**
   * Clone or update repository
   */
  private async cloneRepo(repo: string, branch: string): Promise<string> {
    const repoPath = path.join('.repos', repo.replace('/', '_'));
    const git = simpleGit();
    
    try {
      await fs.access(repoPath);
      // Update existing
      await git.cwd(repoPath);
      await git.pull('origin', branch);
    } catch {
      // Clone new
      await fs.mkdir(path.dirname(repoPath), { recursive: true });
      await git.clone(
        `https://github.com/${repo}.git`,
        repoPath,
        ['--branch', branch, '--depth', '1']
      );
    }
    
    return repoPath;
  }
  
  /**
   * Find documentation files - COMPREHENSIVE search
   */
  private async findMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.md', '.markdown', '.mdx', '.rst', '.txt'];
    const maxDepth = 10; // Search deeper
    
    async function walk(currentDir: string, depth: number = 0) {
      if (depth > maxDepth) return;
      
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          // Skip common non-doc directories
          if (entry.isDirectory()) {
            const skipDirs = ['node_modules', '.git', 'build', 'dist', 'target', '.next', '.cache', 'coverage'];
            if (!skipDirs.includes(entry.name)) {
              await walk(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            // Check for documentation files
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              // Also check file size - skip huge files
              const stats = await fs.stat(fullPath);
              if (stats.size < 5_000_000) { // 5MB max
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }
    
    await walk(dir);
    console.log(`📄 Found ${files.length} documentation files`);
    return files;
  }
  
  /**
   * Process a batch of files into documents
   */
  private async processBatch(files: string[], repo: any): Promise<Omit<Document, 'embedding' | 'embeddingModel' | 'embeddingDimensions' | 'indexedAt'>[]> {
    const documents: any[] = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        // Skip empty or very small files
        if (content.length < 50) continue;
        
        const ext = path.extname(file).toLowerCase();
        let chunks: string[] = [];
        
        // Process based on file type
        if (ext === '.rst') {
          // reStructuredText - split by sections
          const sections = content.split(/\n={3,}\n|\n-{3,}\n|\n\*{3,}\n/);
          chunks = sections.filter(s => s.trim().length > 100);
        } else if (['.md', '.markdown', '.mdx'].includes(ext)) {
          // Markdown - split by headers
          const sections = content.split(/\n#{1,3}\s/);
          chunks = sections.filter(s => s.trim().length > 100);
        } else {
          // Default chunking
          chunks = this.chunkContent(content);
        }
        
        // Create documents from chunks
        chunks.forEach((chunk, idx) => {
          const docId = `${repo.product}_${repo.version}_${createHash('md5').update(chunk).digest('hex').substring(0, 8)}`;
          
          documents.push({
            documentId: docId,
            content: chunk.trim(),
            title: path.basename(file),
            product: repo.product,
            version: repo.version,
            metadata: {
              file: path.relative(process.cwd(), file),
              chunkIndex: idx,
              repo: repo.repo,
              fileType: ext.substring(1)
            }
          });
        });
      } catch (error) {
        console.warn(`Failed to process ${file}:`, error);
      }
    }
    
    return documents;
  }
  
  /**
   * Chunk content with overlap
   */
  private chunkContent(content: string): string[] {
    const chunks: string[] = [];
    const { chunkSize, chunkOverlap } = config.indexing;
    
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    let currentChunk = '';
    let overlap = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
        chunks.push(overlap + currentChunk);
        
        // Keep last part as overlap
        const words = currentChunk.split(' ');
        overlap = words.slice(-Math.floor(chunkOverlap / 10)).join(' ') + ' ';
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(overlap + currentChunk);
    }
    
    return chunks.map(c => c.trim()).filter(c => c.length > 100);
  }
  
  /**
   * Update progress
   */
  private updateProgress(progress: IndexingProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
  
  /**
   * Get statistics
   */
  async getStats() {
    await this.storageService.connect();
    return this.storageService.getStats();
  }
}