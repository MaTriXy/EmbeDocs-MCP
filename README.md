# 🚀 MongoDB Semantic MCP

[![NPM Version](https://img.shields.io/npm/v/mongodocs-mcp)](https://www.npmjs.com/package/mongodocs-mcp)
[![License](https://img.shields.io/npm/l/mongodocs-mcp)](LICENSE)
[![Node Version](https://img.shields.io/node/v/mongodocs-mcp)](package.json)
[![GitHub Stars](https://img.shields.io/github/stars/romiluz13/MongoDocs-MCP)](https://github.com/romiluz13/MongoDocs-MCP)

Lightning-fast semantic search for MongoDB & Voyage AI documentation via Model Context Protocol (MCP).

## ✨ Features

- **🔍 Semantic Search**: Natural language queries across 10,000+ MongoDB documents
- **⚡ Lightning Fast**: <500ms search latency with vector embeddings
- **🎨 Beautiful CLI**: Professional interface with ASCII art and progress bars
- **🧠 Smart AI**: Uses voyage-code-3 for code, voyage-3 for text
- **📊 Comprehensive**: 52 documentation sources, 10,392 documents indexed
- **🔄 Hybrid Search**: Combines vector + keyword search for best results
- **🎯 MCP Integration**: Seamlessly works with Cursor IDE and other MCP clients

## 📦 Installation

### Via NPM (Recommended)
```bash
npm install -g mongodocs-mcp
```

### For Cursor IDE
Add to your MCP settings (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "mongodocs": {
      "command": "npx",
      "args": ["mongodocs-mcp"],
      "env": {
        "MONGODB_URI": "your-mongodb-uri",
        "VOYAGE_API_KEY": "your-voyage-key"
      }
    }
  }
}
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas cluster (free tier works!)
- Voyage AI API key ([Get one here](https://voyage.ai))

### 1. Install
```bash
npm install -g mongodocs-mcp
```

### 2. Setup (Interactive Wizard)
```bash
mongodocs-setup
```
The beautiful setup wizard will guide you through:
- 🔗 MongoDB Atlas connection
- 🔑 Voyage AI API key
- 📊 Vector index creation

### 3. Index Documentation (One-time)
```bash
mongodocs-index
```
Indexes 10,000+ documents from:
- MongoDB Manual (v8.0)
- All major drivers (Node.js, Python, Go, etc.)
- Atlas documentation
- GenAI showcase examples
- Voyage AI documentation

### 4. Start MCP Server
```bash
mongodocs-mcp
```

### 5. Configure Cursor IDE
Add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "mongodocs": {
      "command": "npx",
      "args": ["mongodocs-mcp"],
      "env": {
        "MONGODB_URI": "your-mongodb-uri",
        "VOYAGE_API_KEY": "your-voyage-key"
      }
    }
  }
}
```

## 🛠️ MCP Tools

### `search_mongodb_docs`
Search MongoDB documentation using natural language.
```javascript
{
  "query": "how to create compound index",
  "limit": 5,
  "products": ["manual", "nodejs"]
}
```

### `explain_mongodb_concept`
Get detailed explanations of MongoDB concepts.
```javascript
{
  "concept": "aggregation pipeline",
  "depth": "intermediate"
}
```

### `find_similar_docs`
Find documents similar to provided content.
```javascript
{
  "content": "db.collection.createIndex({field1: 1, field2: -1})",
  "limit": 5
}
```

### `get_search_status`
Get system status and statistics.
```javascript
// Returns document count, products indexed, health status
```

## 📊 Performance

- **Documents**: 10,392 indexed
- **Search Latency**: <500ms average
- **Relevance Scores**: 0.75-0.89 typical
- **Index Size**: ~140MB
- **Memory Usage**: <500MB

## 🎨 Beautiful CLI

The CLI features:
- ASCII art with gradient colors
- Real-time progress bars
- Animated spinners
- Styled tables
- Interactive prompts

```
   __  __                        ____  ____  
  |  \/  | ___  _ __   __ _  ___|  _ \| __ ) 
  | |\/| |/ _ \| '_ \ / _` |/ _ \ | | |  _ \ 
  | |  | | (_) | | | | (_| | (_) | |_| | |_) |
  |_|  |_|\___/|_| |_|\__, |\___/|____/|____/ 
                      |___/                    
        🚀 Semantic Search MCP Server
```

## 🔧 Configuration

### Environment Variables
```bash
# Required
MONGODB_URI=mongodb+srv://...
VOYAGE_API_KEY=pa-...

# Optional
MONGODB_DATABASE=mongodb_semantic_docs  # Default
MONGODB_COLLECTION=documents            # Default
```

### MongoDB Atlas Setup
1. Create Atlas cluster
2. Enable Vector Search
3. Create index named `vector_index`:
```json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 1024,
    "similarity": "cosine"
  }]
}
```

## 📚 Documentation Sources

### Tier 1 - Core Documentation
- MongoDB Manual (v8.0)
- MongoDB Atlas Documentation
- MongoDB Shell Documentation

### Tier 2 - Language Drivers
- Node.js Driver
- Python (PyMongo & Motor)
- Go Driver
- Java Driver
- Rust Driver

### Tier 3 - Specialized
- GenAI Showcase (RAG patterns)
- Voyage AI SDKs
- LangChain MongoDB
- Vector Search Lab

[Full list of 52 sources →](DOCUMENT_SOURCES.md)

## 🧪 Development

### Build from Source
```bash
git clone https://github.com/romiluz/mongodocs-mcp.git
cd mongodocs-mcp
npm install
npm run build
```

### Run Tests
```bash
npm test
```

### Local Development
```bash
npm run dev
```

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a PR

## 📄 License

MIT © Rom Iluz

## 🙏 Acknowledgments

- MongoDB for comprehensive documentation
- Voyage AI for powerful embeddings
- Anthropic for Model Context Protocol
- The MCP community

## 📊 Stats

- **Version**: 8.0.0
- **Downloads**: ![NPM Downloads](https://img.shields.io/npm/dt/mongodocs-mcp)
- **Size**: ~100KB packed
- **Dependencies**: 20

---

Built with ❤️ for the MongoDB community