#!/usr/bin/env node

/**
 * EmbeDocs Rebranding Validation
 * Comprehensive 10-step audit to ensure complete transformation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${COLORS.green}✅ ${msg}${COLORS.reset}`),
  error: (msg) => console.log(`${COLORS.red}❌ ${msg}${COLORS.reset}`),
  warning: (msg) => console.log(`${COLORS.yellow}⚠️  ${msg}${COLORS.reset}`),
  info: (msg) => console.log(`${COLORS.cyan}ℹ️  ${msg}${COLORS.reset}`),
  title: (msg) => console.log(`\n${COLORS.bright}${COLORS.blue}═══ ${msg} ═══${COLORS.reset}\n`)
};

async function checkFile(filePath, searchTerms, shouldExist = false) {
  try {
    const content = await fs.readFile(path.join(__dirname, filePath), 'utf-8');
    const found = searchTerms.some(term => 
      content.toLowerCase().includes(term.toLowerCase())
    );
    
    if (shouldExist && !found) {
      return { success: false, message: `Missing expected terms in ${filePath}` };
    }
    if (!shouldExist && found) {
      return { success: false, message: `Found old terms in ${filePath}: ${searchTerms.filter(t => content.toLowerCase().includes(t.toLowerCase())).join(', ')}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, message: `Could not read ${filePath}: ${error.message}` };
  }
}

async function runValidation() {
  console.log(`
${COLORS.bright}${COLORS.cyan}
╔═══════════════════════════════════════════════════╗
║     EMBEDOCS REBRANDING VALIDATION AUDIT          ║
║     Complete 10-Step Verification                 ║
╚═══════════════════════════════════════════════════╝
${COLORS.reset}`);

  let totalChecks = 0;
  let passedChecks = 0;
  const issues = [];

  // Step 1: Check for old "mongodocs" references
  log.title('Step 1: Searching for old "mongodocs" references');
  const oldTerms = ['mongodocs', 'MongoDBSemantic', 'MongoDB Docs MCP', 'MongoDB Semantic'];
  const filesToCheck = [
    'package.json',
    'src/index.ts',
    'README.md',
    'bin/embedocs-mcp',
    'bin/embedocs-status',
    'mcp.json'
  ];
  
  for (const file of filesToCheck) {
    totalChecks++;
    const result = await checkFile(file, oldTerms, false);
    if (result.success) {
      log.success(`${file} - clean`);
      passedChecks++;
    } else {
      log.error(result.message);
      issues.push(result.message);
    }
  }

  // Step 2: Verify new "embedocs" branding
  log.title('Step 2: Verifying "embedocs" branding');
  const newTerms = ['embedocs', 'EmbeDocs'];
  const brandingFiles = [
    'package.json',
    'src/index.ts',
    'README.md'
  ];
  
  for (const file of brandingFiles) {
    totalChecks++;
    const result = await checkFile(file, newTerms, true);
    if (result.success) {
      log.success(`${file} - properly branded`);
      passedChecks++;
    } else {
      log.error(result.message);
      issues.push(result.message);
    }
  }

  // Step 3: Check package.json completeness
  log.title('Step 3: Validating package.json');
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf-8'));
    
    const checks = [
      { field: 'name', expected: 'embedocs-mcp' },
      { field: 'version', expected: '1.0.0' },
      { field: 'bin.embedocs-mcp', expected: 'bin/embedocs-mcp' },
      { field: 'bin.embedocs-index', expected: 'bin/embedocs-index' }
    ];
    
    for (const check of checks) {
      totalChecks++;
      const value = check.field.includes('.') 
        ? check.field.split('.').reduce((obj, key) => obj?.[key], pkg)
        : pkg[check.field];
      
      if (value === check.expected) {
        log.success(`${check.field} = "${check.expected}"`);
        passedChecks++;
      } else {
        log.error(`${check.field} = "${value}" (expected "${check.expected}")`);
        issues.push(`Wrong ${check.field} in package.json`);
      }
    }
  } catch (error) {
    log.error(`Could not parse package.json: ${error.message}`);
    issues.push('Invalid package.json');
  }

  // Step 4: Verify GitHub URLs
  log.title('Step 4: Checking GitHub URLs');
  const correctUrl = 'github.com/romiluz13/EmbeDocs-MCP';
  totalChecks++;
  
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf-8'));
    const repoUrl = pkg.repository?.url || '';
    
    if (repoUrl.includes(correctUrl)) {
      log.success(`Repository URL correct: ${correctUrl}`);
      passedChecks++;
    } else {
      log.error(`Wrong repository URL: ${repoUrl}`);
      issues.push('Incorrect GitHub URL in package.json');
    }
  } catch (error) {
    log.error(`Could not check repository URL: ${error.message}`);
  }

  // Step 5: Check bin files are executable
  log.title('Step 5: Verifying bin files');
  const binFiles = ['embedocs-mcp', 'embedocs-index', 'embedocs-status'];
  
  for (const binFile of binFiles) {
    totalChecks++;
    try {
      const stats = await fs.stat(path.join(__dirname, 'bin', binFile));
      if (stats.mode & 0o111) {
        log.success(`${binFile} is executable`);
        passedChecks++;
      } else {
        log.warning(`${binFile} is not executable`);
        issues.push(`${binFile} needs chmod +x`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        log.error(`${binFile} does not exist`);
        issues.push(`Missing bin/${binFile}`);
      }
    }
  }

  // Step 6: Verify build output
  log.title('Step 6: Checking build output');
  totalChecks++;
  
  try {
    await fs.access(path.join(__dirname, 'dist', 'index.js'));
    log.success('dist/index.js exists');
    passedChecks++;
  } catch {
    log.error('dist/index.js missing - run npm build');
    issues.push('Build output missing');
  }

  // Step 7: Check vector index creation
  log.title('Step 7: Verifying automatic vector index creation');
  totalChecks++;
  
  const storageFile = await fs.readFile(path.join(__dirname, 'src/core/storage.ts'), 'utf-8');
  if (storageFile.includes('createSearchIndex') && storageFile.includes('vectorSearch')) {
    log.success('Vector index creation code present');
    passedChecks++;
  } else {
    log.error('Vector index creation code missing');
    issues.push('Vector index not created automatically');
  }

  // Step 8: Validate README quality
  log.title('Step 8: Checking README quality');
  const readme = await fs.readFile(path.join(__dirname, 'README.md'), 'utf-8');
  
  const requiredSections = [
    { pattern: /Quick Start/, name: 'Quick Start section' },
    { pattern: /embedocs setup/, name: 'Setup command' },
    { pattern: /embedocs index/, name: 'Index command' },
    { pattern: /MongoDB Atlas/, name: 'MongoDB Atlas mention' },
    { pattern: /Voyage AI/, name: 'Voyage AI mention' },
    { pattern: /ASCII|███/, name: 'ASCII art banner' }
  ];
  
  for (const section of requiredSections) {
    totalChecks++;
    if (section.pattern.test(readme)) {
      log.success(`README has ${section.name}`);
      passedChecks++;
    } else {
      log.warning(`README missing ${section.name}`);
      issues.push(`README missing ${section.name}`);
    }
  }

  // Step 9: Test MCP tools configuration
  log.title('Step 9: Verifying MCP tools');
  totalChecks++;
  
  const indexFile = await fs.readFile(path.join(__dirname, 'src/index.ts'), 'utf-8');
  if (indexFile.includes('mongodb-search') && indexFile.includes('mongodb-mmr-search')) {
    log.success('MCP tools properly configured');
    passedChecks++;
  } else {
    log.error('MCP tools misconfigured');
    issues.push('MCP tools not properly set up');
  }

  // Step 10: Final summary
  log.title('Step 10: Final Validation Summary');
  
  const percentage = Math.round((passedChecks / totalChecks) * 100);
  
  console.log(`\n${COLORS.bright}📊 AUDIT RESULTS${COLORS.reset}`);
  console.log(`${COLORS.bright}═══════════════${COLORS.reset}\n`);
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed: ${COLORS.green}${passedChecks}${COLORS.reset}`);
  console.log(`Failed: ${COLORS.red}${totalChecks - passedChecks}${COLORS.reset}`);
  console.log(`Success Rate: ${percentage >= 90 ? COLORS.green : percentage >= 70 ? COLORS.yellow : COLORS.red}${percentage}%${COLORS.reset}\n`);
  
  if (issues.length > 0) {
    console.log(`${COLORS.red}${COLORS.bright}⚠️  ISSUES FOUND:${COLORS.reset}`);
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    console.log();
  }
  
  if (percentage === 100) {
    console.log(`${COLORS.green}${COLORS.bright}🎉 PERFECT! Rebranding is 100% complete!${COLORS.reset}`);
    console.log(`${COLORS.green}✅ Safe to publish as embedocs-mcp v1.0.0${COLORS.reset}`);
  } else if (percentage >= 90) {
    console.log(`${COLORS.yellow}${COLORS.bright}⚠️  ALMOST THERE! Fix remaining issues before publishing.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}${COLORS.bright}❌ CRITICAL ISSUES! Do not publish until fixed.${COLORS.reset}`);
  }
  
  console.log(`\n${COLORS.cyan}Next steps:${COLORS.reset}`);
  console.log('1. Fix any issues listed above');
  console.log('2. Run: npm run build');
  console.log('3. Test: npm run test');
  console.log('4. Publish: npm publish');
  console.log('5. Update GitHub repo name to match');
}

// Run validation
runValidation().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});