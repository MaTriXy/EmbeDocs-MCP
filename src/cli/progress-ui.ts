#!/usr/bin/env node

/**
 * Progress UI - Web-based monitoring interface
 * Runs on http://localhost:3000
 */

import express from 'express';
import { MongoClient } from 'mongodb';
import open from 'open';
import chalk from 'chalk';
import boxen from 'boxen';

const app = express();
const PORT = process.env.EMBEDOCS_PORT || 3333;

// MongoDB connection
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error(chalk.red('❌ MONGODB_URI environment variable is required'));
  process.exit(1);
}

const client = new MongoClient(uri);

// HTML template
const getHTML = (data: any) => `
<!DOCTYPE html>
<html>
<head>
  <title>EmbeDocs Repository Indexing Progress</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 800px;
      width: 100%;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 32px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat {
      background: #f7f7f7;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }
    .stat-label {
      color: #666;
      font-size: 14px;
    }
    .progress-bar {
      background: #f0f0f0;
      height: 40px;
      border-radius: 20px;
      overflow: hidden;
      margin-bottom: 30px;
    }
    .progress-fill {
      background: linear-gradient(90deg, #667eea, #764ba2);
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      transition: width 0.5s ease;
    }
    .repos {
      margin-top: 30px;
    }
    .repo {
      display: flex;
      justify-content: space-between;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .repo-name {
      font-weight: 600;
      color: #333;
    }
    .repo-count {
      color: #667eea;
      font-weight: bold;
    }
    .refresh {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 20px;
    }
    .status {
      text-align: center;
      padding: 10px;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    .status.indexing {
      background: #fff3cd;
      color: #856404;
    }
    .status.complete {
      background: #d4edda;
      color: #155724;
    }
    .keep-awake {
      background: #e8f5e8;
      border: 2px solid #28a745;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }
    .awake-button {
      background: #28a745;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      margin-top: 10px;
      transition: all 0.3s ease;
    }
    .awake-button:hover {
      background: #218838;
      transform: translateY(-2px);
    }
    .awake-button.active {
      background: #dc3545;
    }
    .awake-status {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }
  </style>
  <script>
    let wakeLock = null;
    let isAwake = false;
    
    async function toggleKeepAwake() {
      const button = document.getElementById('awakeButton');
      const status = document.getElementById('awakeStatus');
      
      try {
        if (!isAwake) {
          // Request wake lock
          wakeLock = await navigator.wakeLock.request('screen');
          isAwake = true;
          button.textContent = '🟢 Mac is Awake - Click to Allow Sleep';
          button.classList.add('active');
          status.textContent = '✅ Screen will stay awake while indexing runs';
          
          wakeLock.addEventListener('release', () => {
            isAwake = false;
            button.textContent = '😴 Keep Mac Awake During Indexing';
            button.classList.remove('active');
            status.textContent = '💤 Mac can sleep normally';
          });
        } else {
          // Release wake lock
          if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
          }
        }
      } catch (err) {
        console.error('Wake Lock API error:', err);
        status.textContent = '❌ Wake Lock not supported in this browser';
      }
    }
    
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</head>
<body>
  <div class="container">
    <h1>🚀 EmbeDocs Repository Indexing</h1>
    <div class="subtitle">Real-time progress monitoring</div>
    
    <div class="status ${data.isComplete ? 'complete' : 'indexing'}">
      ${data.isComplete ? '✅ Indexing Complete!' : '⏳ Indexing in progress...'}
    </div>
    
    ${!data.isComplete ? `
    <div class="keep-awake">
      <div>💻 <strong>Long Process Alert!</strong></div>
      <div style="margin: 10px 0; color: #666;">Estimated ${data.estimatedTime} remaining - Keep your Mac awake!</div>
      <button id="awakeButton" class="awake-button" onclick="toggleKeepAwake()">
        😴 Keep Mac Awake During Indexing
      </button>
      <div id="awakeStatus" class="awake-status">Click to prevent Mac from sleeping</div>
    </div>
    ` : ''}
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${data.totalDocs.toLocaleString()}</div>
        <div class="stat-label">Total Documents</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.repoCount}/5</div>
        <div class="stat-label">Repositories</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.estimatedTime}</div>
        <div class="stat-label">Est. Time Remaining</div>
      </div>
    </div>
    
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${data.progress}%">
        ${data.progress}%
      </div>
    </div>
    
    <div class="repos">
      <h3>Repository Status</h3>
      ${data.repos.map((repo: any) => `
        <div class="repo">
          <span class="repo-name">${repo.icon} ${repo.name}</span>
          <span class="repo-count">${repo.count} docs</span>
        </div>
      `).join('')}
    </div>
    
    <div class="refresh">Auto-refreshing every 5 seconds...</div>
  </div>
</body>
</html>
`;

// API endpoint
app.get('/', async (_req, res) => {
  try {
    await client.connect();
    const db = client.db('mongodb_semantic_docs');
    const collection = db.collection('documents');
    
    const totalDocs = await collection.countDocuments();
    const products = await collection.distinct('product');
    
    // Get counts per product
    const repoCounts: any = {};
    for (const product of products) {
      repoCounts[product] = await collection.countDocuments({ product });
    }
    
    // Expected repos (updated with actual counts from our test)
    const expectedRepos = [
      { id: 'docs', name: 'Repository Documents', icon: '📚', expected: 9800 },
      { id: 'genai', name: 'GenAI Showcase (3.9k⭐)', icon: '🤖', expected: 40 },
      { id: 'rag', name: 'MongoDB Chatbot (RAG)', icon: '💬', expected: 61 },
      { id: 'tutorials', name: 'Vector Search Notebooks', icon: '📓', expected: 3 },
      { id: 'agents', name: 'Multimodal AI Agents', icon: '🧪', expected: 2 }
    ];
    
    const repos = expectedRepos.map(repo => ({
      ...repo,
      count: repoCounts[repo.id] || 0
    }));
    
    const expectedTotal = 10596; // Correct count from 5 repositories combined
    const progress = Math.min(100, Math.round((totalDocs / expectedTotal) * 100));
    const isComplete = progress >= 100;
    
    // More accurate time estimation based on Voyage AI rate limits
    const docsPerMinute = 60; // Conservative: 1 doc/second due to batching + rate limits
    const remaining = Math.max(0, expectedTotal - totalDocs);
    const minutesLeft = Math.ceil(remaining / docsPerMinute);
    const estimatedTime = isComplete ? 'Complete!' : 
      minutesLeft > 120 ? `${Math.floor(minutesLeft/60)}h ${minutesLeft%60}m` : 
      minutesLeft > 60 ? `${Math.floor(minutesLeft/60)}h ${minutesLeft%60}m` :
      `${minutesLeft} min`;
    
    const data = {
      totalDocs,
      repoCount: products.length,
      progress,
      isComplete,
      estimatedTime,
      repos
    };
    
    res.send(getHTML(data));
  } catch (error) {
    res.status(500).send('<h1>Error connecting to MongoDB</h1>');
  }
});

// Start server
app.listen(PORT, () => {
  const box = boxen(
    chalk.cyan.bold('📊 Progress UI Running\n\n') +
    chalk.white(`URL: ${chalk.green(`http://localhost:${PORT}`)}\n`) +
    chalk.white('Auto-refreshes every 5 seconds\n') +
    chalk.yellow('\nPress Ctrl+C to stop'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan'
    }
  );
  
  console.log(box);
  
  // Open browser automatically
  open(`http://localhost:${PORT}`);
});