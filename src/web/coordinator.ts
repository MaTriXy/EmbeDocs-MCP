/**
 * Web UI Coordinator - Orchestrates the web interface with existing services
 * Handles setup flow, credential management, and indexing coordination
 */

import { Indexer, IndexingProgress } from '../core/indexer.js';
import { EmbeddingService } from '../core/embeddings.js';
import { StorageService } from '../core/storage.js';
import { MongoClient } from 'mongodb';

export interface Credentials {
  mongodbUri: string;
  voyageKey: string;
}

export interface Repository {
  id: string;
  name: string;
  repo: string;
  branch: string;
  icon: string;
  description: string;
  priority: number;
  selected: boolean;
  custom?: boolean;
  category?: string;
  docs?: string;
  stars?: number;
  language?: string;
}

export interface SetupData {
  credentials: Credentials;
  repositories: Repository[];
}

export class WebCoordinator {
  private static instance: WebCoordinator;
  private indexer: Indexer | null = null;
  private progressCallback?: (progress: IndexingProgress) => void;
  private currentCredentials?: Credentials;

  private constructor() {}

  static getInstance(): WebCoordinator {
    if (!this.instance) {
      this.instance = new WebCoordinator();
    }
    return this.instance;
  }

  /**
   * Test MongoDB connection with provided credentials
   */
  async testMongoDBConnection(uri: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate URI format
      if (!uri.startsWith('mongodb+srv://') && !uri.startsWith('mongodb://')) {
        return {
          success: false,
          message: 'Invalid MongoDB connection string format. Must start with mongodb:// or mongodb+srv://'
        };
      }

      // Test actual connection with longer timeout for slower networks
      const client = new MongoClient(uri, {
        connectTimeoutMS: 15000,  // Increased from 5000
        serverSelectionTimeoutMS: 15000  // Increased from 5000
      });

      await client.connect();
      
      // Test database access
      const db = client.db('mongodb_semantic_docs');
      await db.admin().ping();
      
      await client.close();

      return {
        success: true,
        message: 'MongoDB connection successful'
      };
    } catch (error) {
      console.error('MongoDB connection test failed:', error);
      
      let message = 'MongoDB connection failed';
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND')) {
          message = 'Could not resolve MongoDB hostname. Check your connection string.';
        } else if (error.message.includes('Authentication failed')) {
          message = 'MongoDB authentication failed. Check your username and password.';
        } else if (error.message.includes('IP access list')) {
          message = 'IP not whitelisted. Add your IP to MongoDB Atlas Network Access.';
        } else {
          message = `MongoDB error: ${error.message}`;
        }
      }

      return { success: false, message };
    }
  }

  /**
   * Test Voyage AI API key
   */
  async testVoyageAI(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate API key format
      if (!apiKey.startsWith('pa-')) {
        return {
          success: false,
          message: 'Invalid Voyage AI API key format. Should start with "pa-"'
        };
      }

      // Temporarily set the API key for testing
      const originalKey = process.env.VOYAGE_API_KEY;
      process.env.VOYAGE_API_KEY = apiKey;

      try {
        // Test with EmbeddingService
        const embeddingService = EmbeddingService.getInstance();
        await embeddingService.embedQuery('test');

        return {
          success: true,
          message: 'Voyage AI API key validated successfully'
        };
      } finally {
        // Restore original key
        if (originalKey) {
          process.env.VOYAGE_API_KEY = originalKey;
        } else {
          delete process.env.VOYAGE_API_KEY;
        }
      }
    } catch (error) {
      console.error('Voyage AI test failed:', error);
      
      let message = 'Voyage AI API test failed';
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          message = 'Invalid Voyage AI API key. Check your key from the Voyage AI dashboard.';
        } else if (error.message.includes('429')) {
          message = 'Voyage AI rate limit exceeded. Please try again later.';
        } else if (error.message.includes('timeout')) {
          message = 'Voyage AI request timeout. Check your internet connection.';
        } else {
          message = `Voyage AI error: ${error.message}`;
        }
      }

      return { success: false, message };
    }
  }

  /**
   * Validate GitHub repository URL and extract metadata
   */
  async validateGitHubRepo(repoUrl: string): Promise<{ success: boolean; repo?: any; message: string }> {
    try {
      // Clean up the URL
      const cleanUrl = repoUrl.trim().replace(/\/$/, '').replace(/\.git$/, '');
      
      // Extract owner/repo from GitHub URL
      const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return {
          success: false,
          message: 'Invalid GitHub URL format. Should be: https://github.com/owner/repository'
        };
      }

      const [, owner, repoName] = match;

      // Check if repo exists using GitHub API (optional - can work without API key)
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'EmbeDocs-MCP'
          }
        });
        
        if (response.status === 404) {
          return {
            success: false,
            message: 'Repository not found or is private'
          };
        }

        if (response.ok) {
          const repoData = await response.json() as any;
          
          return {
            success: true,
            repo: {
              id: `custom-${owner}-${repoName}`,
              name: `${owner}/${repoName}`,
              repo: `${owner}/${repoName}`,
              branch: repoData.default_branch || 'main',
              icon: '📦',
              description: repoData.description || 'Custom repository',
              priority: 5,
              selected: true,
              custom: true,
              stars: repoData.stargazers_count,
              language: repoData.language
            },
            message: 'Repository validated successfully'
          };
        }
      } catch (apiError) {
        // GitHub API failed, but we can still proceed with basic validation
        console.warn('GitHub API request failed, using basic validation:', apiError);
      }

      // Basic validation without API
      return {
        success: true,
        repo: {
          id: `custom-${owner}-${repoName}`,
          name: `${owner}/${repoName}`,
          repo: `${owner}/${repoName}`,
          branch: 'main',
          icon: '📦',
          description: 'Custom repository',
          priority: 5,
          selected: true,
          custom: true
        },
        message: 'Repository added (validation without GitHub API)'
      };
    } catch (error) {
      console.error('Repository validation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Repository validation failed'
      };
    }
  }

  /**
   * Set temporary credentials for the session
   */
  setCredentials(credentials: Credentials): void {
    this.currentCredentials = credentials;
    
    // Set environment variables for this session
    process.env.MONGODB_URI = credentials.mongodbUri;
    process.env.VOYAGE_API_KEY = credentials.voyageKey;
  }

  /**
   * Clear session credentials
   */
  clearCredentials(): void {
    this.currentCredentials = undefined;
    
    // Don't delete environment variables as they might be from .env file
    // Just clear our temporary overrides
  }

  /**
   * Create dynamic configuration from selected repositories
   */
  private createDynamicConfig(repositories: Repository[]) {
    // Transform web repositories to config format compatible with indexer
    const configRepos = repositories.map(repo => ({
      name: repo.name,
      repo: repo.repo,
      branch: repo.branch || 'main',
      product: repo.category || repo.id,
      version: 'latest',
      priority: repo.priority || 5,
      description: repo.description,
      icon: repo.icon,
      custom: repo.custom || false
    }));

    // Create a dynamic configuration object
    return {
      repositories: configRepos,
      embedding: {
        model: 'voyage-context-3',
        dimensions: 1024,
        chunkSize: 2000,
        chunkOverlap: 200
      },
      storage: {
        database: 'mongodb_semantic_docs',
        collection: 'documents'
      },
      search: {
        vectorWeight: 0.7,
        keywordWeight: 0.3,
        reranker: 'rrf',
        numCandidates: 40
      }
    };
  }

  /**
   * Start the indexing process with provided setup data
   */
  async startIndexing(setupData: SetupData): Promise<void> {
    try {
      // Set credentials
      this.setCredentials(setupData.credentials);

      // Create dynamic configuration based on user selections
      const dynamicConfig = this.createDynamicConfig(setupData.repositories);
      
      // Initialize services with new credentials
      // Services are automatically initialized with environment variables
      StorageService.getInstance();
      EmbeddingService.getInstance();

      console.log('🚀 Starting EmbeDocs indexing with user selections:', {
        credentials: { 
          mongoUri: setupData.credentials.mongodbUri ? 'SET' : 'MISSING', 
          voyageKey: setupData.credentials.voyageKey ? 'SET' : 'MISSING' 
        },
        repositories: setupData.repositories.map(r => ({
          name: r.name,
          repo: r.repo,
          branch: r.branch,
          category: r.category,
          custom: r.custom
        })),
        totalRepos: setupData.repositories.length,
        config: {
          embedding: dynamicConfig.embedding,
          storage: dynamicConfig.storage
        }
      });

      // Create indexer instance with dynamic configuration
      this.indexer = new Indexer(dynamicConfig);

      // Set up progress callback if provided
      if (this.progressCallback) {
        this.indexer.onProgress(this.progressCallback);
      }

      // Start the indexing process with user-selected repositories
      await this.indexer.index();

      console.log('✅ EmbeDocs indexing completed successfully for selected repositories');
    } catch (error) {
      console.error('❌ EmbeDocs indexing failed:', error);
      throw error;
    }
  }

  /**
   * Set progress callback for UI updates
   */
  onProgress(callback: (progress: IndexingProgress) => void): void {
    this.progressCallback = callback;
    if (this.indexer) {
      this.indexer.onProgress(callback);
    }
  }

  /**
   * Get indexing statistics
   */
  async getStats() {
    if (!this.indexer) {
      throw new Error('Indexer not initialized');
    }
    
    return await this.indexer.getStats();
  }

  /**
   * Check if credentials are set
   */
  hasCredentials(): boolean {
    return !!this.currentCredentials;
  }

  /**
   * Get current credentials (without exposing sensitive data)
   */
  getCredentialsInfo() {
    if (!this.currentCredentials) return null;
    
    return {
      hasMongoUri: !!this.currentCredentials.mongodbUri,
      hasVoyageKey: !!this.currentCredentials.voyageKey,
      mongoProvider: this.currentCredentials.mongodbUri.includes('atlas') ? 'Atlas' : 'Self-hosted'
    };
  }
}