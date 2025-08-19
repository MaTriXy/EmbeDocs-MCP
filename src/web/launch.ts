#!/usr/bin/env node

/**
 * EmbeDocs Web UI Launcher
 * Starts the web interface for document embedding setup
 */

import dotenv from 'dotenv';

// CRITICAL FIX: Load environment variables before starting server
dotenv.config();

import './server.js';

console.log(`
🧠 EmbeDocs Web Interface Starting...

🎯 Features:
   • Beautiful setup interface for MongoDB + Voyage AI
   • Repository selection with 5 default MongoDB repos
   • Custom GitHub repository support
   • Real-time progress monitoring
   • Zero configuration needed - just open and configure!

🚀 Opening browser automatically...
`);