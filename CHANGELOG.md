# Changelog

All notable changes to MongoDB Semantic MCP will be documented in this file.

## [8.0.0] - 2025-01-14

### 🎉 Major Release - Complete Restructure

#### Added
- ✨ Beautiful CLI with ASCII art, gradients, and progress bars
- 🚀 52 repository configuration for comprehensive MongoDB & Voyage AI coverage
- 🔍 Hybrid search engine combining vector + keyword search
- 🧠 Smart model selection (voyage-code-3 for code, voyage-3 for text)
- 📊 10,392 documents indexed from multiple sources
- ⚡ Sub-500ms search latency
- 🎨 Professional CLI tools (setup, index, clean, status)
- 📦 MCP server implementation with 4 main tools

#### Changed
- 🏗️ Complete project restructure from multi-version to single source of truth
- 📁 Moved from nested mongodb-semantic-mcp/ to clean root structure
- 🔄 Updated to v8.0.0 for fresh start
- 🎯 Reduced project size from 430MB to 142MB (67% reduction)

#### Fixed
- 🐛 Fixed NaN scores in vector search (normalized embeddings)
- 🐛 Fixed missing content field in search pipeline
- 🐛 Fixed reranker field name (relevanceScore vs relevance_score)
- 🐛 Fixed all bin files to use ES6 imports

#### Removed
- 🗑️ Removed 285MB corpus directory
- 🗑️ Removed legacy src/ directory
- 🗑️ Removed all test files and old reports
- 🗑️ Removed ultimate-fix and complete-fix scripts

---

## [7.2.3] - 2025-01-13 (Pre-restructure)

### Fixed
- Fixed missing content field in vectorSearch pipeline
- Smart model selection for better accuracy

## [7.2.1] - 2025-01-12 (Pre-restructure)

### Fixed
- Critical bug where content field was missing from search results

## [4.4.0] - 2025-01-11 (Pre-restructure)

### Fixed
- Fixed NaN scores by correcting reranker field name

## [4.0.0] - 2025-01-09 (Initial Release)

### Added
- Initial semantic search implementation
- Basic MCP server
- MongoDB Atlas integration
- Voyage AI embeddings
