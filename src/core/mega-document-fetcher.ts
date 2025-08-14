/**
 * MEGA Document Fetcher - Gets ALL MongoDB and Voyage AI Documentation
 * This is the ULTIMATE solution to fetch THOUSANDS of documents
 */

import axios from 'axios';
import { Document, MongoDBProduct } from '../types/index.js';
import crypto from 'crypto';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';

interface FetchStrategy {
  name: string;
  execute(): Promise<Document[]>;
}

export class MegaDocumentFetcher {
  private githubToken: string | undefined;
  private rateLimiter = pLimit(10); // More aggressive parallel fetching
  private documentsFound = new Map<string, Document>();
  
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
  }

  /**
   * FETCH EVERYTHING - All strategies combined!
   */
  async fetchEverything(): Promise<Document[]> {
    console.error('🚀 MEGA FETCH INITIATED - Getting ALL documentation...\n');
    
    const strategies: FetchStrategy[] = [
      { name: 'GitHub Recursive', execute: () => this.fetchGitHubRecursive() },
      { name: 'MongoDB Sitemap', execute: () => this.fetchFromSitemap() },
      { name: 'MongoDB Learn', execute: () => this.fetchMongoDBLearn() },
      { name: 'Voyage AI Docs', execute: () => this.fetchVoyageComplete() },
      { name: 'MongoDB Developer Hub', execute: () => this.fetchDeveloperHub() },
      { name: 'MongoDB University', execute: () => this.fetchUniversity() },
    ];
    
    const results = await Promise.allSettled(
      strategies.map(strategy => this.executeStrategy(strategy))
    );
    
    // Combine all successful results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.error(`✅ ${strategies[index].name}: ${result.value.length} documents`);
      } else {
        console.error(`❌ ${strategies[index].name}: Failed - ${result.reason}`);
      }
    });
    
    const allDocs = Array.from(this.documentsFound.values());
    console.error(`\n🎉 TOTAL UNIQUE DOCUMENTS FETCHED: ${allDocs.length}`);
    
    return allDocs;
  }

  private async executeStrategy(strategy: FetchStrategy): Promise<Document[]> {
    try {
      const docs = await strategy.execute();
      // Add to our deduplication map
      docs.forEach(doc => {
        this.documentsFound.set(doc.id, doc);
      });
      return docs;
    } catch (error) {
      console.error(`Strategy ${strategy.name} failed:`, error);
      return [];
    }
  }

  /**
   * Strategy 1: Recursive GitHub Fetching - Gets EVERYTHING from mongodb/docs
   */
  private async fetchGitHubRecursive(): Promise<Document[]> {
    console.error('📂 Fetching ALL MongoDB docs from GitHub recursively...');
    const documents: Document[] = [];
    
    const branches = ['master', 'v7.0', 'v6.0', 'v5.0'];
    
    for (const branch of branches) {
      try {
        // Start from root and recursively fetch EVERYTHING
        const branchDocs = await this.recursiveFetch('', branch, 0);
        documents.push(...branchDocs);
        console.error(`  Branch ${branch}: ${branchDocs.length} documents`);
      } catch (error) {
        console.error(`  Branch ${branch} failed:`, error);
      }
    }
    
    return documents;
  }

  private async recursiveFetch(path: string, branch: string, depth: number): Promise<Document[]> {
    if (depth > 10) return []; // Prevent infinite recursion
    
    const documents: Document[] = [];
    
    try {
      const url = `https://api.github.com/repos/mongodb/docs/contents/${path}`;
      const response = await this.rateLimiter(() => 
        axios.get(url, {
          params: { ref: branch },
          headers: {
            'Authorization': this.githubToken ? `token ${this.githubToken}` : undefined,
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        })
      );
      
      const items = Array.isArray(response.data) ? response.data : [response.data];
      
      // Process in parallel batches
      const batches = this.chunk(items, 10);
      
      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map(async (item: any) => {
            if (item.type === 'file' && this.isDocFile(item.name)) {
              return this.fetchAndProcessFile(item, branch);
            } else if (item.type === 'dir' && !this.shouldSkipDir(item.name)) {
              return this.recursiveFetch(item.path, branch, depth + 1);
            }
            return null;
          })
        );
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            if (Array.isArray(result.value)) {
              documents.push(...result.value);
            } else {
              documents.push(result.value);
            }
          }
        });
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error(`Error fetching ${path}:`, error.message);
      }
    }
    
    return documents;
  }

  /**
   * Strategy 2: Fetch from MongoDB Sitemap
   */
  private async fetchFromSitemap(): Promise<Document[]> {
    console.error('🗺️ Fetching from MongoDB sitemap...');
    const documents: Document[] = [];
    
    try {
      const sitemapUrl = 'https://www.mongodb.com/docs/sitemap.xml';
      const response = await axios.get(sitemapUrl, { timeout: 30000 });
      
      const $ = cheerio.load(response.data, { xmlMode: true });
      const urls = $('loc').map((_, el) => $(el).text()).get();
      
      // Filter for documentation URLs
      const docUrls = urls.filter(url => 
        url.includes('/manual/') || 
        url.includes('/atlas/') || 
        url.includes('/drivers/') ||
        url.includes('/compass/') ||
        url.includes('/cloud/')
      ).slice(0, 500); // Limit to prevent overwhelming
      
      console.error(`  Found ${docUrls.length} documentation URLs`);
      
      // Fetch content from each URL
      const batches = this.chunk(docUrls, 20);
      
      for (const batch of batches) {
        const batchDocs = await Promise.allSettled(
          batch.map(url => this.fetchWebPage(url))
        );
        
        batchDocs.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            documents.push(result.value);
          }
        });
      }
    } catch (error) {
      console.error('Sitemap fetch failed:', error);
    }
    
    return documents;
  }

  /**
   * Strategy 3: MongoDB Learn Platform
   */
  private async fetchMongoDBLearn(): Promise<Document[]> {
    console.error('🎓 Fetching from MongoDB Learn platform...');
    const documents: Document[] = [];
    
    const learnUrls = [
      'https://learn.mongodb.com/learn/course/mongodb-basics',
      'https://learn.mongodb.com/learn/course/mongodb-aggregation',
      'https://learn.mongodb.com/learn/course/mongodb-indexes',
      'https://learn.mongodb.com/learn/course/mongodb-performance',
      'https://learn.mongodb.com/learn/course/mongodb-atlas-search',
    ];
    
    for (const url of learnUrls) {
      try {
        const doc = await this.fetchWebPage(url);
        if (doc) documents.push(doc);
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
      }
    }
    
    return documents;
  }

  /**
   * Strategy 4: Complete Voyage AI Documentation
   */
  private async fetchVoyageComplete(): Promise<Document[]> {
    console.error('🚢 Fetching complete Voyage AI documentation...');
    const documents: Document[] = [];
    
    // Voyage AI documentation sources
    const voyageSources = [
      // GitHub repositories
      { repo: 'voyage-ai/voyageai-python', paths: ['README.md', 'docs/', 'examples/'] },
      { repo: 'voyage-ai/voyage-large-2-instruct', paths: ['README.md'] },
      
      // Documentation site URLs
      { url: 'https://docs.voyageai.com/docs/introduction' },
      { url: 'https://docs.voyageai.com/docs/embeddings' },
      { url: 'https://docs.voyageai.com/docs/reranking' },
      { url: 'https://docs.voyageai.com/docs/voyage-3' },
      { url: 'https://docs.voyageai.com/docs/voyage-finance-2' },
      { url: 'https://docs.voyageai.com/docs/voyage-law-2' },
      { url: 'https://docs.voyageai.com/docs/voyage-code-2' },
      { url: 'https://docs.voyageai.com/docs/contextualized-embeddings' },
      { url: 'https://docs.voyageai.com/reference/embeddings-api' },
      { url: 'https://docs.voyageai.com/reference/reranking-api' },
      
      // Blog posts with technical details
      { url: 'https://blog.voyageai.com/2024/11/05/voyage-3/' },
      { url: 'https://blog.voyageai.com/2024/09/30/contextual-retrieval/' },
    ];
    
    // Fetch from GitHub repos
    for (const source of voyageSources) {
      if (source.repo) {
        for (const path of source.paths!) {
          try {
            const docs = await this.fetchFromGitHubRepo(source.repo, path);
            documents.push(...docs);
          } catch (error) {
            console.error(`Failed to fetch ${source.repo}/${path}:`, error);
          }
        }
      } else if (source.url) {
        try {
          const doc = await this.fetchWebPage(source.url);
          if (doc) documents.push(doc);
        } catch (error) {
          console.error(`Failed to fetch ${source.url}:`, error);
        }
      }
    }
    
    return documents;
  }

  /**
   * Strategy 5: MongoDB Developer Hub
   */
  private async fetchDeveloperHub(): Promise<Document[]> {
    console.error('👩‍💻 Fetching from MongoDB Developer Hub...');
    const documents: Document[] = [];
    
    const hubUrls = [
      'https://www.mongodb.com/developer/languages/javascript/',
      'https://www.mongodb.com/developer/languages/python/',
      'https://www.mongodb.com/developer/products/atlas/',
      'https://www.mongodb.com/developer/products/atlas/atlas-vector-search/',
      'https://www.mongodb.com/developer/article/rag-atlas-vector-search-langchain/',
    ];
    
    for (const url of hubUrls) {
      try {
        const doc = await this.fetchWebPage(url);
        if (doc) documents.push(doc);
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
      }
    }
    
    return documents;
  }

  /**
   * Strategy 6: MongoDB University Courses
   */
  private async fetchUniversity(): Promise<Document[]> {
    console.error('🎓 Fetching MongoDB University content...');
    const documents: Document[] = [];
    
    const courses = [
      'M001', // MongoDB Basics
      'M103', // Basic Cluster Administration
      'M121', // Aggregation Framework
      'M201', // MongoDB Performance
      'M220JS', // MongoDB for JavaScript Developers
      'M220P', // MongoDB for Python Developers
    ];
    
    for (const course of courses) {
      const url = `https://university.mongodb.com/courses/${course}/about`;
      try {
        const doc = await this.fetchWebPage(url);
        if (doc) documents.push(doc);
      } catch (error) {
        console.error(`Failed to fetch course ${course}:`, error);
      }
    }
    
    return documents;
  }

  /**
   * Helper: Fetch and process a single file from GitHub
   */
  private async fetchAndProcessFile(fileInfo: any, branch: string): Promise<Document | null> {
    try {
      const url = `https://raw.githubusercontent.com/mongodb/docs/${branch}/${fileInfo.path}`;
      const response = await this.rateLimiter(() => 
        axios.get(url, { 
          timeout: 10000,
          validateStatus: (status) => status === 200,
        })
      );
      
      const content = this.cleanContent(response.data);
      if (content.length < 100) return null;
      
      return {
        id: this.generateId(fileInfo.path + branch),
        content,
        metadata: {
          path: fileInfo.path,
          product: this.extractProduct(fileInfo.path),
          version: branch === 'master' ? 'latest' : branch.replace('v', ''),
          title: this.extractTitle(content) || fileInfo.name,
          url,
          lastModified: new Date().toISOString(),
        },
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Fetch content from a web page
   */
  private async fetchWebPage(url: string): Promise<Document | null> {
    try {
      const response = await this.rateLimiter(() => 
        axios.get(url, { 
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MongoDocs-MCP/1.0)',
          },
        })
      );
      
      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, header, footer').remove();
      
      // Extract main content
      const content = $('main, article, .content, .documentation, [role="main"]')
        .first()
        .text()
        .trim();
      
      if (content.length < 100) return null;
      
      const title = $('h1').first().text() || 
                   $('title').text() || 
                   url.split('/').pop() || 
                   'Untitled';
      
      return {
        id: this.generateId(url),
        content: this.cleanContent(content),
        metadata: {
          path: url,
          product: this.extractProductFromUrl(url),
          title,
          url,
          lastModified: new Date().toISOString(),
        },
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Fetch from a specific GitHub repository
   */
  private async fetchFromGitHubRepo(repo: string, path: string): Promise<Document[]> {
    const documents: Document[] = [];
    
    try {
      const url = `https://api.github.com/repos/${repo}/contents/${path}`;
      const response = await this.rateLimiter(() =>
        axios.get(url, {
          headers: {
            'Authorization': this.githubToken ? `token ${this.githubToken}` : undefined,
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        })
      );
      
      const items = Array.isArray(response.data) ? response.data : [response.data];
      
      for (const item of items) {
        if (item.type === 'file' && this.isDocFile(item.name)) {
          const rawUrl = item.download_url;
          const docResponse = await axios.get(rawUrl, { timeout: 10000 });
          
          const content = this.cleanContent(docResponse.data);
          if (content.length > 100) {
            documents.push({
              id: this.generateId(item.path),
              content,
              metadata: {
                path: item.path,
                product: 'voyage',
                title: this.extractTitle(content) || item.name,
                url: rawUrl,
                lastModified: new Date().toISOString(),
              },
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch from ${repo}/${path}:`, error);
    }
    
    return documents;
  }

  /**
   * Utility functions
   */
  private isDocFile(filename: string): boolean {
    const extensions = ['.txt', '.rst', '.md', '.mdx', '.json', '.yaml', '.yml'];
    return extensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  private shouldSkipDir(dirname: string): boolean {
    const skipDirs = ['images', 'assets', 'static', '.git', 'node_modules', 'test', 'tests'];
    return skipDirs.includes(dirname.toLowerCase());
  }

  private cleanContent(content: string): string {
    return content
      .replace(/^\.\. .+::.*$/gm, '')
      .replace(/^   :.*:.*$/gm, '')
      .replace(/^\.\. _.*:$/gm, '')
      .replace(/^[=\-~`#]{3,}$/gm, '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  private extractTitle(content: string): string | null {
    const lines = content.split('\n').slice(0, 10);
    for (const line of lines) {
      if (line.length > 3 && line.length < 100 && !line.includes('::')) {
        return line.trim();
      }
    }
    return null;
  }

  private extractProduct(path: string): MongoDBProduct {
    if (path.includes('atlas')) return 'atlas';
    if (path.includes('compass')) return 'compass';
    if (path.includes('driver')) return 'drivers';
    if (path.includes('tool')) return 'tools';
    if (path.includes('guide') || path.includes('tutorial')) return 'guides';
    return 'manual';
  }

  private extractProductFromUrl(url: string): MongoDBProduct {
    if (url.includes('/atlas/') || url.includes('atlas-')) return 'atlas';
    if (url.includes('/compass/')) return 'compass';
    if (url.includes('/drivers/')) return 'drivers';
    if (url.includes('voyage')) return 'voyage';
    if (url.includes('/guides/') || url.includes('/tutorial/')) return 'guides';
    return 'manual';
  }

  private generateId(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}