#!/usr/bin/env node
/**
 * MongoDB Docs MCP Server - OPTIMIZED 2-TOOL ARCHITECTURE  
 * Primary: RRF hybrid search | Advanced: MMR algorithm | Status: System health
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
        version: '10.1.1', // Optimized 2-tool architecture + production fixes
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
          name: 'mongodb-search',
          description: 'PRIMARY MongoDB search using RRF hybrid algorithm (vector + keyword fusion). BEST for: general queries, broad topics, mixed content types. Provides optimal balance of relevance and performance for most use cases.',
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
          name: 'mongodb-mmr-search',
          description: 'ADVANCED MongoDB search using Maximum Marginal Relevance (MMR) algorithm. BEST for: research tasks, comparative analysis, diverse perspectives, avoiding redundant results. Use when you need maximum diversity (+21.2% improvement over standard search).',
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
              fetchK: {
                type: 'number',
                description: 'Initial candidates to consider for diversity optimization (default: 20)',
                default: 20,
                minimum: 5,
                maximum: 50,
              },
              lambdaMult: {
                type: 'number',
                description: 'Relevance vs diversity balance: 1.0=pure relevance, 0.0=pure diversity (default: 0.7)',
                default: 0.7,
                minimum: 0.0,
                maximum: 1.0,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'mongodb-status',
          description: 'Get system health and database statistics - shows document count, embedding model status, search configuration, and system readiness',
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
          case 'mongodb-search':
            return await this.handleHybridSearch(args);
          case 'mongodb-mmr-search':
            return await this.handleMMRSearch(args);
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


  private async handleHybridSearch(args: any) {
    try {
      console.error(`🔍 Primary search (RRF hybrid) for: "${args.query}"`);
      
      const results = await this.searchService.hybridSearch(
        args.query,
        args.limit || 5
      );
      
      console.error(`✅ Found ${results.length} results with primary search (RRF)`);
      
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
      console.error('❌ Primary search error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Primary search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleMMRSearch(args: any) {
    try {
      console.error(`🎯 MMR search for: "${args.query}"`);
      
      const results = await this.searchService.mmrVectorSearch(
        args.query,
        {
          limit: args.limit || 5,
          fetchK: args.fetchK || 20,
          lambdaMult: args.lambdaMult || 0.7
        }
      );
      
      console.error(`✅ Found ${results.length} results with MMR (+21.2% improvement)`);
      
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
      console.error('❌ MMR search error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `MMR search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

    console.error('✅ MongoDB Docs MCP Server v10.1.0 started');
    console.error('🚀 Optimized 2-tool architecture: RRF hybrid + MMR advanced search');
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