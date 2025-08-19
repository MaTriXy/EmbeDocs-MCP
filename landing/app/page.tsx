'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Brain, Rocket, CheckCircle, Github, Terminal as TerminalIcon, Zap, Search, Code2, Database, Sparkles, BookOpen } from 'lucide-react'
import { GlowCard } from './components/GlowCard'
import { Particles } from './components/Particles'
import { CodeBlock } from './components/CodeBlock'

export default function Home() {
  return (
    <div className="relative min-h-screen bg-dark">
      <Particles />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-7xl mx-auto text-center z-10"
        >
          {/* Animated Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-dark border border-primary/20 mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-gray-300">Your MCPs Use Keyword Search. Documentation Needs Semantic Understanding.</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-6"
          >
            <span className="gradient-text">AI That Actually</span>
            <br />
            <span className="text-white">Knows Your Docs</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto"
          >
            GitHub MCP finds keywords. Embedocs understands{' '}
            <span className="text-primary font-semibold">MEANING</span>. Perfect for finding what you need in vast documentation.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <a
              href="https://www.npmjs.com/package/embedocs-mcp"
              className="neon-button text-black flex items-center gap-2 px-8 py-4"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/romiluz13/EmbeDocs-MCP"
              className="px-8 py-4 rounded-full glass-dark border border-gray-700 hover:border-primary/50 transition-all flex items-center gap-2"
            >
              <Github className="w-5 h-5" />
              Star on GitHub
            </a>
          </motion.div>

          {/* Live Demo Terminals */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-5xl mx-auto"
          >
            <div className="grid md:grid-cols-2 gap-6">
              {/* Without Embedocs */}
              <div className="terminal bg-red-950/20 border-red-900/30">
                <div className="terminal-header">
                  <div className="flex items-center space-x-2">
                    <span className="terminal-dot red" />
                    <span className="terminal-dot yellow" />
                    <span className="terminal-dot green" />
                  </div>
                  <span className="text-gray-400 text-sm font-mono">Without Embedocs ❌</span>
                  <div className="w-16" />
                </div>
                <div className="p-6 font-mono text-sm">
                  <div className="text-gray-400 mb-2">
                    <span className="text-accent-green">You:</span> How do I implement MongoDB vector search with Atlas?
                  </div>
                  <div className="text-red-400">
                    <span className="text-gray-500">GitHub MCP:</span> Found 3 files with "vector" AND "search":
                    - vector-search-tutorial.md
                    - search-index.md
                    - atlas-vector.md
                  </div>
                </div>
              </div>

              {/* With Embedocs */}
              <div className="terminal bg-green-950/20 border-green-900/30">
                <div className="terminal-header">
                  <div className="flex items-center space-x-2">
                    <span className="terminal-dot red" />
                    <span className="terminal-dot yellow" />
                    <span className="terminal-dot green" />
                  </div>
                  <span className="text-gray-400 text-sm font-mono">With Embedocs ✅</span>
                  <div className="w-16" />
                </div>
                <div className="p-6 font-mono text-sm">
                  <div className="text-gray-400 mb-2">
                    <span className="text-accent-green">You:</span> How do I implement MongoDB vector search with Atlas?
                  </div>
                  <div className="text-green-400">
                    <span className="text-gray-500">Embedocs:</span> Found 47 related concepts: vector indexes, 
                    $vectorSearch stage, kNN algorithms, embedding models, similarity scoring, 
                    hybrid search, performance tuning...
                    <div className="mt-2 p-2 bg-dark-200 rounded">
                      <code className="text-primary">{"// Understands you need the COMPLETE solution"}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">Why Keyword Search</span>
              <br />
              <span className="gradient-text">Fails for Documentation</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <GlowCard>
              <BookOpen className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">MCPs Miss Context</h3>
              <p className="text-gray-400 mb-4">GitHub MCP finds files with exact keywords, missing related concepts</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> Need exact terms
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> Miss synonyms
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> No concept linking
                </li>
              </ul>
            </GlowCard>

            <GlowCard delay={0.1}>
              <Search className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Fragmented Results</h3>
              <p className="text-gray-400 mb-4">Keyword search returns scattered pieces, not complete solutions</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> Partial information
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> Missing prerequisites
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> No related examples
                </li>
              </ul>
            </GlowCard>

            <GlowCard delay={0.2}>
              <Code2 className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Unknown Terminology</h3>
              <p className="text-gray-400 mb-4">You often don't know the exact terms the docs use</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> "Sharding" vs "partitioning"
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> "Aggregation" vs "pipeline"
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-red-400">✗</span> "Vector" vs "embedding"
                </li>
              </ul>
            </GlowCard>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="gradient-text">Semantic Search</span>
              <br />
              <span className="text-white">That Understands Meaning</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Traditional search finds words. Embedocs understands <span className="text-primary">concepts</span>, <span className="text-secondary">relationships</span>, and <span className="text-accent-green">context</span>
            </p>
          </motion.div>

          {/* Search Comparison */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <GlowCard>
              <h3 className="text-xl font-bold mb-4 text-red-400">❌ GitHub MCP (Keyword)</h3>
              <CodeBlock
                code={`// Query: "database performance"
// GitHub MCP searches for files containing both words

Found 3 files:
- database-performance.md
- performance.txt (mentions database once)
- troubleshooting-database-performance.md

// Missed: query optimization, indexing guides,
// connection pooling, caching, profiling...`}
                language="javascript"
                showLineNumbers={false}
              />
            </GlowCard>

            <GlowCard delay={0.1}>
              <h3 className="text-xl font-bold mb-4 text-green-400">✅ Embedocs (Semantic)</h3>
              <CodeBlock
                code={`// Query: "database performance"
// Understands the CONCEPTS and RELATIONSHIPS

Found 127 semantically related docs:
- Query optimization techniques
- Index selection strategies  
- Read/write concern tuning
- Connection pool sizing
- Aggregation pipeline optimization
- Working set analysis
- Profiler interpretation
- Sharding for scale
- Caching patterns
- Hardware recommendations`}
                language="javascript"
                showLineNumbers={false}
              />
            </GlowCard>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="glass-dark rounded-xl p-6 text-center hover-card"
            >
              <div className="text-primary mb-2 flex justify-center">
                <Brain className="w-8 h-8" />
              </div>
              <div className="text-2xl font-bold gradient-text">1024 Dimensions</div>
              <div className="text-sm text-gray-400">Deep Understanding</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="glass-dark rounded-xl p-6 text-center hover-card"
            >
              <div className="text-primary mb-2 flex justify-center">
                <Zap className="w-8 h-8" />
              </div>
              <div className="text-2xl font-bold gradient-text">&lt;100ms</div>
              <div className="text-sm text-gray-400">Lightning Fast</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="glass-dark rounded-xl p-6 text-center hover-card"
            >
              <div className="text-primary mb-2 flex justify-center">
                <Database className="w-8 h-8" />
              </div>
              <div className="text-2xl font-bold gradient-text">50K+ Docs</div>
              <div className="text-sm text-gray-400">Massive Scale</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="glass-dark rounded-xl p-6 text-center hover-card"
            >
              <div className="text-primary mb-2 flex justify-center">
                <Github className="w-8 h-8" />
              </div>
              <div className="text-2xl font-bold gradient-text">Git-Aware</div>
              <div className="text-sm text-gray-400">Smart Updates</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Semantic Search Matters */}
      <section className="relative py-20 px-4 bg-gradient-to-b from-dark via-dark-200 to-dark">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">The Documentation Search</span>{' '}
              <span className="gradient-text">Reality Check</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Developers rarely know the exact terminology. Semantic search bridges this gap.
            </p>
          </motion.div>

          <div className="space-y-6">
            <GlowCard>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-bold mb-3 text-gray-400">🤔 What You Search:</h3>
                  <p className="text-xl text-white mb-2">"How to make MongoDB queries faster"</p>
                  <p className="text-sm text-gray-500">Natural language, problem-focused</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-3 text-primary">📚 What Docs Call It:</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li>• Query Performance Optimization</li>
                    <li>• Index Selection Strategies</li>
                    <li>• Execution Plan Analysis</li>
                    <li>• Read Preference Configuration</li>
                  </ul>
                </div>
              </div>
            </GlowCard>

            <GlowCard delay={0.1}>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-bold mb-3 text-gray-400">🤔 What You Search:</h3>
                  <p className="text-xl text-white mb-2">"MongoDB not connecting"</p>
                  <p className="text-sm text-gray-500">Symptom-based, frustrated</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-3 text-primary">📚 What Docs Call It:</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li>• Connection String URI Format</li>
                    <li>• Network Access Configuration</li>
                    <li>• Authentication Mechanisms</li>
                    <li>• TLS/SSL Certificate Setup</li>
                  </ul>
                </div>
              </div>
            </GlowCard>

            <GlowCard delay={0.2}>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-bold mb-3 text-gray-400">🤔 What You Search:</h3>
                  <p className="text-xl text-white mb-2">"Store embeddings in database"</p>
                  <p className="text-sm text-gray-500">Task-oriented, learning</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-3 text-primary">📚 What Docs Call It:</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li>• Atlas Vector Search</li>
                    <li>• knnBeta Operator</li>
                    <li>• Dense Vector Storage</li>
                    <li>• Similarity Search Indexes</li>
                  </ul>
                </div>
              </div>
            </GlowCard>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <p className="text-2xl font-semibold text-white mb-4">
              Embedocs understands both sides of this gap
            </p>
            <p className="text-lg text-gray-400">
              Semantic search connects your natural language to technical documentation automatically
            </p>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">Setup in</span>{' '}
              <span className="gradient-text">60 Seconds</span>
            </h2>
          </motion.div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="flex gap-6 items-start"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-black font-bold text-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Install Embedocs</h3>
                <p className="text-gray-400 mb-4">One command to install globally</p>
                <CodeBlock code="npm install -g embedocs-mcp" language="bash" showLineNumbers={false} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="flex gap-6 items-start"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-black font-bold text-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Run Setup Wizard</h3>
                <p className="text-gray-400 mb-4">Visual wizard guides you through MongoDB + Voyage AI setup (both FREE)</p>
                <CodeBlock code="embedocs setup" language="bash" showLineNumbers={false} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex gap-6 items-start"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-black font-bold text-lg">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Index Your Docs</h3>
                <p className="text-gray-400 mb-4">Index any GitHub repository - public or private</p>
                <CodeBlock 
                  code={`embedocs index https://github.com/mongodb/docs
embedocs index https://github.com/facebook/react
embedocs index https://github.com/your-company/docs`} 
                  language="bash" 
                  showLineNumbers={false} 
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="flex gap-6 items-start"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-black font-bold text-lg">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Connect to Your AI</h3>
                <p className="text-gray-400 mb-4">Works with Cursor IDE, Claude Desktop, any MCP-compatible AI</p>
                <CodeBlock 
                  code={`// .cursor/settings.json
{
  "mcpServers": {
    "embedocs": {
      "command": "embedocs-mcp"
    }
  }
}`} 
                  language="json" 
                  showLineNumbers={false} 
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { number: "92%", label: "Accuracy Score", description: "Semantic relevance with MMR diversity" },
              { number: "7.5x", label: "Faster Search", description: "Optimized vector search performance" },
              { number: "50K+", label: "Documents", description: "Handle massive documentation sets" }
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-5xl md:text-6xl font-bold gradient-text mb-2">{stat.number}</div>
                <div className="text-xl font-semibold mb-2">{stat.label}</div>
                <div className="text-gray-400">{stat.description}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="glass-dark rounded-2xl p-12 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent-green/20" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="gradient-text">Upgrade from Keywords</span>
                <br />
                <span className="text-white">to Semantic Understanding</span>
              </h2>
              
              <p className="text-xl text-gray-400 mb-8">
                Your AI deserves documentation search that understands meaning, not just matching words
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a
                  href="https://www.npmjs.com/package/embedocs-mcp"
                  className="neon-button text-black flex items-center gap-2 px-8 py-4"
                >
                  <Rocket className="w-5 h-5" />
                  Start Free Now
                </a>
                <a
                  href="https://github.com/romiluz13/EmbeDocs-MCP"
                  className="px-8 py-4 rounded-full glass-dark border border-gray-700 hover:border-primary/50 transition-all flex items-center gap-2"
                >
                  <TerminalIcon className="w-5 h-5" />
                  View on GitHub
                </a>
              </div>
              
              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  100% Free
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Open Source
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  MIT License
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Brain className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold gradient-text">Embedocs</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="https://github.com/romiluz13/EmbeDocs-MCP" className="hover:text-primary transition-colors">
              GitHub
            </a>
            <a href="https://www.npmjs.com/package/embedocs-mcp" className="hover:text-primary transition-colors">
              npm
            </a>
            <a href="https://github.com/romiluz13/EmbeDocs-MCP/issues" className="hover:text-primary transition-colors">
              Issues
            </a>
            <span>© 2024 Rom Iluz</span>
          </div>
        </div>
      </footer>
    </div>
  )
}