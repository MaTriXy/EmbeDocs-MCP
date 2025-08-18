# MongoDB Documentation MCP

MongoDB semantic documentation search server implementing the Model Context Protocol (MCP) for IDE integration with Claude and Cursor.

Transforms MongoDB documentation into searchable vector embeddings using Voyage AI's voyage-context-3 model (1024 dimensions) and MongoDB Atlas Vector Search, enabling natural language queries against comprehensive MongoDB documentation corpus.

## Technical Architecture

- **Embedding Model**: voyage-context-3 (1024-dimensional vectors) - optimized for technical documentation
- **Vector Database**: MongoDB Atlas Vector Search with cosine similarity indexing
- **Search Algorithms**: RRF (Reciprocal Rank Fusion) hybrid + MMR (Maximum Marginal Relevance)
- **Smart Indexing**: Git commit hash tracking with incremental processing
- **Document Coverage**: 10,596 indexed documents from 5 MongoDB repositories
- **MCP Protocol**: Clean 2-tool architecture following Context7 patterns

## Prerequisites

- **Node.js** 18+
- **MongoDB Atlas** (free M0 cluster sufficient)  
- **Voyage AI** API key
- **Claude Desktop** or **Cursor IDE**

## Quick Start

### 1. Get API Keys

**MongoDB Atlas:**
1. [Create free cluster](https://cloud.mongodb.com) (M0 tier)
2. Get connection string: Database → Connect → Drivers
3. Copy URI starting with `mongodb+srv://`

**Voyage AI:**
1. [Get API key](https://www.voyageai.com) 
2. Copy key starting with `pa-`

### 2. Install & Index

```bash
# Install globally
npm install -g mongodocs-mcp

# Set credentials
export MONGODB_URI="mongodb+srv://your-connection-string"
export VOYAGE_API_KEY="pa-your-api-key"

# Initial indexing (10-15 minutes)
mongodocs-index
```

### 3. Configure IDE

**For Cursor IDE** - Add to `.cursor/settings.json`:
```json
{
  "mcpServers": {
    "mongodocs": {
      "command": "npx",
      "args": ["mongodocs-mcp"],
      "env": {
        "MONGODB_URI": "mongodb+srv://your-connection-string",
        "VOYAGE_API_KEY": "pa-your-api-key"
      }
    }
  }
}
```

**For Claude Desktop** - Add to MCP settings:
```json
{
  "mcpServers": {
    "mongodocs": {
      "command": "mongodocs-mcp",
      "env": {
        "MONGODB_URI": "mongodb+srv://your-connection-string", 
        "VOYAGE_API_KEY": "pa-your-api-key"
      }
    }
  }
}
```

Restart your IDE after configuration.

## Usage

Query MongoDB documentation using natural language through your IDE:

```
How do I implement vector search in MongoDB?
Show me RAG examples with MongoDB Atlas
What's the syntax for compound indexes?
How to optimize aggregation performance?
```

**MCP Tool Architecture**:
- `mongodb-search`: RRF hybrid algorithm (vector + keyword fusion) - primary search method
- `mongodb-mmr-search`: Maximum Marginal Relevance algorithm - diverse result optimization

## Commands

```bash
mongodocs-index           # Smart indexing (default)
mongodocs-index rebuild   # Force full rebuild  
mongodocs-index clean     # Clear database
mongodocs-index stats     # Show statistics
mongodocs-index test      # Test embedding service
```

## Incremental Indexing

**Initial Processing:**
```
🔄 Smart indexing - checking for repository changes...
🆕 MongoDB Official Documentation first time indexing...
```

**Delta Updates:**
```  
🔄 Smart indexing - checking for repository changes...
✅ MongoDB Official Documentation up to date (a1b2c3d4), skipping...
✅ MongoDB Manual up to date (e5f6g7h8), skipping...
✅ Smart update complete!
```

Git commit hash comparison enables differential processing - only changed documents trigger re-embedding and storage operations.

## Implementation Details

**Vector Embedding Pipeline:**
- Model: voyage-context-3 (1024 dimensions, optimized for documentation)
- Chunking: Semantic content splitting (100-2000 characters)
- Normalization: Cosine similarity with L2 normalization

**MongoDB Atlas Configuration:**
- Vector Index: Cosine similarity, 40 numCandidates (7.5x speed optimization)
- Text Index: Lucene analyzers for keyword search
- Storage: Bulk upsert operations with graceful error handling

**Search Algorithm Implementation:**
- **RRF (Reciprocal Rank Fusion)**: Combined vector + keyword ranking with tuned weights
- **MMR (Maximum Marginal Relevance)**: Diversity optimization using cosine similarity calculations
- **Performance**: Sub-500ms response times with optimized candidate selection

**Data Processing:**
- Git-based incremental updates prevent redundant processing  
- Token validation ensures embedding model compatibility
- Batch processing with p-limit concurrency control

## Document Corpus

**Repository Sources:**
1. `mongodb/docs` - Official MongoDB documentation
2. `mongodb/docs-generative-ai-showcase` - Vector search examples  
3. `mongodb/atlas-search-playground-chatbot-starter` - RAG implementations
4. `mongodb/drivers-examples` - Language-specific implementations
5. `mongodb-developer/code-examples` - Community patterns

**Processing Statistics:**
- Documents: 10,596 indexed chunks
- Storage: ~200MB in MongoDB Atlas
- Coverage: Complete MongoDB ecosystem documentation

## Performance Metrics

**Indexing Operations:**
- Initial processing: 10-15 minutes (10,596 documents)
- Incremental updates: 30 seconds - 2 minutes  
- Memory utilization: <100MB during batch processing

**Search Performance:**
- Query latency: <500ms (99th percentile)
- Vector search: 40 candidates vs 300 default (7.5x optimization)
- Storage footprint: ~200MB in MongoDB Atlas

## Troubleshooting

**No search results:**
```bash
mongodocs-index stats  # Check if database is populated
```

**Dimension errors:**
```bash
mongodocs-index clean && mongodocs-index  # Fresh rebuild
```

**Connection issues:**
1. Verify MongoDB URI format
2. Check Atlas Network Access (add your IP)
3. Confirm database user permissions

## Development

```bash
git clone https://github.com/romiluz/mongodocs-mcp.git
cd mongodocs-mcp
npm install
npm run build
npm start
```

## License

MIT License - see LICENSE file

## Support

- **Issues:** [GitHub Issues](https://github.com/romiluz/mongodocs-mcp/issues)
- **Author:** Rom Iluz
- **Version:** 10.1.1 - Production-Ready Vector Search MCP