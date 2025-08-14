# 🧹 MongoDB Semantic MCP - COMPLETE CLEANUP & REVAMP PLAN

## 🎯 Goal
Transform the messy multi-version project into a **SINGLE, CLEAN, WORKING SYSTEM**

---

## 📊 Current State Analysis

### What We Have:
```
mongodocs_mcp/                 [Total: ~430MB]
├── mongodb-semantic-mcp/      [143MB] - The WORKING version with beautiful CLI
├── mongodocs-corpus/           [285MB] - Corpus data (unclear if needed)
├── src/                        [12K]  - Legacy, only 1 file
├── Various .md files           - Documentation we created
└── Legacy files                - indexer.pid, indexing.log
```

### The Problems:
1. **Multiple versions** tried and failed (ultimate-fix, complete-fix, etc.)
2. **Legacy `/src/`** directory with abandoned code
3. **Unclear corpus** directory (285MB - do we need it?)
4. **Version confusion** (package.json says v5.0.2 but docs say v7.2.3)
5. **No actual indexed documents** (database is empty)

---

## ✅ What's ACTUALLY WORKING

### The Good Stuff to KEEP:
```
mongodb-semantic-mcp/
├── src/                        ✅ KEEP - Working TypeScript source
│   ├── index.ts               ✅ MCP server
│   ├── cli/                   ✅ Beautiful CLI tools
│   │   ├── enhanced-index-docs.ts  ✅ Current indexer
│   │   ├── setup-wizard.ts   ✅ Beautiful setup
│   │   └── clean-database.ts ✅ DB cleanup
│   └── core/                  ✅ Core modules
│       ├── hybrid-search-engine.ts  ✅ Fixed search
│       └── [11 other modules] ✅ All working
├── dist/                      ✅ KEEP - Compiled JS
├── bin/                       ✅ KEEP - CLI executables
├── package.json               ✅ KEEP - Dependencies
└── tsconfig.json             ✅ KEEP - TypeScript config
```

---

## 🗑️ What to DELETE

### Legacy & Broken:
```
TO DELETE:
├── /src/                      ❌ Legacy directory (only 1 old file)
├── indexer.pid               ❌ Old process file
├── indexing.log              ❌ Old log
├── indexing-state.json       ❌ Corrupted (213K tokens!)
├── mongodocs-corpus/         ❓ Check if needed (285MB!)
│
Inside mongodb-semantic-mcp/:
├── All test .js files        ❌ Too many versions
├── Multiple .md reports      ❌ Version confusion
├── mongodb-docs/             ❌ If exists (90K+ files)
├── mongodb-docs-repos/       ❌ If exists (duplicates)
└── node_modules/             ❌ Reinstall fresh
```

---

## 🏗️ NEW CLEAN STRUCTURE

```
mongodocs-mcp/                 # Clean root
├── README.md                  # Professional readme
├── package.json               # Single package.json (from mongodb-semantic-mcp)
├── tsconfig.json             # TypeScript config
├── .env.example              # Environment template
├── .gitignore                # Proper ignores
│
├── src/                      # SOURCE CODE (from mongodb-semantic-mcp/src)
│   ├── index.ts             # MCP server
│   ├── cli/                 # CLI tools
│   └── core/                # Core modules
│
├── dist/                    # Compiled JavaScript
│
├── bin/                     # Executable scripts
│   ├── mongodocs-mcp
│   ├── mongodocs-index
│   ├── mongodocs-clean
│   └── mongodocs-setup
│
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md
│   ├── CLI_DESIGN.md
│   └── SOURCES.md
│
└── data/                    # Data directory (if needed)
    └── sources.json         # Configuration for sources
```

---

## 🚀 CLEANUP STEPS

### Phase 1: Backup Working Components
```bash
# 1. Create backup
mkdir -p ../mongodocs-backup
cp -r mongodb-semantic-mcp/src ../mongodocs-backup/
cp -r mongodb-semantic-mcp/bin ../mongodocs-backup/
cp mongodb-semantic-mcp/package.json ../mongodocs-backup/
cp mongodb-semantic-mcp/tsconfig.json ../mongodocs-backup/
```

### Phase 2: Clean Root Directory
```bash
# 2. Remove legacy files
rm -f indexer.pid indexing.log
rm -rf src/  # Legacy directory

# 3. Check and remove corpus if not needed
# First check what's in it
ls -la mongodocs-corpus/
# If not needed: rm -rf mongodocs-corpus/
```

### Phase 3: Restructure
```bash
# 4. Move working code to root
mv mongodb-semantic-mcp/src ./src
mv mongodb-semantic-mcp/bin ./bin
mv mongodb-semantic-mcp/package.json ./
mv mongodb-semantic-mcp/tsconfig.json ./

# 5. Create clean directories
mkdir -p docs
mv *.md docs/

# 6. Clean mongodb-semantic-mcp directory
rm -rf mongodb-semantic-mcp/node_modules
rm -f mongodb-semantic-mcp/*.js  # Test files
rm -f mongodb-semantic-mcp/*.md   # Old reports
```

### Phase 4: Fresh Install
```bash
# 7. Install dependencies fresh
npm install

# 8. Build TypeScript
npm run build

# 9. Test the CLI
./bin/mongodocs-setup --help
```

### Phase 5: Version Alignment
```bash
# 10. Update package.json version to v8.0.0 (fresh start)
# Edit package.json: "version": "8.0.0"
```

---

## 📋 Configuration for New Sources

Based on the 52-repository collection you mentioned, create a clean configuration:

```json
// data/sources.json
{
  "version": "8.0.0",
  "sources": {
    "tier1_genai": [
      {
        "name": "GenAI-Showcase",
        "repo": "mongodb-developer/GenAI-Showcase",
        "priority": 5,
        "description": "26 production RAG patterns"
      }
    ],
    "tier2_voyage": [
      {
        "name": "Voyage Python SDK",
        "repo": "voyage-ai/voyageai-python",
        "priority": 5
      }
    ],
    "tier3_mongodb": [
      {
        "name": "MongoDB 8.0 Docs",
        "repo": "mongodb/docs",
        "branch": "master",
        "priority": 5
      }
    ]
  }
}
```

---

## ⚡ Quick Wins

1. **Immediate Space Saving**: ~285MB (mongodocs-corpus)
2. **Code Clarity**: Single source directory
3. **Version Clarity**: v8.0.0 everywhere
4. **No Duplicates**: One version of everything
5. **Professional Structure**: Industry-standard layout

---

## 🎯 End Result

A **CLEAN, PROFESSIONAL, WORKING** MongoDB Semantic MCP:
- Single source of truth
- Beautiful CLI that works
- Clear versioning (v8.0.0)
- Professional structure
- Ready for the 52-repository integration
- No legacy code
- No confusion

---

## ⏱️ Estimated Time: 30 minutes

**LET'S DO THIS!** 🚀
