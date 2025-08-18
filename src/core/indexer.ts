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
import { AdvancedSemanticChunker } from './semantic-chunker.js';

export interface IndexingProgress {
  current: number;
  total: number;
  currentRepo: string;
  phase: 'cloning' | 'scanning' | 'processing' | 'embedding' | 'storing';
}

export class Indexer {
  private embeddingService: EmbeddingService;
  private storageService: StorageService;
  private advancedChunker: AdvancedSemanticChunker;
  private progressCallback?: (progress: IndexingProgress) => void;
  
  constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    this.storageService = StorageService.getInstance();
    this.advancedChunker = new AdvancedSemanticChunker();
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
   * Smart update - only re-index changed files
   */
  async update(): Promise<void> {
    await this.storageService.connect();
    
    console.log('🔄 Checking for updates in repositories...');
    
    for (const repo of config.repositories) {
      const repoPath = path.join('.repos', repo.repo.replace('/', '_'));
      
      try {
        // Check if repo exists
        await fs.access(repoPath);
        
        // Get current commit hash
        const git = simpleGit(repoPath);
        const oldHash = await git.revparse(['HEAD']);
        
        // Pull updates
        console.log(`📥 Pulling updates for ${repo.name}...`);
        await git.pull('origin', repo.branch);
        
        // Get new commit hash
        const newHash = await git.revparse(['HEAD']);
        
        if (oldHash === newHash) {
          console.log(`✅ ${repo.name} is up to date`);
          continue;
        }
        
        // Get list of changed files
        const diff = await git.diff([oldHash, newHash, '--name-only']);
        const changedFiles = diff.split('\n').filter(f => f);
        
        console.log(`📝 Found ${changedFiles.length} changed files in ${repo.name}`);
        
        // Re-index only changed documentation files
        const docsExtensions = ['.md', '.markdown', '.mdx', '.rst', '.txt'];
        const changedDocs = changedFiles.filter(file => 
          docsExtensions.some(ext => file.endsWith(ext))
        );
        
        if (changedDocs.length > 0) {
          console.log(`🔄 Re-indexing ${changedDocs.length} documentation files...`);
          await this.indexRepository(repo, changedDocs);
        }
        
      } catch (error) {
        // Repo doesn't exist, do full index
        console.log(`🆕 ${repo.name} not found locally, doing full index...`);
        await this.indexRepository(repo);
      }
    }
    
    console.log('✅ Update complete!');
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
   * @param repo - Repository configuration
   * @param specificFiles - Optional: only index these specific files
   */
  private async indexRepository(repo: any, specificFiles?: string[]): Promise<void> {
    this.updateProgress({ 
      phase: 'cloning', 
      currentRepo: repo.name,
      current: 0,
      total: 0
    });
    
    // Clone repository
    const repoPath = await this.cloneRepo(repo.repo, repo.branch);
    
    this.updateProgress({ phase: 'scanning', currentRepo: repo.name, current: 0, total: 0 });
    
    // Find all markdown files or use specific files
    const files = specificFiles 
      ? specificFiles.map(f => path.join(repoPath, f))
      : await this.findMarkdownFiles(repoPath);
    
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
        
        // Advanced semantic chunking based on file type and research
        if (ext === '.rst') {
          // reStructuredText - gradient method works well for structured docs
          chunks = await this.advancedChunker.chunkContent(content, 'gradient');
        } else if (['.md', '.markdown', '.mdx'].includes(ext)) {
          // Markdown - interquartile method optimal for technical docs (41.71 score)
          chunks = await this.advancedChunker.chunkContent(content, 'interquartile');
        } else if (ext === '.txt') {
          // Plain text - auto-select based on content analysis
          chunks = await this.advancedChunker.chunkContent(content, 'auto');
        } else {
          // Default - hybrid approach for unknown formats
          chunks = await this.advancedChunker.chunkContent(content, 'hybrid');
        }

        // Filter chunks with voyage-context-3 token limit constraints
        // Based on Harry-231's successful approach: min_chunk_size=100, no artificial max
        // TRUST THE SEMANTIC CHUNKER - it already filtered properly
        // Don't double-filter here as it causes data loss!
        // The semantic chunker already handles token limits and size constraints

        // Log chunking performance metrics
        const metrics = this.advancedChunker.getMetrics();
        console.log(`📊 Chunking metrics for ${path.basename(file)}: ${chunks.length} chunks, avg size: ${Math.round(metrics.averageChunkSize)}`)
        
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
  
  // Old chunking method removed - now using AdvancedSemanticChunker
  
  /**
   * Update progress
   */
  private updateProgress(progress: IndexingProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
  
  /**
   * Get statistics with chunking performance metrics
   */
  async getStats() {
    await this.storageService.connect();
    const baseStats = await this.storageService.getStats();
    
    // Add chunking performance metrics
    const chunkingMetrics = this.advancedChunker.getMetrics();
    
    return {
      ...baseStats,
      chunking: {
        totalRequests: chunkingMetrics.totalRequests,
        averageChunkSize: Math.round(chunkingMetrics.averageChunkSize),
        semanticBoundariesFound: chunkingMetrics.semanticBoundaries,
        fallbackUsageRate: chunkingMetrics.totalRequests > 0 
          ? (chunkingMetrics.fallbackUsage / chunkingMetrics.totalRequests * 100).toFixed(1) + '%'
          : '0%'
      }
    };
  }
}