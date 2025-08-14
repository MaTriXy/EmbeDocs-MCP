#!/usr/bin/env node
/**
 * MongoDB Semantic Docs MCP Server v7.2.2
 * Lightning-fast semantic search for MongoDB documentation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { HybridSearchEngine } from './core/hybrid-search-engine.js';
import { DocumentRefresher } from './core/document-refresher.js';

// Load environment variables
dotenv.config();

class MongoDBSemanticMCP {
  private server: Server;
  private searchEngine: HybridSearchEngine;
  private refresher: DocumentRefresher;

  constructor() {
    this.server = new Server(
      {
        name: 'mongodocs-mcp',
        version: '5.0.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          },
        },
      }
    );

    this.searchEngine = new HybridSearchEngine();
    this.refresher = new DocumentRefresher();

    this.registerTools();
  }

  private registerTools(): void {
    // Register available MCP tools (search operations only)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'mongodb-semantic-search',
          description: 'Search MongoDB and Voyage AI documentation using natural language semantic search',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language question or search query',
              },
              products: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by MongoDB products or Voyage AI docs',
              },
              version: {
                type: 'string',
                description: 'MongoDB version (e.g., "7.0", "8.0")',
              },
              limit: {
                type: 'number',
                description: 'Number of results to return',
                default: 5,
                minimum: 1,
                maximum: 20,
              },
              includeCode: {
                type: 'boolean',
                description: 'Include code examples in results',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'mongodb-find-similar',
          description: 'Find MongoDB and Voyage AI documentation similar to provided content',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Reference content to find similar documents',
              },
              limit: {
                type: 'number',
                description: 'Number of results to return',
                default: 5,
                minimum: 1,
                maximum: 10,
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'mongodb-explain-concept',
          description: 'Get comprehensive explanation of a MongoDB or Voyage AI concept',
          inputSchema: {
            type: 'object',
            properties: {
              concept: {
                type: 'string',
                description: 'MongoDB or Voyage AI concept to explain',
              },
              depth: {
                type: 'string',
                description: 'Level of detail',
                enum: ['beginner', 'intermediate', 'advanced'],
                default: 'intermediate',
              },
            },
            required: ['concept'],
          },
        },
        {
          name: 'mongodb-refresh-docs',
          description: 'Update MongoDB and Voyage AI documentation database',
          inputSchema: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                description: 'Refresh mode',
                enum: ['incremental', 'full'],
                default: 'incremental',
              },
              products: {
                type: 'array',
                items: { type: 'string' },
                description: 'Products to refresh (including Voyage AI)',
              },
            },
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
            return await this.handleSemanticSearch(args);
          case 'mongodb-find-similar':
            return await this.handleFindSimilar(args);
          case 'mongodb-explain-concept':
            return await this.handleExplainConcept(args);
          case 'mongodb-refresh-docs':
            return await this.handleRefreshDocs(args);
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

  private async handleSemanticSearch(args: any) {
    try {
      console.error(`🔍 Searching for: "${args.query}"`);
      
      const filter = this.buildFilter(args);
      const results = await this.searchEngine.search(
        args.query,
        {
          limit: args.limit || 5,
          filter,
          includeCode: args.includeCode,
        }
      );
      
      console.error(`✅ Found ${results.length} results`);
      
      // Always return proper response, even if no results
      if (!results || results.length === 0) {
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

  private async handleFindSimilar(args: any) {
    try {
      const results = await this.searchEngine.findSimilar(
        args.content,
        args.limit || 5
      );
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatSimilarResults(results),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Find similar failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleExplainConcept(args: any) {
    try {
      const explanation = await this.searchEngine.explainConcept(
        args.concept,
        args.depth || 'intermediate'
      );
      
      return {
        content: [
          {
            type: 'text',
            text: explanation,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Explain concept failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleRefreshDocs(args: any) {
    try {
      const result = await this.refresher.refresh({
        mode: args.mode || 'incremental',
        products: args.products,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Refresh completed: ${result.documentsUpdated || 0} documents updated.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleStatus() {
    try {
      const status = await this.searchEngine.getStatus();
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatStatus(status),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}\nPlease run the indexer first.`,
          },
        ],
      };
    }
  }

  private buildFilter(args: any): any {
    const filter: any = {};

    if (args.products && args.products.length > 0) {
      filter['metadata.product'] = { $in: args.products };
    }

    if (args.version) {
      filter['metadata.version'] = args.version;
    }

    if (args.includeCode) {
      filter['metadata.hasCode'] = true;
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  private formatSearchResults(results: any[]): string {
    if (results.length === 0) {
      return 'No results found. Try refining your search query.';
    }

    let output = `Found ${results.length} relevant documents:\n\n`;

    results.forEach((result, index) => {
      // Extract product and title from documentId (format: product_version_hash)
      const parts = result.documentId?.split('_') || [];
      const product = parts[0] || 'unknown';
      const title = `Document ${result.documentId || index + 1}`;
      const score = result.maxScore || result.score || 0;
      
      output += `## ${index + 1}. ${title}\n`;
      output += `**Product**: ${product} | **Score**: ${score.toFixed(3)} | **Source**: ${result.source || 'vector'}\n`;
      output += `**Document ID**: ${result.documentId}\n\n`;

      // Show content from chunks
      if (result.chunks && result.chunks.length > 0) {
        const topChunks = result.chunks.slice(0, 2);
        topChunks.forEach((chunk: any, chunkIndex: number) => {
          output += `**Chunk ${chunkIndex + 1}** (Score: ${chunk.score?.toFixed(3) || 'N/A'}):\n`;
          output += `${chunk.content}\n\n`;
        });
      } else if (result.content) {
        output += `${result.content.substring(0, 300)}...\n\n`;
      }

      output += '---\n\n';
    });

    return output;
  }

  private formatSimilarResults(results: any[]): string {
    if (results.length === 0) {
      return 'No similar documents found.';
    }

    let output = `Found ${results.length} similar documents:\n\n`;

    results.forEach((result, index) => {
      const title = result.metadata?.title || result.title || 'Document';
      const url = result.metadata?.url || result.url || '#';
      const score = result.score || 0;
      
      output += `${index + 1}. **${title}** (Score: ${score.toFixed(3)})\n`;
      if (result.content) {
        output += `   ${result.content.substring(0, 150)}...\n`;
      }
      output += `   ${url}\n\n`;
    });

    return output;
  }

  private formatStatus(status: any): string {
    return `**MongoDB Semantic Docs MCP Status**

📊 **Database Statistics:**
- Total Documents: ${status.totalDocuments}
- Total Chunks: ${status.totalChunks}
- Index Status: ${status.indexStatus}
- Last Update: ${status.lastUpdate}

🔍 **Search Performance:**
- Average Query Time: ${status.avgQueryTime}ms
- Total Searches Today: ${status.searchesToday}

💾 **Storage:**
- Database Size: ${status.dbSize}
- Vector Index Size: ${status.indexSize}

✅ **System Health:** ${status.health}`;
  }

  async start(): Promise<void> {
    // Check if environment is configured
    if (!process.env.MONGODB_URI || !process.env.VOYAGE_API_KEY) {
      console.error('Missing required environment variables.');
      console.error('Please set MONGODB_URI and VOYAGE_API_KEY');
      console.error('Or run: mongodocs-index --setup');
      process.exit(1);
    }

    // Initialize connections - CRITICAL: Must succeed for MCP to work!
    try {
      console.error('Initializing search engine...');
      await this.searchEngine.initialize();
      console.error('✅ Search engine initialized');

      // CRITICAL FIX: Verify vector search index is ready
      console.error('Verifying vector search index...');
      await this.verifyVectorSearchIndex();
      console.error('✅ Vector search index verified');

      // CRITICAL FIX: Test search functionality
      console.error('Testing search functionality...');
      await this.testSearchFunctionality();
      console.error('✅ Search functionality verified');

      console.error('Initializing document refresher...');
      await this.refresher.initialize();
      console.error('✅ Document refresher initialized');
    } catch (error) {
      console.error('❌ FATAL: Failed to initialize MongoDB connection:', error);
      console.error('Please check:');
      console.error('1. MONGODB_URI environment variable is set');
      console.error('2. VOYAGE_API_KEY environment variable is set');
      console.error('3. MongoDB Atlas is accessible');
      console.error('4. Network connection is working');
      console.error('5. Vector search index is ready');
      console.error('6. Database contains indexed documents');
      throw error;  // FAIL FAST - Don't start broken MCP!
    }

    // Start the MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('MongoDB Semantic Docs MCP Server v7.2.2 started');
    console.error('Ready for lightning-fast searches!');
    console.error(`Connected to: ${process.env.MONGODB_URI?.split('@')[1]?.split('/')[0] || 'MongoDB'}`);

    // Get actual document count
    const status = await this.searchEngine.getStatus();
    console.error(`Documents indexed: ${status.totalDocuments || 0}`);
  }

  /**
   * CRITICAL FIX: Verify vector search index is ready
   */
  private async verifyVectorSearchIndex(): Promise<void> {
    const mongodb = this.searchEngine['mongodb']; // Access private member
    const collection = mongodb.getVectorsCollection();

    // Check if index exists and is ready
    const indexes = await collection.listSearchIndexes().toArray();
    const vectorIndex = indexes.find((i: any) => i.name === 'semantic_search') as any;

    if (!vectorIndex) {
      throw new Error('Vector search index "semantic_search" not found. Please run the indexer first.');
    }

    if (vectorIndex.status !== 'READY') {
      throw new Error(`Vector search index is not ready. Status: ${vectorIndex.status}. Please wait for index to build.`);
    }
  }

  /**
   * CRITICAL FIX: Test search functionality with a simple query
   */
  private async testSearchFunctionality(): Promise<void> {
    try {
      // Test with a simple MongoDB query
      const testResults = await this.searchEngine.search('mongodb find', { limit: 1 });

      if (!Array.isArray(testResults)) {
        throw new Error('Search returned invalid results format');
      }

      // Check if we have any documents at all
      const mongodb = this.searchEngine['mongodb'];
      const collection = mongodb.getVectorsCollection();
      const docCount = await collection.countDocuments();

      if (docCount === 0) {
        throw new Error('No documents found in database. Please run the indexer first.');
      }

      console.error(`Database contains ${docCount} documents`);
    } catch (error) {
      throw new Error(`Search functionality test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stop(): Promise<void> {
    // Cleanup connections - methods will be implemented in engines
    // await this.searchEngine.close();
    // await this.refresher.close();
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
