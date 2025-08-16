/**
 * Universal Document Fetcher - The ONLY fetcher you need
 * Intelligently fetches from GitHub, Web, and APIs
 * 
 * This replaces:
 * - DocumentFetcher (GitHub only)
 * - VoyageDocumentFetcher (Voyage only)
 * - MegaDocumentFetcher (overcomplicated)
 * - Inline fetching in index-docs.ts
 */

import axios from 'axios';
import { Document, MongoDBProduct } from '../types/index.js';
import crypto from 'crypto';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import { simpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FetchSource {
  type: 'github' | 'web' | 'api';
  name: string;
  repo?: string;
  branch?: string;
  url?: string;
  product: string;
  version: string;
  priority: number;
}

export class UniversalFetcher {
  private githubToken: string | undefined;
  private rateLimiter = pLimit(5);

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
  }

  /**
   * Fetch from any source intelligently
   */
  async fetchFromSource(source: FetchSource): Promise<Document[]> {
    console.log(`📥 Fetching ${source.name} (${source.type})...`);
    
    try {
      switch (source.type) {
        case 'github':
          return await this.fetchFromGitHub(source);
        case 'web':
          return await this.fetchFromWeb(source);
        case 'api':
          return await this.fetchFromAPI(source);
        default:
          console.error(`Unknown source type: ${source.type}`);
          return [];
      }
    } catch (error) {
      console.error(`Failed to fetch ${source.name}:`, error);
      return [];
    }
  }

  /**
   * Fetch from multiple sources in parallel
   */
  async fetchFromSources(sources: FetchSource[]): Promise<Document[]> {
    console.log(`🚀 Fetching from ${sources.length} sources...`);
    
    // Group by priority
    const priorityGroups = new Map<number, FetchSource[]>();
    sources.forEach(source => {
      const priority = source.priority || 1;
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)!.push(source);
    });

    // Process by priority (highest first)
    const allDocuments: Document[] = [];
    const priorities = Array.from(priorityGroups.keys()).sort((a, b) => b - a);
    
    for (const priority of priorities) {
      console.log(`\n📊 Processing priority ${priority} sources...`);
      const group = priorityGroups.get(priority)!;
      
      // Process each priority group in parallel
      const results = await Promise.allSettled(
        group.map(source => this.fetchFromSource(source))
      );
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allDocuments.push(...result.value);
          console.log(`✅ ${group[index].name}: ${result.value.length} documents`);
        } else {
          console.error(`❌ ${group[index].name}: Failed`);
        }
      });
    }

    // Deduplicate
    return this.deduplicateDocuments(allDocuments);
  }

  /**
   * GitHub repository fetching (optimized from original)
   */
  private async fetchFromGitHub(source: FetchSource): Promise<Document[]> {
    if (!source.repo) return [];
    
    const repoPath = path.join('mongodb-docs', source.repo.replace('/', '_'), source.branch || 'main');
    
    // Clone or update repo
    await this.cloneOrUpdateRepo(source.repo, source.branch || 'main', repoPath);
    
    // Find documentation files
    const files = await this.findDocFiles(repoPath);
    const documents: Document[] = [];
    
    // Process files in batches
    const batchSize = 50;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchDocs = await Promise.all(
        batch.map(file => this.processFile(file, source))
      );
      documents.push(...batchDocs.filter(doc => doc !== null) as Document[]);
    }
    
    return documents;
  }

  /**
   * Web page fetching (from original mega-fetcher)
   */
  private async fetchFromWeb(source: FetchSource): Promise<Document[]> {
    if (!source.url) return [];
    
    try {
      const response = await this.rateLimiter(() => 
        axios.get(source.url!, { timeout: 30000 })
      );
      
      const $ = cheerio.load(response.data);
      const documents: Document[] = [];
      
      // Extract content intelligently
      const selectors = [
        'article', '.documentation', '.content', 'main',
        '.doc-content', '.markdown-body', '[role="main"]'
      ];
      
      selectors.forEach(selector => {
        $(selector).each((_, elem) => {
          const content = this.extractCleanText($, elem);
          if (content.length > 100) {
            documents.push({
              id: this.generateId(`${source.url}-${selector}`),
              content,
              metadata: {
                path: source.url!,
                product: source.product as MongoDBProduct,
                version: source.version,
                title: source.name,
                url: source.url!
              }
            });
          }
        });
      });
      
      return documents;
    } catch (error) {
      console.error(`Failed to fetch web page ${source.url}:`, error);
      return [];
    }
  }

  /**
   * API fetching (for future expansion)
   */
  private async fetchFromAPI(source: FetchSource): Promise<Document[]> {
    if (!source.url) return [];
    
    try {
      const response = await this.rateLimiter(() =>
        axios.get(source.url!, {
          headers: {
            'Accept': 'application/json',
            'Authorization': this.githubToken ? `Bearer ${this.githubToken}` : undefined
          },
          timeout: 30000
        })
      );
      
      // Process API response based on structure
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map(item => this.processAPIItem(item, source))
          .filter(doc => doc !== null) as Document[];
      } else if (data.content) {
        return [this.processAPIItem(data, source)].filter(doc => doc !== null) as Document[];
      }
      
      return [];
    } catch (error) {
      console.error(`Failed to fetch API ${source.url}:`, error);
      return [];
    }
  }

  /**
   * Clone or update a git repository
   */
  private async cloneOrUpdateRepo(repo: string, branch: string, targetPath: string): Promise<void> {
    const git = simpleGit();
    
    try {
      await fs.access(targetPath);
      // Repo exists, update it
      await git.cwd(targetPath);
      await git.checkout(branch);
      await git.pull('origin', branch);
    } catch {
      // Clone new repo
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await git.clone(
        `https://github.com/${repo}.git`,
        targetPath,
        ['--branch', branch, '--depth', '1', '--single-branch']
      );
    }
  }

  /**
   * Find documentation files recursively
   */
  private async findDocFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.md', '.mdx', '.rst', '.txt', '.json', '.yaml', '.yml'];
    const skipDirs = ['node_modules', '.git', 'build', 'dist', 'coverage', 'test'];
    
    async function walk(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignore inaccessible directories
      }
    }
    
    await walk(dir);
    return files;
  }

  /**
   * Process a file into a document
   */
  private async processFile(filePath: string, source: FetchSource): Promise<Document | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (content.length < 50) return null;
      
      const cleanedContent = this.cleanContent(content, path.extname(filePath));
      
      return {
        id: this.generateId(filePath),
        content: cleanedContent,
        metadata: {
          path: filePath,
          product: source.product as MongoDBProduct,
          version: source.version,
          title: this.extractTitle(cleanedContent) || path.basename(filePath),
          url: `https://github.com/${source.repo}/blob/${source.branch}/${path.relative(process.cwd(), filePath)}`
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Process API response item
   */
  private processAPIItem(item: any, source: FetchSource): Document | null {
    if (!item.content && !item.description && !item.body) return null;
    
    const content = item.content || item.description || item.body || '';
    if (content.length < 50) return null;
    
    return {
      id: this.generateId(item.id || item.name || content),
      content,
      metadata: {
        path: item.path || item.url || source.url!,
        product: source.product as MongoDBProduct,
        version: source.version,
        title: item.title || item.name || source.name,
        url: item.url || source.url!
      }
    };
  }

  /**
   * Clean content based on file type
   */
  private cleanContent(content: string, extension: string): string {
    // Remove common boilerplate
    let cleaned = content
      .replace(/<!--.*?-->/gs, '') // HTML comments
      .replace(/^\s*#\s*Table of Contents.*?(?=^#)/ms, '') // TOC
      .replace(/^---[\s\S]*?---/m, ''); // Front matter
    
    // Format based on extension
    if (extension === '.rst') {
      // Clean RST markup
      cleaned = cleaned
        .replace(/^\.\. .+::.*/gm, '')
        .replace(/^ {3}:.+:.*/gm, '')
        .replace(/::\w+:`([^`]+)`/g, '$1')
        .replace(/^\.\. _.*:/gm, '');
    }
    
    return cleaned.trim();
  }

  /**
   * Extract clean text from HTML
   */
  private extractCleanText($: cheerio.CheerioAPI, element: any): string {
    // Remove script and style elements
    $('script, style, nav, header, footer', element).remove();
    
    // Get text and clean it
    return $(element).text()
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract title from content
   */
  private extractTitle(content: string): string | null {
    // Try markdown title
    const mdMatch = content.match(/^#\s+(.+)$/m);
    if (mdMatch) return mdMatch[1].trim();
    
    // Try RST title
    const lines = content.split('\n');
    for (let i = 0; i < Math.min(5, lines.length - 1); i++) {
      if (/^[=\-~]+$/.test(lines[i + 1]) && lines[i].length > 0) {
        return lines[i].trim();
      }
    }
    
    return null;
  }

  /**
   * Generate unique document ID
   */
  private generateId(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Deduplicate documents by ID
   */
  private deduplicateDocuments(documents: Document[]): Document[] {
    const seen = new Set<string>();
    return documents.filter(doc => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
  }
}
