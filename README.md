# EmbeDocs MCP

**Turn any GitHub repository into an intelligent knowledge base that your AI can search and understand.**

Stop copying code snippets. Stop searching through documentation. Let your AI assistant instantly access and understand entire codebases.

## What is EmbeDocs?

EmbeDocs is a Model Context Protocol (MCP) server that transforms GitHub repositories into searchable, AI-ready knowledge bases. It works seamlessly with Claude, Cursor, and any MCP-compatible IDE.

### 🎯 The Problem

- **Limited Context**: Your AI assistant can't see your entire codebase
- **Manual Copy-Paste**: Constantly copying relevant code into chat
- **Lost Knowledge**: Documentation scattered across multiple repositories
- **No Memory**: AI forgets context between sessions

### ✨ The Solution

EmbeDocs creates a persistent, searchable memory for your AI:

1. **Index Any Repository** → Your code becomes searchable knowledge
2. **Smart Updates** → Only re-indexes changed files (git-based tracking)
3. **Semantic Search** → AI finds relevant code by meaning, not just keywords
4. **Perfect Context** → Your AI understands the full picture

## Quick Start (5 minutes)

### 1. Install

```bash
npm install -g embedocs-mcp
```

### 2. Setup

```bash
embedocs setup
# Opens browser with visual setup wizard
```

### 3. Configure Your IDE

**For Cursor:**
Add to `.cursor/settings.json`:

```json
{
  "mcpServers": {
    "embedocs": {
      "command": "npx",
      "args": ["embedocs-mcp"],
      "env": {
        "MONGODB_URI": "your-mongodb-uri",
        "VOYAGE_API_KEY": "your-voyage-key"
      }
    }
  }
}
```

**For Claude Desktop:**
Add to Claude settings → MCP Servers

### 4. Use It

Ask your AI:
- "How does the authentication system work?"
- "Find all API endpoints in this codebase"
- "Show me examples of React hooks usage"
- "What's the database schema?"

Your AI now has perfect memory of your entire codebase.

## Features That Matter

### 🚀 **Instant Knowledge**
Your AI can search across millions of lines of code in milliseconds

### 🔄 **Smart Updates**
Only processes files that changed since last index (git-based)

### 🧠 **True Understanding**
Semantic search means finding code by meaning, not keywords

### 📚 **Any Repository**
Works with any language, any framework, any documentation

### 🔒 **Your Data, Your Control**
Runs on your MongoDB Atlas (free tier works great)

## Real Use Cases

### For Developers
- **Code Review**: "Find all database queries that might have N+1 problems"
- **Debugging**: "Show me all error handling in the payment system"
- **Learning**: "Explain how this authentication flow works"

### For Teams
- **Onboarding**: New developers can ask AI about your codebase
- **Documentation**: AI can explain any part of your system
- **Consistency**: "Find all places where we handle user permissions"

### For Open Source
- **Exploration**: Index any popular library to understand it deeply
- **Contributing**: "Where should I add this feature?"
- **Migration**: "Show all deprecated API usage"

## Getting Started

### Prerequisites

1. **MongoDB Atlas** (free tier)
   - Create at [cloud.mongodb.com](https://cloud.mongodb.com)
   - Get connection string from Database → Connect

2. **Voyage AI** (free tier)
   - Get API key at [voyageai.com](https://voyageai.com)

### Index Your First Repository

```bash
# Interactive setup
embedocs setup

# Or direct indexing
MONGODB_URI="your-uri" VOYAGE_API_KEY="your-key" embedocs index

# Index specific repository
embedocs index https://github.com/facebook/react
```

### Visual Progress Monitoring

```bash
embedocs progress
# Opens http://localhost:3000 with real-time indexing status
```

## How It Works

1. **Clone** → Downloads repository locally
2. **Chunk** → Splits code into semantic chunks
3. **Embed** → Creates vector embeddings (voyage-context-3)
4. **Store** → Saves in MongoDB Atlas with vector index
5. **Search** → Your AI queries using semantic similarity

## Popular Repositories to Index

```bash
# JavaScript/TypeScript
embedocs index https://github.com/facebook/react
embedocs index https://github.com/vercel/next.js
embedocs index https://github.com/microsoft/TypeScript

# Python
embedocs index https://github.com/django/django
embedocs index https://github.com/tiangolo/fastapi

# Your Own
embedocs index https://github.com/your-username/your-repo
```

## Advanced Features

### Search Methods

- **Hybrid Search**: Combines semantic and keyword matching (default)
- **MMR Search**: Maximum diversity in results
- **Pure Vector**: Semantic similarity only

### Performance

- Indexes ~10,000 files per hour
- Search latency <100ms
- Supports repositories with millions of lines
- Incremental updates in seconds

### Customization

```javascript
// Custom configuration
{
  repositories: [{
    repo: 'owner/name',
    branch: 'main',
    include: ['src/**/*.ts'],  // Only TypeScript files
    exclude: ['tests/**']       // Skip tests
  }]
}
```

## FAQ

**Q: How much does it cost?**
A: Free tier of MongoDB Atlas and Voyage AI is enough for personal use (5-10 repositories)

**Q: What file types are supported?**
A: All text files - code, markdown, config, documentation

**Q: How large can repositories be?**
A: No hard limit. Successfully tested with repos containing 100,000+ files

**Q: Is my code secure?**
A: Your code is only stored in your own MongoDB database

**Q: Can I use my own embeddings API?**
A: Currently supports Voyage AI (best quality for code)

## Troubleshooting

### No Results?
```bash
embedocs stats  # Check if indexing completed
```

### Connection Issues?
- Check MongoDB IP whitelist
- Verify API keys are correct

### Need to Re-index?
```bash
embedocs rebuild  # Force complete re-index
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT

## Support

- **Issues**: [GitHub Issues](https://github.com/romiluz/embedocs-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/romiluz/embedocs-mcp/discussions)

---

Built with 🧠 by developers who were tired of copy-pasting code into AI chats.