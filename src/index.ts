#!/usr/bin/env node
/**
 * MongoDB Semantic Docs MCP Server - CLEAN ARCHITECTURE
 * Ultra-fast semantic search with voyage-context-3
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { SearchService } from './core/search.js';
import { StorageService } from './core/storage.js';
import { config } from './config/index.js';

// Load environment variables
dotenv.config();

class MongoDBSemanticMCP {
  private server: Server;
  private searchService: SearchService;
  private storageService: StorageService;

  constructor() {
    this.server = new Server(
      {
        name: 'mongodocs-mcp',
        version: '9.0.0', // Clean architecture version
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          },
        },
      }
    );

    this.searchService = SearchService.getInstance();
    this.storageService = StorageService.getInstance();

    this.registerTools();
  }

  private registerTools(): void {
    // Register available MCP tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'mongodb-semantic-search',
          description: 'Search MongoDB documentation using voyage-context-3 embeddings',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language search query',
              },
              limit: {
                type: 'number',
                description: 'Number of results to return',
                default: 5,
                minimum: 1,
                maximum: 20,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'mongodb-hybrid-search',
          description: 'Hybrid search using Reciprocal Rank Fusion (RRF algorithm)',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language search query',
              },
              limit: {
                type: 'number',
                description: 'Number of results to return',
                default: 5,
                minimum: 1,
                maximum: 20,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'mongodb-status',
          description: 'Get system status and statistics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'mongodb-semantic-search':
            return await this.handleVectorSearch(args);
          case 'mongodb-hybrid-search':
            return await this.handleHybridSearch(args);
          case 'mongodb-status':
            return await this.handleStatus();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error in tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            },
          ],
        };
      }
    });
  }

  private async handleVectorSearch(args: any) {
    try {
      console.error(`🔍 Vector search for: "${args.query}"`);
      
      const results = await this.searchService.vectorSearch(
        args.query,
        args.limit || 5
      );
      
      console.error(`✅ Found ${results.length} results`);
      
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No results found. Try refining your search query.',
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatSearchResults(results),
          },
        ],
      };
    } catch (error) {
      console.error('❌ Search error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleHybridSearch(args: any) {
    try {
      console.error(`🔍 Hybrid search for: "${args.query}"`);
      
      const results = await this.searchService.hybridSearch(
        args.query,
        args.limit || 5
      );
      
      console.error(`✅ Found ${results.length} results with RRF`);
      
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
            text: 'No results found. Try refining your search query.',
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatSearchResults(results),
          },
        ],
      };
    } catch (error) {
      console.error('❌ Search error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleStatus() {
    try {
      await this.storageService.connect();
      const stats = await this.storageService.getStats();
      const searchStats = await this.searchService.getStats();
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatStatus(stats, searchStats),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private formatSearchResults(results: any[]): string {
    if (results.length === 0) {
      return 'No results found.';
    }

    let output = `Found ${results.length} relevant documents:\n\n`;

    results.forEach((result, index) => {
      output += `## ${index + 1}. ${result.title || 'Document'}\n`;
      output += `**Score**: ${result.score.toFixed(3)} | **Product**: ${result.product || 'unknown'}\n\n`;
      output += `${result.content.substring(0, 500)}...\n\n`;
      output += '---\n\n';
    });

    return output;
  }

  private formatStatus(dbStats: any, searchStats: any): string {
    return `**MongoDB Semantic Docs MCP Status**

📊 **Database Statistics:**
- Total Documents: ${dbStats.totalDocuments}
- Products: ${dbStats.products.join(', ')}
- Models: ${dbStats.models.join(', ')}
- Expected Model: ${dbStats.expectedModel} (${dbStats.expectedDimensions}d)

🔍 **Search Configuration:**
- Embedding Model: ${searchStats.embeddingConfig.model}
- Dimensions: ${searchStats.embeddingConfig.dimensions}
- Reranker: ${searchStats.searchConfig.reranker}
- Vector Weight: ${searchStats.searchConfig.vectorWeight}
- Keyword Weight: ${searchStats.searchConfig.keywordWeight}

✅ **System Health:** READY`;
  }

  async start(): Promise<void> {
    // Check environment
    if (!process.env.MONGODB_URI || !process.env.VOYAGE_API_KEY) {
      console.error('❌ Missing required environment variables.');
      console.error('Please set MONGODB_URI and VOYAGE_API_KEY');
      process.exit(1);
    }

    // Initialize storage connection
    try {
      console.error('🔄 Connecting to MongoDB...');
      await this.storageService.connect();
      console.error('✅ Connected to MongoDB');

      // Get stats
      const stats = await this.storageService.getStats();
      console.error(`📊 Documents: ${stats.totalDocuments}`);
      console.error(`🎯 Model: ${config.embedding.model} (${config.embedding.dimensions}d)`);
      
      if (stats.totalDocuments === 0) {
        console.error('⚠️  No documents indexed. Run: npm run index');
      }
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      throw error;
    }

    // Start MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('✅ MongoDB Semantic Docs MCP Server v9.0.0 started');
    console.error('🚀 Using clean architecture with voyage-context-3');
  }

  async stop(): Promise<void> {
    await this.storageService.disconnect();
  }
}

// Run the server
const server = new MongoDBSemanticMCP();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

// Start the server
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default MongoDBSemanticMCP;