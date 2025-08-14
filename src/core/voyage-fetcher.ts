/**
 * Voyage AI Documentation Fetcher
 * Fetches Voyage AI docs from GitHub repositories
 */

import axios from 'axios';
import { Document, DocumentMetadata } from '../types/index.js';
import crypto from 'crypto';
import pLimit from 'p-limit';

export class VoyageDocumentFetcher {
  private githubToken: string | undefined;
  private rateLimiter = pLimit(5); // Max 5 concurrent requests
  private repos = [
    { owner: 'voyage-ai', name: 'voyage-python', branch: 'main' },
    { owner: 'voyage-ai', name: 'voyageai-python', branch: 'main' },
  ];

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
  }

  async fetchAllVoyageDocumentation(): Promise<Document[]> {
    console.error('🚀 Fetching Voyage AI documentation from GitHub...');
    const documents: Document[] = [];

    try {
      // Fetch from Voyage AI repositories
      for (const repo of this.repos) {
        const repoDocs = await this.fetchFromRepository(repo);
        documents.push(...repoDocs);
      }

      // Also fetch from official Voyage docs site if accessible
      const officialDocs = await this.fetchOfficialDocs();
      documents.push(...officialDocs);

      console.error(`✅ Fetched ${documents.length} Voyage AI documents`);
      return this.deduplicateDocuments(documents);
    } catch (error) {
      console.error('Error fetching Voyage documentation:', error);
      throw error;
    }
  }

  private async fetchFromRepository(repo: { owner: string; name: string; branch: string }): Promise<Document[]> {
    const documents: Document[] = [];
    
    // Key paths to check in Voyage repos
    const docPaths = [
      'README.md',
      'docs',
      'examples',
      'voyageai',  // Source code with docstrings
    ];

    for (const path of docPaths) {
      try {
        const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${path}`;
        const docs = await this.fetchPath(url, repo);
        documents.push(...docs);
      } catch (error: any) {
        if (error.response?.status !== 404) {
          console.error(`Failed to fetch ${path} from ${repo.name}:`, error.message);
        }
      }
    }

    return documents;
  }

  private async fetchPath(url: string, repo: { owner: string; name: string; branch: string }): Promise<Document[]> {
    const documents: Document[] = [];
    
    try {
      const response = await this.rateLimiter(() => 
        axios.get(url, {
          params: { ref: repo.branch },
          headers: this.githubToken ? {
            'Authorization': `token ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          } : undefined,
        })
      );

      const items = Array.isArray(response.data) ? response.data : [response.data];

      for (const item of items) {
        if (item.type === 'file' && this.isRelevantFile(item.name)) {
          const doc = await this.fetchFile(item, repo);
          if (doc) {
            documents.push(doc);
          }
        } else if (item.type === 'dir' && !item.name.startsWith('.') && !item.name.startsWith('_')) {
          // Recursively fetch subdirectories
          const subDocs = await this.fetchPath(item.url, repo);
          documents.push(...subDocs);
        }
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error(`Error fetching from ${url}:`, error.message);
      }
    }

    return documents;
  }

  private async fetchFile(fileInfo: any, repo: { owner: string; name: string; branch: string }): Promise<Document | null> {
    try {
      // Fetch raw content
      const url = fileInfo.download_url || 
        `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.branch}/${fileInfo.path}`;
      
      const response = await this.rateLimiter(() => axios.get(url, { responseType: 'text' }));
      const content = response.data;
      
      // Parse and clean content
      const cleanedContent = this.parseContent(content, fileInfo.name);
      
      if (!cleanedContent || cleanedContent.length < 100) {
        return null; // Skip very short documents
      }

      const document: Document = {
        id: this.generateDocId(fileInfo.path),
        content: cleanedContent,
        metadata: this.extractMetadata(fileInfo, repo, content),
      };

      return document;
    } catch (error) {
      console.error(`Failed to fetch file ${fileInfo.path}:`, error);
      return null;
    }
  }

  private async fetchOfficialDocs(): Promise<Document[]> {
    const documents: Document[] = [];
    
    // Key Voyage AI documentation URLs (for future implementation)
    // const docUrls = [
    //   'https://docs.voyageai.com/docs/introduction',
    //   'https://docs.voyageai.com/docs/embeddings',
    //   'https://docs.voyageai.com/docs/reranking',
    //   'https://docs.voyageai.com/docs/contextualized-chunk-embeddings',
    //   'https://docs.voyageai.com/reference/embeddings-api',
    // ];

    // Note: These URLs would need web scraping which is beyond simple API calls
    // For now, we'll focus on GitHub content
    // In production, you'd want to implement proper web scraping or use an API if available

    return documents;
  }

  private isRelevantFile(filename: string): boolean {
    // Include markdown, Python files (for docstrings), and notebooks
    const extensions = ['.md', '.py', '.ipynb', '.rst', '.txt'];
    const relevant = extensions.some(ext => filename.endsWith(ext));
    
    // Exclude test files and private files
    const excluded = filename.includes('test') || 
                    filename.startsWith('_') || 
                    filename.startsWith('.');
    
    return relevant && !excluded;
  }

  private parseContent(content: string, filename: string): string {
    let parsed = content;

    if (filename.endsWith('.py')) {
      // Extract docstrings and comments from Python files
      parsed = this.extractPythonDocs(content);
    } else if (filename.endsWith('.md')) {
      // Clean markdown but keep structure
      parsed = content
        .replace(/```[^`]*```/g, (match) => {
          // Keep code blocks but clean them
          return match.replace(/```(\w+)?\n/, '').replace(/\n```/, '');
        });
    } else if (filename.endsWith('.ipynb')) {
      // Parse Jupyter notebooks
      try {
        const notebook = JSON.parse(content);
        parsed = this.extractNotebookContent(notebook);
      } catch {
        return '';
      }
    }

    // Clean up whitespace
    parsed = parsed
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return parsed;
  }

  private extractPythonDocs(content: string): string {
    const docs: string[] = [];
    
    // Extract module docstring
    const moduleDocMatch = content.match(/^"""([^"]*)"""/);
    if (moduleDocMatch) {
      docs.push('Module Documentation:\n' + moduleDocMatch[1]);
    }

    // Extract class and function docstrings
    const docstringPattern = /(class|def)\s+(\w+)[^:]*:\s*\n\s*"""([^"]*)"""/g;
    let match;
    while ((match = docstringPattern.exec(content)) !== null) {
      const [, type, name, docstring] = match;
      docs.push(`${type === 'class' ? 'Class' : 'Function'} ${name}:\n${docstring}`);
    }

    // Extract important comments
    const commentPattern = /^\s*#\s*(.+)$/gm;
    const comments = content.match(commentPattern);
    if (comments) {
      const importantComments = comments
        .filter(c => c.includes('TODO') || c.includes('NOTE') || c.includes('IMPORTANT'))
        .map(c => c.replace(/^\s*#\s*/, ''));
      if (importantComments.length > 0) {
        docs.push('Important Notes:\n' + importantComments.join('\n'));
      }
    }

    return docs.join('\n\n');
  }

  private extractNotebookContent(notebook: any): string {
    const contents: string[] = [];
    
    if (notebook.cells) {
      for (const cell of notebook.cells) {
        if (cell.cell_type === 'markdown') {
          contents.push(cell.source.join(''));
        } else if (cell.cell_type === 'code') {
          // Include code cells that have documentation
          const source = cell.source.join('');
          if (source.includes('"""') || source.includes("'''")) {
            contents.push(source);
          }
        }
      }
    }
    
    return contents.join('\n\n');
  }

  private extractMetadata(fileInfo: any, repo: { owner: string; name: string }, content: string): DocumentMetadata {
    const title = this.extractTitle(content, fileInfo.name) || 
                 fileInfo.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    
    return {
      path: fileInfo.path,
      product: 'voyage',
      title: `Voyage AI - ${title}`,
      url: `https://github.com/${repo.owner}/${repo.name}/blob/main/${fileInfo.path}`,
      lastModified: new Date().toISOString(),
      language: this.detectLanguage(fileInfo.name),
      section: this.extractSection(fileInfo.path),
    };
  }

  private extractTitle(content: string, filename: string): string | null {
    // Try to extract title from content
    const lines = content.split('\n').slice(0, 10);
    
    for (const line of lines) {
      // Markdown heading
      if (line.startsWith('#')) {
        return line.replace(/^#+\s*/, '').trim();
      }
      // Python docstring first line
      if (line.includes('"""')) {
        const match = line.match(/"""([^"]+)/);
        if (match) return match[1].trim();
      }
    }
    
    // Use filename as fallback
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  }

  private detectLanguage(filename: string): string {
    if (filename.endsWith('.py')) return 'python';
    if (filename.endsWith('.js') || filename.endsWith('.ts')) return 'javascript';
    if (filename.endsWith('.md')) return 'markdown';
    return 'text';
  }

  private extractSection(path: string): string {
    const parts = path.split('/');
    if (parts.length > 1) {
      return parts[parts.length - 2]; // Parent directory as section
    }
    return 'general';
  }

  private generateDocId(path: string): string {
    return crypto.createHash('sha256').update(`voyage-${path}`).digest('hex').substring(0, 16);
  }

  private deduplicateDocuments(documents: Document[]): Document[] {
    const seen = new Set<string>();
    return documents.filter(doc => {
      if (seen.has(doc.id)) {
        return false;
      }
      seen.add(doc.id);
      return true;
    });
  }
}