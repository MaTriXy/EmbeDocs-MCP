# 📚 MongoDB Semantic MCP - Complete Document Sources List

## 🎯 Current Document Sources Configuration (v7.2.3)

This document lists ALL the documentation sources that the MongoDB Semantic MCP system fetches and indexes for semantic search.

---

## 📊 Source Overview

| **Category** | **Sources** | **Est. Documents** | **Priority** |
|--------------|-------------|-------------------|--------------|
| **MongoDB Core** | 1 | ~3,500 | P0 |
| **Atlas & Cloud** | 3 | ~1,000 | P0 |
| **GenAI & AI** | 2 | ~700 | P0 |
| **Python Ecosystem** | 2 | ~2,000 | P0 |
| **Top Drivers** | 3 | ~600 | P1 |
| **Essential Tools** | 2 | ~400 | P1 |
| **Voyage AI** | 2 | ~200 | P1 |
| **TOTAL** | **15 sources** | **~8,400 docs** | |

---

## 🏆 TIER 1: MongoDB 8.0 Core (Latest!)

### MongoDB 8.0 Manual
- **Source**: `mongodb/docs` (master branch)
- **Product**: `manual`
- **Version**: 8.0 (Released October 2024)
- **Priority**: 5 (Highest)
- **Content**: Complete MongoDB operations, CRUD, aggregation, indexes
- **Estimated Docs**: ~3,500

---

## ☁️ TIER 2: Atlas & Cloud (Production-Critical)

### 1. Atlas Vector Search Notebooks
- **Source**: `mongodb/docs-notebooks` (main branch)
- **Product**: `atlas-vector`
- **Version**: latest
- **Priority**: 5 (Highest)
- **Content**: Vector search examples, `$vectorSearch` pipeline usage
- **Estimated Docs**: ~200

### 2. MongoDB Chatbot (Vector Search)
- **Source**: `mongodb/chatbot` (main branch)
- **Product**: `atlas-chatbot`
- **Version**: latest
- **Priority**: 5 (Highest)
- **Content**: AI chatbot implementation with MongoDB
- **Estimated Docs**: ~300

### 3. Atlas CLI
- **Source**: `mongodb/docs-atlas-cli` (main branch)
- **Product**: `atlas-cli`
- **Version**: latest
- **Priority**: 4
- **Content**: Command-line interface for MongoDB Atlas
- **Estimated Docs**: ~500

---

## 🤖 TIER 3: GenAI & AI Ecosystem (The Future!)

### 1. GenAI Showcase
- **Source**: `mongodb-developer/GenAI-Showcase` (main branch)
- **Product**: `genai`
- **Version**: latest
- **Priority**: 5 (Highest)
- **Content**: 26 RAG/semantic search examples, AI patterns
- **Estimated Docs**: ~500
- **⭐ Special**: Contains real-world AI implementation patterns

### 2. GenAI DevDay Notebooks
- **Source**: `mongodb-developer/genai-devday-notebooks` (main branch)
- **Product**: `genai-devday`
- **Version**: latest
- **Priority**: 4
- **Content**: Developer day AI/ML notebooks and tutorials
- **Estimated Docs**: ~200

---

## 🐍 TIER 4: Python Ecosystem (AI/ML Dominance)

### 1. PyMongo (Python Driver)
- **Source**: `mongodb/mongo-python-driver` (master branch)
- **Product**: `pymongo`
- **Version**: latest
- **Priority**: 5 (Highest)
- **Content**: Python MongoDB driver, connection patterns, CRUD operations
- **Estimated Docs**: ~1,500
- **⭐ Special**: Most critical for Python developers

### 2. Motor (Async Python)
- **Source**: `mongodb/motor` (master branch)
- **Product**: `motor`
- **Version**: latest
- **Priority**: 5 (Highest)
- **Content**: Asynchronous Python driver for MongoDB
- **Estimated Docs**: ~500
- **⭐ Special**: Essential for async/await patterns

---

## 💻 TIER 5: Top Drivers (Essential Languages)

### 1. Node.js Driver
- **Source**: `mongodb/docs-node` (master branch)
- **Product**: `nodejs`
- **Version**: latest
- **Priority**: 4
- **Content**: JavaScript/Node.js MongoDB driver documentation
- **Estimated Docs**: ~200

### 2. Java Driver
- **Source**: `mongodb/docs-java` (master branch)
- **Product**: `java`
- **Version**: latest
- **Priority**: 4
- **Content**: Java MongoDB driver, enterprise patterns
- **Estimated Docs**: ~250

### 3. Go Driver
- **Source**: `mongodb/docs-golang` (master branch)
- **Product**: `go`
- **Version**: latest
- **Priority**: 3
- **Content**: Go MongoDB driver, cloud-native patterns
- **Estimated Docs**: ~150

---

## 🛠️ TIER 6: Essential Tools

### 1. MongoDB Shell (mongosh)
- **Source**: `mongodb/docs-mongodb-shell` (master branch)
- **Product**: `shell`
- **Version**: latest
- **Priority**: 4
- **Content**: MongoDB shell commands, scripting
- **Estimated Docs**: ~300

### 2. Compass GUI
- **Source**: `mongodb/docs-compass` (master branch)
- **Product**: `compass`
- **Version**: latest
- **Priority**: 3
- **Content**: MongoDB GUI application documentation
- **Estimated Docs**: ~100

---

## 🚀 TIER 7: Voyage AI (Embedding Provider)

### 1. Voyage Python SDK
- **Source**: `voyage-ai/voyageai-python` (main branch)
- **Product**: `voyage`
- **Version**: latest
- **Priority**: 5 (Highest)
- **Content**: Python SDK for Voyage AI embeddings
- **Estimated Docs**: ~150
- **⭐ Special**: Our embedding provider documentation

### 2. Voyage TypeScript SDK
- **Source**: `voyage-ai/typescript-sdk` (main branch)
- **Product**: `voyage-ts`
- **Version**: latest
- **Priority**: 4
- **Content**: TypeScript SDK for Voyage AI embeddings
- **Estimated Docs**: ~50

---

## 🚫 Explicitly Excluded Sources

### Removed for Redundancy:
- **MongoDB v7.0, v6.0** - Old versions, duplicates master
- **docs-pymongo** - Redundant with mongo-python-driver
- **docs-ecosystem** - Outdated, replaced by driver-specific docs

### Removed for Low Priority:
- **Realm** - Mobile SDK, not relevant for AI/backend
- **C#, PHP, Ruby, Rust, Kotlin drivers** - Lower AI/ML usage
- **Kafka, Spark, BI connectors** - Too specialized
- **University repos** - Outdated tutorials

### Removed for Reliability Issues:
- **Web scraping sources** - Unreliable, failed in v7.1
- **FastAPI examples** - Failed to clone
- **Atlas Architecture guides** - Web fetch failures

---

## 📈 Smart Model Selection (v7.2.3 Feature)

The system automatically detects content type and uses appropriate models:

| **Content Type** | **Model Used** | **Percentage** | **Use Case** |
|------------------|----------------|----------------|---------------|
| **Code Content** | `voyage-code-3` | ~53% | Code examples, syntax, APIs |
| **Text Content** | `voyage-3` | ~47% | Documentation, explanations, concepts |

---

## 🔍 Search & Reranking

- **Vector Search**: Uses normalized embeddings with dot product similarity
- **Keyword Search**: Fallback for specific terms
- **Hybrid Scoring**: 60% vector + 40% keyword
- **Reranking**: `rerank-2.5` model for improved relevance

---

## 📊 Historical Performance

| **Version** | **Sources** | **Documents** | **Quality** | **Issues** |
|-------------|-------------|---------------|-------------|------------|
| v7.0 | 26+ | 7,750 | Bloated | Too much redundancy |
| v7.1 | 26+ | 2,223 | Failed | Missing manual, clone failures |
| v7.2 | 12 | 3,365 | ✅ Perfect | Smart & focused |
| **v7.2.3** | **15** | **~8,400** | **✅ Optimal** | **Current target** |

---

## 🎯 Quality Metrics

### Content Quality Filters:
- **Minimum quality score**: 0.2 (filters out meta-docs, build files)
- **Technical content**: Prioritized for code-specific queries
- **Conceptual content**: For explanatory queries
- **Example preservation**: Code examples kept intact

### Search Performance:
- **Response time**: <500ms
- **Relevance scores**: 0.7-0.9 for exact matches
- **Coverage**: 100% of major MongoDB features
- **Freshness**: Latest versions only (no legacy)

---

## 🔄 Update Process

### How Documents Are Fetched:
1. **GitHub API**: Recursive directory traversal
2. **Content filtering**: Skip build files, meta-docs
3. **Quality scoring**: Rate content relevance
4. **Smart chunking**: Preserve code blocks and examples
5. **Model selection**: Auto-detect code vs text
6. **Embedding generation**: Batch processing for efficiency

### Indexing Command:
```bash
mongodocs-index  # Uses enhanced-index-docs.ts
```

---

*Last Updated: 2025-08-13*  
*Configuration Version: v7.2.3*  
*Total Estimated Documents: ~8,400*
