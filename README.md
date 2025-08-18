# MongoDB Documentation MCP

**Production-ready MongoDB semantic search for Claude and Cursor IDEs**

Provides instant access to MongoDB documentation through advanced semantic search with voyage-context-3 embeddings and MongoDB Atlas Vector Search.

## Core Features

- **Smart Indexing**: Git-based change detection - only processes what changed
- **Advanced Search**: Vector + keyword hybrid with MMR (Maximum Marginal Relevance) 
- **Production-Grade**: Built on MongoDB Atlas Vector Search with 7.5x speed optimization
- **Comprehensive Coverage**: 10,596 documents from 5 curated MongoDB repositories
- **Always Current**: Automated incremental updates track git commits

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

Ask MongoDB questions directly in your IDE:

```
How do I implement vector search in MongoDB?
Show me RAG examples with MongoDB Atlas
What's the syntax for compound indexes?
How to optimize aggregation performance?
```

The system provides three search modes:
- **Vector Search**: Semantic similarity using voyage-context-3
- **Hybrid Search**: Combines vector + keyword with RRF
- **MMR Search**: Maximizes relevance while ensuring diversity

## Commands

```bash
mongodocs-index           # Smart indexing (default)
mongodocs-index rebuild   # Force full rebuild  
mongodocs-index clean     # Clear database
mongodocs-index stats     # Show statistics
mongodocs-index test      # Test embedding service
```

## Smart Indexing System

**First Run:**
```
🔄 Smart indexing - checking for repository changes...
🆕 MongoDB Official Documentation first time indexing...
```

**Subsequent Runs:**
```  
🔄 Smart indexing - checking for repository changes...
✅ MongoDB Official Documentation up to date (a1b2c3d4), skipping...
✅ MongoDB Manual up to date (e5f6g7h8), skipping...
✅ Smart update complete!
```

The system stores git commit hashes and only processes changed files, eliminating unnecessary re-indexing.

## Architecture

**Embeddings:** voyage-context-3 (1024 dimensions)  
**Database:** MongoDB Atlas Vector Search  
**Search:** RRF hybrid with MMR diversity selection  
**Indexing:** Advanced semantic chunking with token validation  
**Updates:** Git commit hash tracking for incremental processing  

**Performance Optimizations:**
- MongoDB Atlas 40-candidate search (7.5x faster than default 300)
- Emergency token splitting for large documents (32K context limit)
- Batch processing with graceful error recovery
- Smart chunk sizing (100-2500 characters) prevents data loss

## Indexed Repositories

1. **MongoDB Official Docs** - Complete documentation
2. **GenAI Showcase** - Vector search examples  
3. **Chatbot Starter** - RAG implementations
4. **Driver Examples** - Language-specific code
5. **Community Tutorials** - Best practices

**Total Coverage:** 10,596 documents, ~200MB storage

## Performance

- **Initial indexing:** 10-15 minutes
- **Smart updates:** 30 seconds - 2 minutes  
- **Search latency:** <500ms
- **Memory usage:** <100MB during indexing
- **Storage:** ~200MB in MongoDB Atlas

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
- **Version:** 10.0.3