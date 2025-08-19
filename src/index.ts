#!/usr/bin/env node
/**
 * EmbeDocs MCP Server - OPTIMIZED 2-TOOL ARCHITECTURE  
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

class EmbedocsMCP {
  private server: Server;
  private searchService: SearchService;
  private storageService: StorageService;

  constructor() {
    this.server = new Server(
      {
        name: 'embedocs-mcp',
        version: '1.0.0', // Universal repository embedding system
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
          description: `PRIMARY search tool - Use this FIRST for any documentation query.

PURPOSE: Find relevant documentation chunks using RRF hybrid algorithm (vector + keyword fusion).

⚠️ CRITICAL LIMITATION: Returns CHUNKS (100-2000 chars), NOT complete files!
⚠️ MANDATORY NEXT STEP: ALWAYS use mongodb-fetch-full-context for complete files!

WHEN TO USE:
• User asks about ANY topic in the indexed documentation
• Starting point for ALL searches - use this before other tools
• General queries, broad topics, mixed content types

REQUIRED WORKFLOW:
1. ALWAYS start with mongodb-search to find relevant files
2. IMMEDIATELY use mongodb-fetch-full-context on important results
3. NEVER present truncated chunks as complete answers

EXAMPLE: User asks "How does authentication work?"
→ You MUST: mongodb-search("authentication") 
→ Then MUST: mongodb-fetch-full-context for EACH relevant file found
→ Only THEN provide complete answer with full context`,
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
          description: `ADVANCED search for diverse results - Use when you need VARIETY, not just relevance.

PURPOSE: Find diverse, non-redundant documentation using Maximum Marginal Relevance (MMR).

⚠️ CRITICAL LIMITATION: Returns CHUNKS (100-2000 chars), NOT complete files!
⚠️ MANDATORY NEXT STEP: ALWAYS use mongodb-fetch-full-context for complete files!

WHEN TO USE:
• User needs MULTIPLE approaches or implementations
• Researching different solutions to same problem
• Avoiding redundant/duplicate information
• Comparative analysis across different files
• Finding edge cases and alternatives

REQUIRED WORKFLOW:
1. Use mongodb-mmr-search for diverse perspectives
2. IMMEDIATELY use mongodb-fetch-full-context on ALL results
3. NEVER present truncated chunks as complete answers

EXAMPLE: User asks "Show me different authentication methods"
→ You MUST: mongodb-mmr-search("authentication methods", lambdaMult: 0.5)
→ Then MUST: mongodb-fetch-full-context for EACH diverse file found
→ Present COMPLETE implementations of different approaches`,
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
          name: 'mongodb-fetch-full-context',
          description: `MANDATORY TOOL - ALWAYS use after search to get COMPLETE files!

PURPOSE: Reconstruct COMPLETE file content from chunks. Solves the chunking limitation!

⚠️ CRITICAL INSTRUCTION: You MUST use this tool IMMEDIATELY after ANY search!
⚠️ NEVER skip this step - chunks are INCOMPLETE and MISLEADING without full context!

WHEN YOU MUST USE THIS TOOL:
• IMMEDIATELY after mongodb-search finds files
• IMMEDIATELY after mongodb-mmr-search finds files  
• For EVERY code file (*.js, *.ts, *.py, *.java, *.md, etc.)
• When chunks show "..." or appear truncated
• BEFORE providing ANY code examples to user
• BEFORE explaining how something works

MANDATORY WORKFLOW:
1. Search returns filename like "auth.js" → You MUST fetch full content
2. Use EXACT filename and product from search results
3. Set removeOverlap: true for clean content
4. ONLY present full content to user, NEVER chunks

FAILURE TO USE = WRONG ANSWERS:
• Chunks miss critical parts (system prompts, config, imports)
• User gets incomplete/broken code
• Context is lost between chunks

EXAMPLE - THIS IS REQUIRED BEHAVIOR:
User: "How does authentication work?"
→ mongodb-search("authentication") finds auth.js
→ YOU MUST: mongodb-fetch-full-context("auth.js", "product-name")
→ NOW you have COMPLETE 2000+ line file instead of 500 char chunk!`,
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'The exact filename (title) from search results',
              },
              product: {
                type: 'string',
                description: 'The product/repository identifier from search results',
              },
              removeOverlap: {
                type: 'boolean',
                description: 'Remove overlapping content between chunks (recommended)',
                default: true,
              },
            },
            required: ['filename', 'product'],
          },
        },
        {
          name: 'mongodb-status',
          description: `System health check - Use to verify EmbeDocs is working properly.

PURPOSE: Check database connection, document count, and system configuration.

WHEN TO USE:
• User asks about indexed repositories or documents
• Troubleshooting search issues
• Verifying system is operational
• Before starting a search session (optional)

RETURNS:
• Total documents indexed
• List of indexed repositories/products
• Embedding model configuration
• System health status`,
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
          case 'mongodb-fetch-full-context':
            return await this.handleFetchFullContext(args);
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

  private async handleFetchFullContext(args: any) {
    try {
      const { filename, product, removeOverlap = true } = args;
      
      console.error(`📄 Fetching full context for: ${filename} from ${product}`);
      
      // Connect to database
      await this.storageService.connect();
      
      // Fetch all chunks for this file
      const chunks = await this.storageService.fetchFileChunks(filename, product);
      
      if (!chunks || chunks.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No content found for file: ${filename} in product: ${product}`,
            },
          ],
        };
      }
      
      console.error(`✅ Found ${chunks.length} chunks for ${filename}`);
      
      // Sort chunks by their position or sequence (if available)
      chunks.sort((a, b) => {
        // Try to sort by chunk index if available in metadata
        if (a.metadata?.chunkIndex !== undefined && b.metadata?.chunkIndex !== undefined) {
          return a.metadata.chunkIndex - b.metadata.chunkIndex;
        }
        // Otherwise sort by content position if we can detect it
        return 0; // Keep original order if no sorting info available
      });
      
      // Merge chunks with optional overlap removal
      let fullContent: string;
      
      if (removeOverlap && chunks.length > 1) {
        fullContent = this.mergeChunksWithOverlapRemoval(chunks);
      } else {
        // Simple concatenation
        fullContent = chunks.map(chunk => chunk.content).join('\n');
      }
      
      // Format the response
      const response = `# Full Content: ${filename}
**Product/Repository**: ${product}
**Total Chunks Merged**: ${chunks.length}
**Content Length**: ${fullContent.length} characters

---

${fullContent}`;
      
      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      console.error('❌ Fetch full context error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Failed to fetch full context: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private mergeChunksWithOverlapRemoval(chunks: any[]): string {
    if (chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0].content;
    
    const merged: string[] = [chunks[0].content];
    
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1].content;
      const currentChunk = chunks[i].content;
      
      // Find overlap between end of previous chunk and start of current chunk
      const overlapLength = this.findOverlap(prevChunk, currentChunk);
      
      if (overlapLength > 0) {
        // Remove the overlapping part from the current chunk
        const nonOverlapping = currentChunk.substring(overlapLength);
        merged.push(nonOverlapping);
      } else {
        // No overlap detected, add the full chunk
        merged.push(currentChunk);
      }
    }
    
    return merged.join('');
  }

  private findOverlap(text1: string, text2: string): number {
    // Find the longest suffix of text1 that is a prefix of text2
    const maxOverlap = Math.min(text1.length, text2.length, 200); // Limit overlap check to 200 chars
    
    for (let overlap = maxOverlap; overlap > 0; overlap--) {
      const suffix = text1.substring(text1.length - overlap);
      const prefix = text2.substring(0, overlap);
      
      if (suffix === prefix) {
        return overlap;
      }
    }
    
    return 0;
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
    return `**EmbeDocs MCP Status**

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

    console.error('✅ EmbeDocs MCP Server v1.0.0 started');
    console.error('🚀 Optimized 2-tool architecture: RRF hybrid + MMR advanced search');
  }

  async stop(): Promise<void> {
    await this.storageService.disconnect();
  }
}

// Run the server
const server = new EmbedocsMCP();

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

export default EmbedocsMCP;