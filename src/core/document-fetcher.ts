/**
 * MongoDB Documentation Fetcher
 * Fetches docs from GitHub mongodb/docs repository
 */

import axios from 'axios';
import { Document, DocumentMetadata, MongoDBProduct } from '../types/index.js';
import crypto from 'crypto';
import pLimit from 'p-limit';

export class DocumentFetcher {
  private githubToken: string | undefined;
  private rateLimiter = pLimit(5); // Max 5 concurrent requests
  private baseUrls = {
    github: 'https://api.github.com/repos/mongodb/docs',
    raw: 'https://raw.githubusercontent.com/mongodb/docs',
  };

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
  }

  async fetchAllDocumentation(): Promise<Document[]> {
    console.error('📚 Fetching MongoDB documentation from GitHub...');
    const documents: Document[] = [];

    try {
      // MongoDB docs are in versioned branches with /source/ directory
      const masterDocs = await this.fetchFromGitHub('master');
      documents.push(...masterDocs);

      // Also fetch v7.0 docs (latest stable)
      const v7Docs = await this.fetchFromGitHub('v7.0');
      documents.push(...v7Docs);

      console.error(`✅ Fetched ${documents.length} documents`);
      return this.deduplicateDocuments(documents);
    } catch (error) {
      console.error('Error fetching documentation:', error);
      throw error;
    }
  }

  private async fetchFromGitHub(branch: string): Promise<Document[]> {
    const documents: Document[] = [];
    
    // MongoDB docs are in /source/ directory in versioned branches
    const docPaths = [
      'source',  // Main documentation root
      'source/core',
      'source/crud',
      'source/aggregation',
      'source/indexes',
      'source/administration',
      'source/reference',
      'source/tutorial',
    ];

    for (const path of docPaths) {
      try {
        const docs = await this.fetchDirectoryContents(path, branch);
        documents.push(...docs);
      } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
      }
    }

    return documents;
  }

  private async fetchDirectoryContents(path: string, branch: string): Promise<Document[]> {
    const documents: Document[] = [];
    
    try {
      const response = await this.rateLimiter(() => 
        axios.get(`${this.baseUrls.github}/contents/${path}`, {
          params: { ref: branch },
          headers: this.githubToken ? {
            'Authorization': `token ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          } : undefined,
        })
      );

      const items = Array.isArray(response.data) ? response.data : [response.data];

      for (const item of items) {
        if (item.type === 'file' && this.isDocumentFile(item.name)) {
          const doc = await this.fetchFile(item, branch);
          if (doc) {
            documents.push(doc);
          }
        } else if (item.type === 'dir') {
          // Recursively fetch subdirectories
          const subDocs = await this.fetchDirectoryContents(item.path, branch);
          documents.push(...subDocs);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`Path not found: ${path}`);
      } else {
        console.error(`Error fetching ${path}:`, error.message);
      }
    }

    return documents;
  }

  private async fetchFile(fileInfo: any, branch: string): Promise<Document | null> {
    try {
      // Fetch raw content directly
      const url = `${this.baseUrls.raw}/${branch}/${fileInfo.path}`;
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
        metadata: this.extractMetadata(fileInfo.path, content, branch),
      };

      return document;
    } catch (error) {
      console.error(`Failed to fetch file ${fileInfo.path}:`, error);
      return null;
    }
  }

  private isDocumentFile(filename: string): boolean {
    const extensions = ['.txt', '.rst', '.md'];
    const lowerName = filename.toLowerCase();

    // ENHANCED FILTERING: Skip meta-documentation and low-value content
    const skipFiles = [
      'readme', 'contributing', 'license', 'changelog', 'authors', 'code_of_conduct',
      'security', 'support', 'pull_request_template', 'issue_template',
      'gitignore', 'gitattributes', 'dockerignore', 'editorconfig',
      'makefile', 'dockerfile', 'requirements', 'package.json', 'package-lock.json',
      'yarn.lock', 'composer.json', 'gemfile', 'pipfile', 'poetry.lock',
      'travis', 'circleci', 'github', 'gitlab-ci', 'appveyor', 'azure-pipelines',
      'jenkinsfile', 'buildspec', 'wercker', 'drone', 'bitbucket-pipelines'
    ];

    // Skip if filename contains any skip pattern
    if (skipFiles.some(skip => lowerName.includes(skip))) {
      return false;
    }

    // Skip build/config directories
    const skipPaths = [
      'build', 'dist', 'node_modules', '.git', '.github', '.gitlab',
      'vendor', 'target', 'bin', 'obj', 'out', 'tmp', 'temp',
      'cache', 'logs', 'coverage', 'test-results', '.vscode', '.idea'
    ];

    if (skipPaths.some(path => lowerName.includes(`/${path}/`) || lowerName.startsWith(`${path}/`))) {
      return false;
    }

    return extensions.some(ext => lowerName.endsWith(ext));
  }

  private parseContent(content: string, _filename: string): string {
    // ENHANCED RST PARSING: Preserve structure while cleaning markup
    let parsed = content;

    // Extract and preserve code blocks first
    const codeBlocks: string[] = [];
    const codeBlockRegex = /\.\. code-block::\s*(\w+)?\s*\n((?:\s{3,}.*\n?)*)/g;
    parsed = parsed.replace(codeBlockRegex, (_match, language, code) => {
      const cleanCode = code.replace(/^\s{3}/gm, ''); // Remove indentation
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`\`\`\`${language || 'javascript'}\n${cleanCode}\`\`\``);
      return placeholder;
    });

    // Clean RST directives but preserve important content
    parsed = parsed
      // Remove RST directives but keep their content
      .replace(/^\.\. (note|tip|warning|important|caution)::\s*\n((?:\s{3,}.*\n?)*)/gm, (_match, type, content) => {
        const cleanContent = content.replace(/^\s{3}/gm, '');
        return `**${type.toUpperCase()}:** ${cleanContent}\n`;
      })
      // Clean method references: :method:`db.collection.find()` → db.collection.find()
      .replace(/:method:`([^`]+)`/g, '$1')
      .replace(/:doc:`([^`]+)`/g, '$1')
      .replace(/:ref:`([^`]+)`/g, '$1')
      // Remove other RST directives
      .replace(/^\.\. .+::.*$/gm, '')
      .replace(/^   :.*:.*$/gm, '')
      .replace(/^\.\. _.*:$/gm, '')
      // Remove RST section underlines
      .replace(/^[=\-~\^"'`#\*\+<>]{3,}$/gm, '')
      // Clean tabs-drivers directive content
      .replace(/\.\. tabs-drivers::\s*\n((?:\s{3,}.*\n?)*)/g, (_match, content) => {
        // Extract meaningful content from tabs
        return content.replace(/^\s{3}/gm, '').replace(/tabs:\s*\n/, '').replace(/- id: \w+\s*\n/, '');
      });

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      parsed = parsed.replace(`__CODE_BLOCK_${index}__`, block);
    });

    // Clean up whitespace and formatting
    parsed = parsed
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
      .replace(/^\s*$/gm, '') // Remove empty lines with whitespace
      .replace(/\s+$/gm, '') // Remove trailing whitespace
      .trim();

    return parsed;
  }

  private extractMetadata(path: string, content: string, branch: string): DocumentMetadata {
    // Extract product from path
    const product = this.extractProduct(path);
    
    // Extract title from content
    const title = this.extractTitle(content) || path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled';
    
    // Extract version from branch
    const version = branch === 'main' ? 'latest' : branch.replace('v', '');
    
    return {
      path,
      product,
      version,
      title,
      url: `https://github.com/mongodb/docs/blob/${branch}/${path}`,
      lastModified: new Date().toISOString(),
    };
  }

  private extractProduct(path: string): MongoDBProduct {
    if (path.includes('atlas')) return 'atlas';
    if (path.includes('compass')) return 'compass';
    if (path.includes('driver')) return 'drivers';
    if (path.includes('tool')) return 'tools';
    if (path.includes('guide') || path.includes('tutorial')) return 'guides';
    return 'manual';
  }

  private extractTitle(content: string): string | null {
    // Try to extract title from first few lines
    const lines = content.split('\n').slice(0, 5);
    
    for (const line of lines) {
      // Look for heading patterns
      if (line.startsWith('#')) {
        return line.replace(/^#+\s*/, '').trim();
      }
      // Look for reStructuredText title
      if (line.length > 3 && !line.includes('::') && !line.startsWith('..')) {
        const nextLine = lines[lines.indexOf(line) + 1];
        if (nextLine && /^[=\-~]+$/.test(nextLine) && nextLine.length >= line.length) {
          return line.trim();
        }
      }
    }
    
    return null;
  }

  private generateDocId(path: string): string {
    return crypto.createHash('sha256').update(path).digest('hex').substring(0, 16);
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

  async fetchSpecificDocument(url: string): Promise<Document | null> {
    try {
      const response = await axios.get(url, { responseType: 'text' });
      const content = this.parseContent(response.data, url);
      
      return {
        id: this.generateDocId(url),
        content,
        metadata: {
          path: url,
          product: 'manual',
          title: 'MongoDB Documentation',
          url,
        },
      };
    } catch (error) {
      console.error(`Failed to fetch document from ${url}:`, error);
      return null;
    }
  }
}