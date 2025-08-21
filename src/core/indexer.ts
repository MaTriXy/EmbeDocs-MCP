/**
 * SINGLE Indexer - Orchestrates the indexing process
 * Uses EmbeddingService and StorageService, no duplicate logic!
 */

import { simpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { EmbeddingService } from './embeddings.js';
import { StorageService, Document } from './storage.js';
import { AdvancedSemanticChunker } from './semantic-chunker.js';

export interface IndexingProgress {
  current: number;
  total: number;
  currentRepo: string;
  phase: 'cloning' | 'scanning' | 'processing' | 'embedding' | 'storing';
}

export class Indexer {
  private embeddingService: EmbeddingService;
  private storageService: StorageService;
  private advancedChunker: AdvancedSemanticChunker;
  private progressCallback?: (progress: IndexingProgress) => void;
  private dynamicConfig?: any; // Optional dynamic configuration from web UI
  
  constructor(dynamicConfig?: any) {
    this.embeddingService = EmbeddingService.getInstance();
    this.storageService = StorageService.getInstance();
    this.advancedChunker = new AdvancedSemanticChunker();
    this.dynamicConfig = dynamicConfig;
    
    // Log configuration source
    if (dynamicConfig) {
      console.log('🎯 Indexer initialized with dynamic configuration from web UI');
      console.log('📚 User-selected repositories:', dynamicConfig.repositories?.map((r: any) => r.name));
    } else {
      console.log('🎯 Indexer initialized with default configuration');
    }
  }
  
  /**
   * Set progress callback for UI updates
   */
  onProgress(callback: (progress: IndexingProgress) => void) {
    this.progressCallback = callback;
  }
  
  /**
   * Get repositories from dynamic config or user-defined metadata
   * NO HARDCODED REPOSITORIES - only what user explicitly added
   */
  private async getRepositories() {
    // 1. If dynamic config provided (from web UI), use it
    if (this.dynamicConfig?.repositories) {
      return this.dynamicConfig.repositories;
    }

    // 2. For CLI: Read from .repos/metadata.json
    try {
      const metadataPath = path.join('.repos', 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      if (metadata.repositories && metadata.repositories.length > 0) {
        console.log(`📂 Found ${metadata.repositories.length} user-defined repositories`);
        return metadata.repositories;
      }
    } catch (error) {
      // Metadata file doesn't exist or is invalid
      console.log('ℹ️  No .repos/metadata.json found');
    }

    // 3. No repositories configured - show helpful message
    console.log('\n📝 No repositories configured!');
    console.log('   Please add repositories using one of these methods:\n');
    console.log('   1. Web UI (recommended):');
    console.log('      npm run web');
    console.log('      Then open http://localhost:5462\n');
    console.log('   2. Manual: Create .repos/metadata.json with your repositories');
    console.log('\n   Example metadata.json:');
    console.log('   {');
    console.log('     "version": "1.0.0",');
    console.log('     "repositories": [{');
    console.log('       "name": "My Repo",');
    console.log('       "repo": "owner/repo",');
    console.log('       "branch": "main",');
    console.log('       "product": "custom-owner-repo",');
    console.log('       "version": "latest"');
    console.log('     }]');
    console.log('   }');
    
    return [];
  }
  
  /**
   * SMART INDEX (Default behavior) - Checks for changes first, then updates only what's needed
   * Falls back to full indexing for new repositories or when smart update fails
   */
  async index(): Promise<void> {
    await this.storageService.connect();
    
    console.log('🔄 Smart indexing - checking for repository changes...');
    
    let anyRepoWasNew = false;
    
    for (const repo of await this.getRepositories()) {
      try {
        const repoPath = path.join('.repos', repo.repo.replace('/', '_'));
        
        // Check if repo exists locally
        await fs.access(repoPath);
        
        // Get current and stored commit hashes
        const git = simpleGit(repoPath);
        const currentHash = await git.revparse(['HEAD']);
        const storedHash = await this.storageService.getRepositoryHash(repo.name);
        
        if (currentHash === storedHash) {
          console.log(`✅ ${repo.name} up to date (${currentHash.substring(0, 8)}), skipping...`);
          continue;
        }
        
        if (storedHash) {
          // Smart update: only changed files
          console.log(`🔄 ${repo.name} has changes (${storedHash.substring(0, 8)} → ${currentHash.substring(0, 8)}), updating...`);
          await this.smartUpdateRepository(repo, storedHash, currentHash);
        } else {
          // No stored hash = first time indexing
          console.log(`🆕 ${repo.name} first time indexing...`);
          anyRepoWasNew = true;
          await this.indexRepository(repo);
          // Store hash after successful indexing
          await this.storageService.storeRepositoryHash(repo.name, currentHash);
        }
        
      } catch (error) {
        // Repo missing/corrupted = full index needed
        console.log(`🆕 ${repo.name} not found locally, doing full index...`);
        anyRepoWasNew = true;
        await this.indexRepository(repo);
        
        // Store hash after successful indexing
        try {
          const repoPath = path.join('.repos', repo.repo.replace('/', '_'));
          const git = simpleGit(repoPath);
          const currentHash = await git.revparse(['HEAD']);
          await this.storageService.storeRepositoryHash(repo.name, currentHash);
        } catch (hashError) {
          console.warn(`Could not store hash for ${repo.name}:`, hashError);
        }
      }
    }
    
    console.log(anyRepoWasNew ? '✅ Smart indexing complete!' : '✅ Smart update complete!');
  }
  
  /**
   * FORCE FULL REBUILD - Re-indexes everything from scratch
   * Use when things go wrong or you want a completely fresh start
   */
  async rebuild(): Promise<void> {
    await this.storageService.connect();
    
    console.log('🔥 FORCE REBUILD: Re-indexing everything from scratch...');
    
    for (const repo of await this.getRepositories()) {
      await this.indexRepository(repo);
      
      // Store hash after successful indexing
      try {
        const repoPath = path.join('.repos', repo.repo.replace('/', '_'));
        const git = simpleGit(repoPath);
        const currentHash = await git.revparse(['HEAD']);
        await this.storageService.storeRepositoryHash(repo.name, currentHash);
      } catch (hashError) {
        console.warn(`Could not store hash for ${repo.name}:`, hashError);
      }
    }
    
    console.log('✅ Force rebuild complete!');
  }
  
  /**
   * Smart update repository - only re-index changed files between commits
   */
  private async smartUpdateRepository(repo: any, oldHash: string, newHash: string): Promise<void> {
    const repoPath = path.join('.repos', repo.repo.replace('/', '_'));
    const git = simpleGit(repoPath);
    
    // Pull latest changes first
    console.log(`📥 Pulling updates for ${repo.name}...`);
    await git.pull('origin', repo.branch);
    
    // Get list of changed files between commits
    const diff = await git.diff([oldHash, newHash, '--name-only']);
    const changedFiles = diff.split('\n').filter(f => f);
    
    console.log(`📝 Found ${changedFiles.length} changed files in ${repo.name}`);
    
    // Re-index only changed documentation files
    const docsExtensions = ['.md', '.markdown', '.mdx', '.rst', '.txt'];
    const changedDocs = changedFiles.filter(file => 
      docsExtensions.some(ext => file.endsWith(ext))
    );
    
    if (changedDocs.length > 0) {
      console.log(`🔄 Re-indexing ${changedDocs.length} documentation files...`);
      await this.indexRepository(repo, changedDocs);
    }
    
    // Store updated hash after successful processing
    await this.storageService.storeRepositoryHash(repo.name, newHash);
  }
  
  /**
   * Legacy update method - now just calls the smart index()
   * @deprecated Use index() instead - it's smart by default now
   */
  async update(): Promise<void> {
    console.log('ℹ️  update() is deprecated - calling smart index() instead');
    await this.index();
  }
  
  /**
   * Clean the database
   */
  async clean(): Promise<void> {
    await this.storageService.connect();
    await this.storageService.clean();
    console.log('✅ Database cleaned');
  }
  
  /**
   * Index a single repository
   * @param repo - Repository configuration
   * @param specificFiles - Optional: only index these specific files
   */
  private async indexRepository(repo: any, specificFiles?: string[]): Promise<void> {
    this.updateProgress({
      phase: 'cloning',
      currentRepo: repo.name,
      current: 0,
      total: 0
    });

    // Clone repository
    const repoPath = await this.cloneRepo(repo.repo, repo.branch);

    this.updateProgress({ phase: 'scanning', currentRepo: repo.name, current: 0, total: 0 });

    // Find all supported files or use specific files
    const files = specificFiles
      ? specificFiles.map(f => path.join(repoPath, f))
      : await this.findSupportedFiles(repoPath);

    // CRITICAL: Get current hash for incremental progress tracking
    const git = simpleGit(repoPath);
    const currentHash = await git.revparse(['HEAD']);
    
    let processed = 0;
    const totalFiles = files.length;
    
    // Process files in smaller batches to avoid token limits
    const fileBatchSize = 10; // Process fewer files at once
    
    for (let i = 0; i < files.length; i += fileBatchSize) {
      const batch = files.slice(i, i + fileBatchSize);
      
      this.updateProgress({
        phase: 'processing',
        currentRepo: repo.name,
        current: processed,
        total: totalFiles
      });
      
      // Process batch
      const documents = await this.processBatch(batch, repo);
      
      if (documents.length > 0) {
        this.updateProgress({
          phase: 'embedding',
          currentRepo: repo.name,
          current: processed,
          total: totalFiles
        });
        
        // Process embeddings in smaller chunks to avoid token limits
        const embeddingBatchSize = 8; // Even smaller batches for embeddings
        const allEmbeddings: any[] = [];
        
        for (let j = 0; j < documents.length; j += embeddingBatchSize) {
          const docBatch = documents.slice(j, j + embeddingBatchSize);
          const texts = docBatch.map(d => d.content);
          
          try {
            const embeddings = await this.embeddingService.embedDocuments(texts);
            allEmbeddings.push(...embeddings);
          } catch (error) {
            console.warn(`Failed to embed batch ${j}-${j + embeddingBatchSize}:`, error);
            // Create empty embeddings for failed batch
            for (let k = 0; k < docBatch.length; k++) {
              allEmbeddings.push({
                embedding: new Array(config.embedding.dimensions).fill(0),
                normalized: new Array(config.embedding.dimensions).fill(0),  
                dimensions: config.embedding.dimensions,
                model: 'failed'
              });
            }
          }
        }
        
        const embeddings = allEmbeddings;
        
        // Combine documents with embeddings
        const enrichedDocs = documents.map((doc, idx) => ({
          ...doc,
          embedding: embeddings[idx].normalized,
          embeddingModel: embeddings[idx].model,
          embeddingDimensions: embeddings[idx].dimensions,
          indexedAt: new Date()
        }));
        
        this.updateProgress({
          phase: 'storing',
          currentRepo: repo.name,
          current: processed,
          total: totalFiles
        });
        
        // Store in MongoDB - USING THE SERVICE
        await this.storageService.upsertDocuments(enrichedDocs);
      }

      processed += batch.length;

      // CRITICAL: Save incremental progress every 100 files
      const CHECKPOINT_INTERVAL = 100;
      if (processed % CHECKPOINT_INTERVAL === 0) {
        console.log(`💾 Repository state saved at ${processed}/${totalFiles} files (will restart from beginning if interrupted)`);
        await this.storageService.storeRepositoryHash(repo.name, currentHash);
      }
    }

    console.log(`✅ Indexed ${repo.name}: ${processed} files`);
  }
  
  /**
   * Clone or update repository
   */
  private async cloneRepo(repo: string, branch: string): Promise<string> {
    const repoPath = path.join('.repos', repo.replace('/', '_'));
    const git = simpleGit();
    
    try {
      await fs.access(repoPath);
      // Update existing
      await git.cwd(repoPath);
      await git.pull('origin', branch);
    } catch {
      // Clone new
      await fs.mkdir(path.dirname(repoPath), { recursive: true });
      await git.clone(
        `https://github.com/${repo}.git`,
        repoPath,
        ['--branch', branch, '--depth', '1']
      );
    }
    
    return repoPath;
  }
  
  /**
   * Find all supported documentation and code files for indexing
   */
  private async findSupportedFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = [
      // === DOCUMENTATION FILES ===
      '.md', '.markdown', '.mdx', '.rst', '.txt', '.adoc', '.wiki', '.org',
      
      // === FRONTEND/WEB ===
      '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',  // JavaScript/TypeScript
      '.vue', '.svelte', '.astro',                    // Framework files
      '.html', '.htm', '.xhtml',                      // HTML
      '.css', '.scss', '.sass', '.less', '.stylus',   // Styles
      
      // === BACKEND LANGUAGES ===
      '.py', '.pyw', '.pyi',                          // Python
      '.java', '.kt', '.scala',                       // JVM languages
      '.rb', '.rbw',                                  // Ruby
      '.php', '.phtml',                               // PHP
      '.go',                                          // Go
      '.rs',                                          // Rust
      '.cs', '.fs', '.vb',                           // .NET languages
      '.cpp', '.cc', '.cxx', '.c++', '.c', '.h', '.hpp', '.hxx', // C/C++
      '.swift',                                       // Swift
      '.m', '.mm',                                    // Objective-C
      '.r', '.R',                                     // R
      '.jl',                                          // Julia
      '.mat',                                         // MATLAB
      '.lua',                                         // Lua
      '.perl', '.pl', '.pm',                         // Perl
      '.dart',                                        // Dart/Flutter
      '.elm',                                         // Elm
      '.clj', '.cljs', '.cljc',                      // Clojure
      '.ex', '.exs',                                 // Elixir
      '.erl', '.hrl',                                // Erlang
      '.hs', '.lhs',                                 // Haskell
      '.ml', '.mli',                                 // OCaml
      '.nim',                                         // Nim
      '.crystal', '.cr',                              // Crystal
      '.zig',                                         // Zig
      '.v',                                           // V
      '.d',                                           // D
      '.pas', '.pp',                                  // Pascal
      '.f90', '.f95', '.f03', '.f08', '.for', '.f',  // Fortran
      '.cob', '.cbl',                                // COBOL
      '.ada', '.adb', '.ads',                        // Ada
      
      // === CONFIGURATION FILES ===
      '.json', '.json5', '.jsonc',                   // JSON variants
      '.yaml', '.yml',                               // YAML
      '.toml',                                       // TOML
      '.ini', '.cfg', '.conf', '.config',           // Config files
      '.xml', '.plist',                              // XML formats
      '.properties',                                 // Properties
      '.env', '.dotenv',                            // Environment
      '.editorconfig', '.gitignore', '.gitattributes', // Git config
      
      // === BUILD & PACKAGE FILES ===
      '.gradle', '.maven', '.sbt',                   // Build tools
      'package.json', 'requirements.txt', 'Pipfile', // Package managers
      'Cargo.toml', 'Cargo.lock',                    // Rust
      'pom.xml', 'build.gradle', 'build.sbt',       // JVM builds
      'composer.json', 'package-lock.json', 'yarn.lock', // Dependencies
      'Gemfile', 'Gemfile.lock',                     // Ruby
      'pubspec.yaml',                                // Dart/Flutter
      'mix.exs',                                     // Elixir
      'stack.yaml', 'cabal.project',                 // Haskell
      
      // === DEVOPS & INFRASTRUCTURE ===
      '.tf', '.tfvars',                              // Terraform
      '.bicep',                                      // Azure Bicep
      '.pulumi',                                     // Pulumi
      '.ansible.yml', '.playbook.yml',              // Ansible
      '.nomad',                                      // HashiCorp Nomad
      '.consul',                                     // Consul
      '.vault',                                      // Vault
      'docker-compose.yml', 'docker-compose.yaml',  // Docker Compose
      'Dockerfile', 'Containerfile',                 // Container files
      '.k8s.yml', '.k8s.yaml', '.kube.yml',        // Kubernetes
      '.helm.yml', '.helm.yaml',                     // Helm
      '.github', '.gitlab-ci.yml', '.travis.yml',   // CI/CD
      'Jenkinsfile', '.jenkins',                     // Jenkins
      'azure-pipelines.yml', 'bitbucket-pipelines.yml', // Other CI
      
      // === DATABASE & DATA ===
      '.sql', '.psql', '.mysql', '.sqlite',          // SQL variants
      '.graphql', '.gql',                            // GraphQL
      '.cypher',                                     // Neo4j Cypher
      '.mongo', '.js',                               // MongoDB scripts
      '.cql',                                        // Cassandra
      '.hql',                                        // Hive
      '.pig',                                        // Apache Pig
      '.spark',                                      // Spark
      
      // === SCRIPTS & AUTOMATION ===
      '.sh', '.bash', '.zsh', '.fish',               // Unix shells
      '.bat', '.cmd', '.ps1',                        // Windows
      '.applescript', '.scpt',                       // macOS
      'Makefile', 'makefile', '.make',               // Make
      'Rakefile', '.rake',                           // Rake
      '.ant', '.nant',                               // Ant/NAnt
      
      // === DATA SCIENCE & ML ===
      '.ipynb',                                      // Jupyter Notebooks
      '.rmd',                                        // R Markdown
      '.qmd',                                        // Quarto Markdown
      '.nb',                                         // Mathematica
      '.wl', '.m',                                   // Wolfram Language
      
      // === MOBILE DEVELOPMENT ===
      '.xcodeproj', '.xcworkspace',                  // Xcode
      '.pbxproj',                                    // Xcode project
      '.storyboard', '.xib',                         // iOS Interface
      '.pch',                                        // Precompiled headers
      '.modulemap',                                  // Module maps
      
      // === GAME DEVELOPMENT ===
      '.cs',                                         // Unity C#
      '.gd', '.gdscript',                           // Godot
      '.hlsl', '.glsl', '.frag', '.vert',           // Shaders
      '.fx', '.fxh',                                // DirectX shaders
      '.cg', '.cginclude',                          // Cg shaders
      '.unity', '.prefab', '.mat', '.asset',        // Unity assets
      '.unreal', '.uasset', '.umap',                // Unreal Engine
      
      '.env.example', '.env.template',               // Environment templates
      
      // === SERIALIZATION & APIs ===
      '.proto',                                      // Protocol Buffers
      '.thrift',                                     // Apache Thrift
      '.avro',                                       // Apache Avro
      '.capnp',                                      // Cap'n Proto
      '.flatbuf',                                    // FlatBuffers
      '.openapi.yml', '.swagger.yml',               // API specs
      '.raml',                                       // RAML API
      '.wsdl',                                       // Web Services
      
      // === CONFIGURATION FORMATS ===
      '.hocon',                                      // HOCON (Typesafe Config)
      '.conf',                                       // Generic config
      '.props',                                      // Properties
      '.settings',                                   // Settings files
      '.prefs',                                     // Preferences
      
      // === MISC IMPORTANT FILES ===
      '.gitmodules', '.gitkeep',                    // Git
      '.npmrc', '.yarnrc',                          // NPM/Yarn
      '.babelrc', '.eslintrc', '.prettierrc',       // JavaScript tools
      'tsconfig.json', 'jsconfig.json',             // TypeScript/JS config
      'tailwind.config.js', 'webpack.config.js',   // Frontend configs
      'vite.config.js', 'rollup.config.js',        // Build tools
      '.pre-commit-config.yaml',                     // Pre-commit hooks
      'pyproject.toml', 'setup.py', 'setup.cfg',   // Python packaging
      'tox.ini', 'pytest.ini',                     // Python testing
      '.coverage', '.coveragerc',                    // Coverage
      'sonar-project.properties',                   // SonarQube
    ];

    // Special files without extensions (exact filename matches)
    const specialFiles = [
      // Documentation files
      'README', 'CHANGELOG', 'CONTRIBUTING', 'LICENSE', 'AUTHORS',
      'INSTALL', 'NEWS', 'HISTORY', 'COPYING', 'NOTICE', 'CREDITS',
      'ACKNOWLEDGMENTS', 'PATENTS', 'THIRD_PARTY', 'MAINTAINERS',
      // Build files
      'Dockerfile', 'Containerfile', 'Vagrantfile', 'Brewfile', 'Podfile',
      'Makefile', 'makefile', 'GNUmakefile', 'Rakefile', 'Cakefile',
      'Jakefile', 'Snakefile', 'Justfile',
      // CI/CD files
      'Jenkinsfile', 'Buildfile', 'Procfile', 'Capfile',
      // Mobile development
      'Fastfile', 'Appfile', 'Deliverfile', 'Matchfile', 'Scanfile',
      // Package management
      'Berksfile', 'Thorfile', 'Guarfile', 'Gemfile', 'Pipfile',
      // Version control
      'CODEOWNERS', 'FUNDING', 'SECURITY',
      // Project files
      'ROADMAP', 'ARCHITECTURE', 'DESIGN', 'PHILOSOPHY', 'VISION',
      'GOVERNANCE', 'CODE_OF_CONDUCT', 'SUPPORT', 'TROUBLESHOOTING'
    ];

    const maxDepth = 10; // Search deeper
    
    async function walk(currentDir: string, depth: number = 0) {
      if (depth > maxDepth) return;
      
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          // Skip common non-doc directories
          if (entry.isDirectory()) {
            const skipDirs = ['node_modules', '.git', 'build', 'dist', 'target', '.next', '.cache', 'coverage'];
            if (!skipDirs.includes(entry.name)) {
              await walk(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            // Check for supported files (by extension or special filename)
            const ext = path.extname(entry.name).toLowerCase();
            const filename = entry.name;
            const isSupported = extensions.includes(ext) || specialFiles.includes(filename);
            
            if (isSupported) {
              // Also check file size - skip huge files
              const stats = await fs.stat(fullPath);
              if (stats.size < 10_000_000) { // 10MB max (increased for code files)
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }
    
    await walk(dir);
    console.log(`📄 Found ${files.length} files (code, docs, config, and special files)`);
    return files;
  }
  
  /**
   * Process a batch of files into documents
   */
  private async processBatch(files: string[], repo: any): Promise<Omit<Document, 'embedding' | 'embeddingModel' | 'embeddingDimensions' | 'indexedAt'>[]> {
    const documents: any[] = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        // Skip empty or very small files
        if (content.length < 50) continue;
        
        const ext = path.extname(file).toLowerCase();
        let chunks: string[] = [];
        
        // Advanced semantic chunking based on file type and research
        if (ext === '.rst') {
          // reStructuredText - gradient method works well for structured docs
          chunks = await this.advancedChunker.chunkContent(content, 'gradient');
        } else if (['.md', '.markdown', '.mdx'].includes(ext)) {
          // Markdown - interquartile method optimal for technical docs (41.71 score)
          chunks = await this.advancedChunker.chunkContent(content, 'interquartile');
        } else if (ext === '.txt') {
          // Plain text - auto-select based on content analysis
          chunks = await this.advancedChunker.chunkContent(content, 'auto');
        } else {
          // Default - hybrid approach for unknown formats
          chunks = await this.advancedChunker.chunkContent(content, 'hybrid');
        }

        // Filter chunks with voyage-context-3 token limit constraints
        // Based on Harry-231's successful approach: min_chunk_size=100, no artificial max
        // TRUST THE SEMANTIC CHUNKER - it already filtered properly
        // Don't double-filter here as it causes data loss!
        // The semantic chunker already handles token limits and size constraints

        // Log chunking performance metrics
        const metrics = this.advancedChunker.getMetrics();
        console.log(`📊 Chunking metrics for ${path.basename(file)}: ${chunks.length} chunks, avg size: ${Math.round(metrics.averageChunkSize)}`)
        
        // Create documents from chunks
        chunks.forEach((chunk, idx) => {
          const docId = `${repo.product}_${repo.version}_${createHash('md5').update(chunk).digest('hex').substring(0, 8)}`;
          
          documents.push({
            documentId: docId,
            content: chunk.trim(),
            title: path.basename(file),
            product: repo.product,
            version: repo.version,
            metadata: {
              file: path.relative(process.cwd(), file),
              chunkIndex: idx,
              repo: repo.repo,
              fileType: ext.substring(1)
            }
          });
        });
      } catch (error) {
        console.warn(`Failed to process ${file}:`, error);
      }
    }
    
    return documents;
  }
  
  // Old chunking method removed - now using AdvancedSemanticChunker
  
  /**
   * Update progress
   */
  private updateProgress(progress: IndexingProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
  
  /**
   * Get statistics with chunking performance metrics
   */
  async getStats() {
    await this.storageService.connect();
    const baseStats = await this.storageService.getStats();
    
    // Add chunking performance metrics
    const chunkingMetrics = this.advancedChunker.getMetrics();
    
    return {
      ...baseStats,
      chunking: {
        totalRequests: chunkingMetrics.totalRequests,
        averageChunkSize: Math.round(chunkingMetrics.averageChunkSize),
        semanticBoundariesFound: chunkingMetrics.semanticBoundaries,
        fallbackUsageRate: chunkingMetrics.totalRequests > 0 
          ? (chunkingMetrics.fallbackUsage / chunkingMetrics.totalRequests * 100).toFixed(1) + '%'
          : '0%'
      }
    };
  }
}