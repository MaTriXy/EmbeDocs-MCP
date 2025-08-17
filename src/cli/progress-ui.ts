#!/usr/bin/env node

/**
 * SIMPLE INDEXING PROGRESS UI
 * 
 * A lightweight web UI to monitor MongoDB indexing progress in real-time
 */

import express from 'express';
import { MongoClient } from 'mongodb';
import * as fs from 'fs/promises';
import dotenv from 'dotenv';
import colors from 'colors';

dotenv.config();

interface ProgressData {
  documents: number;
  completedSources: number;
  totalSources: number;
  failedFiles: number;
  currentSource?: string;
  lastUpdated: Date;
  status: 'idle' | 'running' | 'completed' | 'error';
  estimatedTime?: string;
}

class ProgressUI {
  private app = express();
  private mongoClient: MongoClient;
  private port = 3333;

  constructor() {
    this.mongoClient = new MongoClient(process.env.MONGODB_URI!);
    this.setupRoutes();
  }

  private setupRoutes() {
    // Serve static HTML
    this.app.get('/', (_req, res) => {
      res.send(this.getHTML());
    });

    // API endpoint for progress data
    this.app.get('/api/progress', async (_req, res) => {
      try {
        const progress = await this.getProgressData();
        res.json(progress);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch progress' });
      }
    });

    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  private async getProgressData(): Promise<ProgressData> {
    await this.mongoClient.connect();
    const db = this.mongoClient.db('mongodb_semantic_docs');
    const collection = db.collection('documents');

    const documents = await collection.countDocuments();
    
    // Try to read state file
    let state: any = {};
    try {
      const stateContent = await fs.readFile('indexing-state.json', 'utf-8');
      state = JSON.parse(stateContent);
    } catch (error) {
      // No state file or can't read it
    }

    const completedSources = state.completedRepos?.length || 0;
    const totalSources = 1; // Ultra-optimized single repository (mongodb/docs)
    const failedFiles = state.failedFiles?.length || 0;

    let status: ProgressData['status'] = 'idle';
    if (completedSources === totalSources) {
      status = 'completed';
    } else if (completedSources > 0 || documents > 0) {
      status = 'running';
    }

    // Estimate completion time (rough calculation)
    const progress = completedSources / totalSources;
    let estimatedTime = 'Unknown';
    if (progress > 0.1) {
      const elapsed = Date.now() - (state.lastCheckpoint || Date.now());
      const remaining = (elapsed / progress) * (1 - progress);
      estimatedTime = `${Math.round(remaining / 60000)} minutes`;
    }

    await this.mongoClient.close();

    return {
      documents,
      completedSources,
      totalSources,
      failedFiles,
      currentSource: state.currentRepo,
      lastUpdated: new Date(),
      status,
      estimatedTime: status === 'running' ? estimatedTime : undefined
    };
  }

  private getHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MongoDB Indexing Progress</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
            padding: 20px;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .title {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            font-size: 1.1em;
            opacity: 0.8;
        }
        .progress-card {
            background: rgba(255,255,255,0.15);
            border-radius: 15px;
            padding: 25px;
            margin: 20px 0;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 15px 0;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .metric:last-child { border-bottom: none; }
        .metric-label {
            font-weight: 500;
            opacity: 0.9;
        }
        .metric-value {
            font-weight: 700;
            font-size: 1.2em;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            overflow: hidden;
            margin: 20px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #00d4aa, #00b4d8);
            border-radius: 10px;
            transition: width 0.5s ease;
            position: relative;
        }
        .progress-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 2s infinite;
        }
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        .status {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85em;
        }
        .status.running { background: #28a745; }
        .status.completed { background: #17a2b8; }
        .status.idle { background: #6c757d; }
        .status.error { background: #dc3545; }
        .loading {
            text-align: center;
            opacity: 0.7;
            font-style: italic;
        }
        .refresh-info {
            text-align: center;
            margin-top: 20px;
            opacity: 0.6;
            font-size: 0.9em;
        }
        .wake-lock-controls {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            border: 1px solid rgba(255,255,255,0.2);
            text-align: center;
        }
        .wake-lock-button {
            background: linear-gradient(45deg, #667eea, #764ba2);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 0.9em;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 0 10px;
        }
        .wake-lock-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .wake-lock-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .wake-lock-button.active {
            background: linear-gradient(45deg, #28a745, #20c997);
        }
        .wake-lock-status {
            margin-top: 10px;
            font-size: 0.85em;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">⚡ Ultra-Fast MongoDB Indexing</h1>
            <p class="subtitle">Single Repository • Latest Features • Maximum Speed</p>
        </div>

        <div class="wake-lock-controls">
            <button id="wakeLockBtn" class="wake-lock-button" onclick="toggleWakeLock()">
                🌙 Keep Mac Awake
            </button>
            <div id="wakeLockStatus" class="wake-lock-status">
                Click to prevent your Mac from sleeping during indexing
            </div>
        </div>

        <div id="progress" class="loading">
            Loading progress data...
        </div>
    </div>

    <script>
        // Wake Lock functionality
        let wakeLock = null;
        let wakeLockActive = false;

        async function toggleWakeLock() {
            const button = document.getElementById('wakeLockBtn');
            const status = document.getElementById('wakeLockStatus');

            if (!wakeLockActive) {
                try {
                    // Request wake lock
                    if ('wakeLock' in navigator) {
                        wakeLock = await navigator.wakeLock.request('screen');
                        wakeLockActive = true;
                        button.textContent = '☀️ Mac Kept Awake';
                        button.classList.add('active');
                        status.textContent = '✅ Your Mac will stay awake while this tab is open';
                        
                        // Handle wake lock release
                        wakeLock.addEventListener('release', () => {
                            wakeLockActive = false;
                            button.textContent = '🌙 Keep Mac Awake';
                            button.classList.remove('active');
                            status.textContent = 'Wake lock released - Mac can sleep again';
                        });
                    } else {
                        // Fallback: Use invisible video trick for older browsers
                        createInvisibleVideo();
                        wakeLockActive = true;
                        button.textContent = '☀️ Mac Kept Awake';
                        button.classList.add('active');
                        status.textContent = '✅ Your Mac will stay awake (using video fallback)';
                    }
                } catch (err) {
                    status.textContent = \`❌ Could not activate wake lock: \${err.message}\`;
                }
            } else {
                // Release wake lock
                if (wakeLock) {
                    await wakeLock.release();
                    wakeLock = null;
                } else {
                    // Remove fallback video
                    const video = document.getElementById('wakeLockVideo');
                    if (video) video.remove();
                }
                wakeLockActive = false;
                button.textContent = '🌙 Keep Mac Awake';
                button.classList.remove('active');
                status.textContent = 'Click to prevent your Mac from sleeping during indexing';
            }
        }

        function createInvisibleVideo() {
            // Fallback method: Create invisible looping video
            const video = document.createElement('video');
            video.id = 'wakeLockVideo';
            video.style.position = 'fixed';
            video.style.top = '-1px';
            video.style.left = '-1px';
            video.style.width = '1px';
            video.style.height = '1px';
            video.style.opacity = '0.01';
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            
            // Create a minimal video data URL
            video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWF2YzEAAAAIZnJlZQAAAAhtZGF0AAAC7QYF//+13EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjEgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz02IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAVZliIQL8mKAAKvMnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnH//2Q==';
            
            document.body.appendChild(video);
            video.play().catch(() => {
                // If video fails, remove it
                video.remove();
            });
        }

        // Auto-enable wake lock when indexing starts
        function autoEnableWakeLock(data) {
            if (data.status === 'running' && !wakeLockActive) {
                const status = document.getElementById('wakeLockStatus');
                status.innerHTML = '💡 <strong>Tip:</strong> Click "Keep Mac Awake" to prevent sleep during long indexing';
            }
        }

        async function fetchProgress() {
            try {
                const response = await fetch('/api/progress');
                const data = await response.json();
                updateUI(data);
                autoEnableWakeLock(data);
            } catch (error) {
                document.getElementById('progress').innerHTML = 
                    '<div class="progress-card"><p style="text-align: center; color: #ff6b6b;">Error loading progress data</p></div>';
            }
        }

        function updateUI(data) {
            const progressPercent = Math.round((data.completedSources / data.totalSources) * 100);
            
            document.getElementById('progress').innerHTML = \`
                <div class="progress-card">
                    <div class="metric">
                        <span class="metric-label">Status</span>
                        <span class="status \${data.status}">\${data.status}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: \${progressPercent}%"></div>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Overall Progress</span>
                        <span class="metric-value">\${progressPercent}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Documents Indexed</span>
                        <span class="metric-value">\${data.documents.toLocaleString()}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Repository (MongoDB Complete)</span>
                        <span class="metric-value">\${data.completedSources}/\${data.totalSources}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Failed Files</span>
                        <span class="metric-value" style="color: \${data.failedFiles > 0 ? '#ff6b6b' : '#28a745'}">\${data.failedFiles}</span>
                    </div>
                    \${data.currentSource ? \`
                        <div class="metric">
                            <span class="metric-label">Current Source</span>
                            <span class="metric-value" style="font-size: 1em;">\${data.currentSource}</span>
                        </div>
                    \` : ''}
                    \${data.estimatedTime ? \`
                        <div class="metric">
                            <span class="metric-label">Estimated Time</span>
                            <span class="metric-value">\${data.estimatedTime}</span>
                        </div>
                    \` : ''}
                    <div class="metric">
                        <span class="metric-label">Last Updated</span>
                        <span class="metric-value" style="font-size: 0.9em;">\${new Date(data.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                </div>
                <div class="refresh-info">
                    Auto-refreshing every 5 seconds
                </div>
            \`;
        }

        // Fetch immediately and then every 5 seconds
        fetchProgress();
        setInterval(fetchProgress, 5000);
    </script>
</body>
</html>`;
  }

  public async start() {
    return new Promise<void>((resolve) => {
      this.app.listen(this.port, () => {
        console.log(colors.green('🌐 Progress UI started!'));
        console.log(colors.cyan(`📊 View progress: http://localhost:${this.port}`));
        console.log(colors.yellow('📡 API endpoint: http://localhost:3333/api/progress'));
        console.log(colors.gray('Press Ctrl+C to stop\n'));
        resolve();
      });
    });
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
  process.argv[1]?.endsWith('progress-ui.ts') ||
  process.argv[1]?.endsWith('progress-ui.js');

if (isMainModule) {
  const ui = new ProgressUI();
  ui.start().catch(console.error);
}

export { ProgressUI };