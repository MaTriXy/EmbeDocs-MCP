#!/usr/bin/env node

/**
 * MongoDB Semantic Docs - Beautiful Setup Wizard
 * The most elegant onboarding experience ever created
 */

import inquirer from 'inquirer';
import { MongoClient } from 'mongodb';
import { VoyageAIClient } from 'voyageai';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import open from 'open';

// Beautiful gradients
const mongoGradient = gradient(['#00ED64', '#13AA52', '#21313C']);
const voyageGradient = gradient(['#6366F1', '#8B5CF6', '#EC4899']);
const successGradient = gradient(['#10B981', '#34D399', '#6EE7B7']);

class SetupWizard {
  private mongoUri?: string;
  private voyageKey?: string;

  async run() {
    console.clear();
    await this.showWelcome();
    await this.collectCredentials();
    await this.testConnections();
    await this.saveConfiguration();
    await this.configureCursor();
    await this.showSuccess();
  }

  private async showWelcome() {
    // Epic ASCII art
    const logo = figlet.textSync('MongoDB', { font: 'ANSI Shadow' });
    console.log(mongoGradient(logo));
    console.log(voyageGradient('    + Voyage AI\n'));
    
    const welcomeBox = boxen(
      chalk.bold.white('🚀 MongoDB Semantic Docs - SETUP WIZARD\n\n') +
      chalk.cyan('Welcome! Let\'s get you searching MongoDB docs\n') +
      chalk.cyan('in under 5 minutes!\n\n') +
      chalk.yellow('📋 What you\'ll need:\n') +
      chalk.white('  ✓ MongoDB Atlas account (free)\n') +
      chalk.white('  ✓ Voyage AI API key (free)\n\n') +
      chalk.gray('🔗 Quick Links:\n') +
      chalk.gray('  MongoDB Atlas: https://cloud.mongodb.com ') + chalk.cyan('(press \'a\')\n') +
      chalk.gray('  Voyage AI: https://voyageai.com ') + chalk.cyan('(press \'v\')\n'),
      {
        padding: 2,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'cyan',
        align: 'center'
      }
    );
    
    console.log(welcomeBox);
    
    const { action } = await inquirer.prompt([
      {
        type: 'expand',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { key: 'a', name: 'Open MongoDB Atlas in browser', value: 'atlas' },
          { key: 'v', name: 'Open Voyage AI in browser', value: 'voyage' },
          { key: 'c', name: 'Continue with setup', value: 'continue' },
        ],
        default: 'continue'
      }
    ]);
    
    if (action === 'atlas') {
      await open('https://cloud.mongodb.com');
      console.log(chalk.green('\n✅ Opened MongoDB Atlas in your browser'));
      await this.showWelcome();
    } else if (action === 'voyage') {
      await open('https://www.voyageai.com');
      console.log(chalk.green('\n✅ Opened Voyage AI in your browser'));
      await this.showWelcome();
    }
  }

  private async collectCredentials() {
    console.log(chalk.cyan.bold('\n📝 Step 1: MongoDB Atlas Configuration\n'));
    
    const mongoBox = boxen(
      chalk.yellow('How to get your MongoDB URI:\n\n') +
      chalk.white('1. Go to MongoDB Atlas (cloud.mongodb.com)\n') +
      chalk.white('2. Create a free cluster (M0)\n') +
      chalk.white('3. Click "Connect" → "Drivers"\n') +
      chalk.white('4. Copy the connection string\n') +
      chalk.white('5. Replace <password> with your password\n\n') +
      chalk.gray('Example: mongodb+srv://user:pass@cluster.mongodb.net/'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    );
    console.log(mongoBox);
    
    const { mongoUri } = await inquirer.prompt([
      {
        type: 'password',
        name: 'mongoUri',
        message: 'Enter your MongoDB URI:',
        mask: '•',
        validate: (input) => {
          if (!input.startsWith('mongodb')) {
            return 'URI must start with mongodb:// or mongodb+srv://';
          }
          return true;
        }
      }
    ]);
    
    this.mongoUri = mongoUri;
    
    console.log(chalk.cyan.bold('\n🔑 Step 2: Voyage AI Configuration\n'));
    
    const voyageBox = boxen(
      chalk.yellow('How to get your Voyage AI key:\n\n') +
      chalk.white('1. Go to voyageai.com\n') +
      chalk.white('2. Sign up for free account\n') +
      chalk.white('3. Go to API Keys section\n') +
      chalk.white('4. Create new API key\n') +
      chalk.white('5. Copy the key (starts with "pa-")\n\n') +
      chalk.gray('Free tier: 50M tokens/month'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'magenta'
      }
    );
    console.log(voyageBox);
    
    const { voyageKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'voyageKey',
        message: 'Enter your Voyage AI API key:',
        mask: '•',
        validate: (input) => {
          if (!input.startsWith('pa-')) {
            return 'Voyage AI keys start with "pa-"';
          }
          return true;
        }
      }
    ]);
    
    this.voyageKey = voyageKey;
  }

  private async testConnections() {
    console.log(chalk.cyan.bold('\n🧪 Step 3: Testing Connections\n'));
    
    // Test MongoDB
    const mongoSpinner = ora({
      text: 'Testing MongoDB connection...',
      spinner: 'dots12'
    }).start();
    
    try {
      const client = new MongoClient(this.mongoUri!);
      await client.connect();
      await client.db('admin').command({ ping: 1 });
      await client.close();
      mongoSpinner.succeed(chalk.green('MongoDB connection successful!'));
    } catch (error) {
      mongoSpinner.fail(chalk.red('MongoDB connection failed'));
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
    
    // Test Voyage AI
    const voyageSpinner = ora({
      text: 'Testing Voyage AI connection...',
      spinner: 'dots12'
    }).start();
    
    try {
      const voyage = new VoyageAIClient({ apiKey: this.voyageKey! });
      await voyage.embed({
        input: ['test'],
        model: 'voyage-3',
        inputType: 'query'
      });
      voyageSpinner.succeed(chalk.green('Voyage AI connection successful!'));
    } catch (error) {
      voyageSpinner.fail(chalk.red('Voyage AI connection failed'));
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  }

  private async saveConfiguration() {
    console.log(chalk.cyan.bold('\n💾 Step 4: Saving Configuration\n'));
    
    const spinner = ora({
      text: 'Saving configuration...',
      spinner: 'dots12'
    }).start();
    
    try {
      // Save to .env file
      const envPath = path.join(process.cwd(), '.env');
      const envContent = `# MongoDB Semantic Docs Configuration
MONGODB_URI=${this.mongoUri}
VOYAGE_API_KEY=${this.voyageKey}
LOG_LEVEL=info
`;
      
      await fs.writeFile(envPath, envContent);
      
      // Also save to user's home directory for global access
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (homeDir) {
        const globalConfigDir = path.join(homeDir, '.mongodocs-mcp');
        await fs.mkdir(globalConfigDir, { recursive: true });
        await fs.writeFile(path.join(globalConfigDir, '.env'), envContent);
      }
      
      spinner.succeed(chalk.green('Configuration saved!'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to save configuration'));
      console.error(error);
    }
  }

  private async configureCursor() {
    console.log(chalk.cyan.bold('\n🔌 Step 5: Cursor IDE Configuration\n'));
    
    const { setupCursor } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setupCursor',
        message: 'Would you like to automatically configure Cursor IDE?',
        default: true
      }
    ]);
    
    if (setupCursor) {
      const spinner = ora({
        text: 'Configuring Cursor IDE...',
        spinner: 'dots12'
      }).start();
      
      try {
        const cursorConfigPath = path.join(process.cwd(), '.cursor', 'mcp_servers.json');
        await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
        
        let config: any = {};
        try {
          const existing = await fs.readFile(cursorConfigPath, 'utf-8');
          config = JSON.parse(existing);
        } catch {
          // File doesn't exist, start fresh
        }
        
        config.mongodocs = {
          command: 'mongodocs-mcp',
          env: {
            MONGODB_URI: this.mongoUri,
            VOYAGE_API_KEY: this.voyageKey
          }
        };
        
        await fs.writeFile(cursorConfigPath, JSON.stringify(config, null, 2));
        spinner.succeed(chalk.green('Cursor IDE configured!'));
        
        console.log(chalk.gray('\n  Cursor will now have access to MongoDB docs search!'));
      } catch (error) {
        spinner.fail(chalk.yellow('Could not auto-configure Cursor'));
        
        const manualBox = boxen(
          chalk.yellow('Manual Cursor Setup:\n\n') +
          chalk.white('Add to .cursor/mcp_servers.json:\n\n') +
          chalk.gray(JSON.stringify({
            mongodocs: {
              command: 'mongodocs-mcp',
              env: {
                MONGODB_URI: 'your-uri',
                VOYAGE_API_KEY: 'your-key'
              }
            }
          }, null, 2)),
          {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
          }
        );
        console.log(manualBox);
      }
    }
  }

  private async showSuccess() {
    console.log('\n');
    
    const successLogo = figlet.textSync('SUCCESS!', { font: 'Standard' });
    console.log(successGradient(successLogo));
    
    const successBox = boxen(
      chalk.green.bold('✅ Setup Complete!\n\n') +
      chalk.white('Next steps:\n\n') +
      chalk.cyan('1. Index documents:\n') +
      chalk.white('   mongodocs-index\n\n') +
      chalk.cyan('2. Start using in Cursor:\n') +
      chalk.white('   Just ask questions about MongoDB!\n\n') +
      chalk.yellow('Example queries:\n') +
      chalk.gray('  • "How do I create indexes in MongoDB?"\n') +
      chalk.gray('  • "Show me aggregation pipeline examples"\n') +
      chalk.gray('  • "Explain MongoDB transactions"\n'),
      {
        padding: 2,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green',
        align: 'center'
      }
    );
    
    console.log(successBox);
    
    const { runIndexer } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runIndexer',
        message: 'Would you like to start indexing now? (5 minutes)',
        default: true
      }
    ]);
    
    if (runIndexer) {
      console.log(chalk.cyan('\n🚀 Starting indexer...\n'));
      execSync('mongodocs-index', { stdio: 'inherit' });
    }
  }
}

// Run the wizard
if (import.meta.url === `file://${process.argv[1]}` || 
    import.meta.url === `file://${process.argv[1]}.ts`) {
  const wizard = new SetupWizard();
  wizard.run().catch(console.error);
}

export { SetupWizard };
