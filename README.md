# mongodocs-mcp

MongoDB documentation MCP server for Claude/Cursor. Search MongoDB docs, tutorials, and AI examples directly in your AI editor.

## What This Does

Provides MongoDB knowledge to Claude/Cursor through semantic search of:
- Official MongoDB documentation
- GenAI examples (RAG, Vector Search)
- Production code examples
- Interactive tutorials

## Prerequisites

1. **MongoDB Atlas** account (free tier works)
2. **Voyage AI** API key for embeddings
3. **Node.js** 18+
4. **Cursor** or Claude Desktop

## Installation

### Step 1: Get Your Keys

#### MongoDB Atlas Connection String
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free cluster (M0)
3. Click "Connect" → "Drivers"
4. Copy connection string (starts with `mongodb+srv://`)

#### Voyage AI API Key
1. Go to [Voyage AI](https://www.voyageai.com)
2. Sign up and get API key
3. Copy key (starts with `pa-`)

### Step 2: Install Package

```bash
npm install -g mongodocs-mcp
```

### Step 3: Index Documentation (One-Time Setup)

```bash
# Set your keys
export MONGODB_URI="mongodb+srv://YOUR_CONNECTION_STRING"
export VOYAGE_API_KEY="pa-YOUR_API_KEY"

# Index documentation (takes ~15 minutes)
mongodocs-index
```

This downloads and indexes ~10,000 documents from:
- MongoDB official docs
- GenAI Showcase (3.9k stars)
- MongoDB Chatbot (RAG implementation)
- Vector Search tutorials
- Multimodal AI examples

### Step 4: Configure Cursor

Add to `.cursor/settings.json` in your project:

```json
{
  "mcpServers": {
    "mongodocs": {
      "command": "npx",
      "args": ["mongodocs-mcp"],
      "env": {
        "MONGODB_URI": "mongodb+srv://YOUR_CONNECTION_STRING",
        "VOYAGE_API_KEY": "pa-YOUR_API_KEY"
      }
    }
  }
}
```

Restart Cursor after adding configuration.

## Usage

### In Cursor/Claude

Ask questions like:
- "How do I implement vector search in MongoDB?"
- "Show me RAG examples with MongoDB"
- "How to create a search index?"

The MCP provides three search methods:
- **Semantic search** - finds conceptually related docs
- **Keyword search** - exact term matching
- **Hybrid search** - combines both methods

### Keep Documentation Updated

```bash
# Weekly update (only re-indexes changed files)
mongodocs-index update
```

### CLI Commands

```bash
mongodocs-index          # Full index (first time)
mongodocs-index update   # Smart update (only changed files)
mongodocs-index clean    # Clear database
mongodocs-index stats    # Show statistics
mongodocs-index test     # Test embeddings
```

## Troubleshooting

### "Database is empty"
Run `mongodocs-index` to populate database.

### "Dimension mismatch error"
Clean and re-index:
```bash
mongodocs-index clean
mongodocs-index
```

### "Connection refused"
Check MongoDB URI and network access:
1. Atlas → Network Access → Add your IP
2. Verify connection string is correct

### "Rate limit exceeded"
Voyage AI free tier limit hit. Wait or upgrade plan.

## Architecture

- **Embeddings**: voyage-context-3 (1024 dimensions)
- **Database**: MongoDB Atlas
- **Search**: Vector search + text search with RRF
- **Repositories**: 5 curated MongoDB repos
- **Updates**: Git-based incremental indexing

## Performance

- Initial index: ~15 minutes
- Smart update: ~2 minutes
- Search latency: <500ms
- Documents: ~10,000
- Storage: ~200MB in MongoDB

## Development

```bash
# Clone repo
git clone https://github.com/romiluz/mongodocs-mcp.git
cd mongodocs-mcp

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start
```

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/romiluz/mongodocs-mcp/issues)
- Author: Rom Iluz