# mongodocs-mcp CLI Commands

## Installation
```bash
npm install -g mongodocs-mcp
```

## Environment Variables
```bash
export MONGODB_URI="mongodb+srv://..."
export VOYAGE_API_KEY="pa-..."
```

## Available Commands

### 1. Full Index (First Time)
```bash
npm run index
# OR
mongodocs-index
```
Clones and indexes all configured repositories from scratch.

### 2. Smart Update (Daily/Weekly)
```bash
npm run update
# OR
mongodocs-index update
```
**NEW in v10.0.0!** Smart update that:
- Pulls latest changes from all repos
- Detects which files changed
- Only re-indexes changed documentation files
- Shows what's new
- Much faster than full re-index

### 3. Clean Database
```bash
npm run clean-db
# OR
mongodocs-index clean
```
Removes all documents from the database.

### 4. View Statistics
```bash
npm run stats
# OR
mongodocs-index stats
```
Shows:
- Total documents indexed
- Products/repos included
- Embedding model info

### 5. Test Embeddings
```bash
npm run test:embed
# OR
mongodocs-index test
```
Verifies voyage-context-3 is working correctly.

## Typical Workflows

### Initial Setup
```bash
# 1. Install globally
npm install -g mongodocs-mcp

# 2. Set environment variables
export MONGODB_URI="..."
export VOYAGE_API_KEY="..."

# 3. Run initial indexing
mongodocs-index

# 4. Configure Cursor to use it
```

### Daily/Weekly Updates
```bash
# Just run update to get latest changes
mongodocs-index update
```

### After Major Changes
```bash
# Clean and re-index everything
mongodocs-index clean
mongodocs-index
```

## What Gets Indexed

### v10.0.0 Repositories:
1. **MongoDB Official Docs** - Complete documentation
2. **GenAI Showcase** (3.9k⭐) - AI/RAG examples
3. **MongoDB Chatbot** - Production RAG implementation
4. **Vector Search Notebooks** - Tutorials
5. **Multimodal AI Agents Lab** - Cutting-edge AI

### File Types Indexed:
- `.md` - Markdown files
- `.mdx` - MDX (Markdown + JSX)
- `.rst` - reStructuredText
- `.txt` - Text files

### Excluded:
- `node_modules/`
- `.git/`
- `build/`, `dist/`
- Files > 5MB
- Binary files

## Performance

- **Initial Index**: ~15-20 minutes for all 5 repos
- **Smart Update**: ~1-2 minutes (only changed files)
- **Search Latency**: <500ms
- **Embedding Model**: voyage-context-3 (1024 dimensions)

## Troubleshooting

### "Database is empty"
```bash
mongodocs-index  # Run full index
```

### "Dimension mismatch"
Your database has old embeddings. Clean and re-index:
```bash
mongodocs-index clean
mongodocs-index
```

### "Token limit exceeded"
The indexer automatically batches documents to avoid this, but if it happens:
- Check your Voyage API key is valid
- Try reducing batch size in config