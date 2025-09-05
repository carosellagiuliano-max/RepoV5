#!/usr/bin/env node

/**
 * Design Lock Script
 * Prevents modifications to UI/styling files to maintain design consistency
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Patterns for protected files (no UI changes allowed)
const PROTECTED_PATTERNS = [
  '**/*.css',
  'tailwind.config.*',
  'src/components/ui/**',
  'src/styles/**',
  'src/assets/**/*.{jpg,jpeg,png,gif,svg,webp}', // Existing images
];

// Patterns for allowed new files only
const ALLOWED_NEW_ONLY_PATTERNS = [
  'public/lovable-uploads/**',
];

// Patterns for allowed modifications (specific public files mentioned in constraints)
const ALLOWED_MODIFICATION_PATTERNS = [
  'public/robots.txt',
  'public/sitemap.xml', 
  'public/manifest.webmanifest',
  'public/_headers',
];

function getModifiedFiles() {
  try {
    // Get all modified files (staged and unstaged)
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
    const unstaged = execSync('git diff --name-only', { encoding: 'utf8' }).trim();
    
    const allFiles = [...new Set([
      ...staged.split('\n').filter(Boolean),
      ...unstaged.split('\n').filter(Boolean)
    ])];
    
    return allFiles;
  } catch (error) {
    console.error('Error getting modified files:', error.message);
    return [];
  }
}

function matchesPattern(file, patterns) {
  return patterns.some(pattern => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(file);
  });
}

function checkDesignLock() {
  const modifiedFiles = getModifiedFiles();
  
  if (modifiedFiles.length === 0) {
    console.log('✅ Design Lock: No files to check');
    return true;
  }

  console.log(`🔍 Design Lock: Checking ${modifiedFiles.length} modified files...`);
  
  const violations = [];
  
  for (const file of modifiedFiles) {
    // Check if file matches protected patterns
    if (matchesPattern(file, PROTECTED_PATTERNS)) {
      violations.push({
        file,
        reason: 'Protected file - UI/styling changes not allowed'
      });
      continue;
    }
    
    // Check if it's an allowed modification
    if (matchesPattern(file, ALLOWED_MODIFICATION_PATTERNS)) {
      console.log(`✅ Design Lock: Allowed modification - ${file}`);
      continue;
    }
    
    // Check if it's a new file in allowed locations
    if (matchesPattern(file, ALLOWED_NEW_ONLY_PATTERNS)) {
      try {
        // Check if file exists in git history (is it truly new?)
        execSync(`git cat-file -e HEAD:${file}`, { stdio: 'ignore' });
        violations.push({
          file,
          reason: 'File exists - only new files allowed in this location'
        });
      } catch {
        // File doesn't exist in git history, so it's new - allowed
        console.log(`✅ Design Lock: New allowed file - ${file}`);
      }
    }
  }
  
  if (violations.length > 0) {
    console.error('\n❌ Design Lock Violations Detected:\n');
    violations.forEach(({ file, reason }) => {
      console.error(`  ${file}`);
      console.error(`    Reason: ${reason}\n`);
    });
    
    console.error('🔒 Design Lock Policy:');
    console.error('  - No modifications to existing UI/styling files');
    console.error('  - No changes to CSS, Tailwind config, or component styles');
    console.error('  - Only new files allowed in: src/admin/, src/lib/, src/hooks/, netlify/functions/, docs/, tests/');
    console.error('  - Public folder: only robots.txt, sitemap.xml, manifest.webmanifest, _headers\n');
    
    return false;
  }
  
  console.log('✅ Design Lock: All checks passed');
  return true;
}

// Run the check
const passed = checkDesignLock();
process.exit(passed ? 0 : 1);