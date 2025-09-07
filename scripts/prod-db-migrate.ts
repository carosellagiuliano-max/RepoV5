import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

// --- Configuration ---
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
const DB_PORT = process.env.DB_PORT || 5432;

const MIGRATIONS_DIR = path.join(__dirname, '../docs/db');

// --- Helper Functions ---
function log(message: string, level: 'INFO' | 'ERROR' | 'SUCCESS' = 'INFO') {
  const colors = {
    INFO: '\x1b[34m', // Blue
    ERROR: '\x1b[31m', // Red
    SUCCESS: '\x1b[32m', // Green
    RESET: '\x1b[0m',
  };
  console.log(`${colors[level]}${level}: ${message}${colors.RESET}`);
}

async function getMigrationFiles(): Promise<string[]> {
  try {
    const allFiles = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = allFiles
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[0], 10);
        const numB = parseInt(b.split('_')[0], 10);
        return numA - numB;
      });
    if (sqlFiles.length === 0) {
      throw new Error('No SQL migration files found.');
    }
    log(`Found ${sqlFiles.length} migration files to execute.`);
    return sqlFiles;
  } catch (error) {
    log(`Error reading migration files from ${MIGRATIONS_DIR}: ${error.message}`, 'ERROR');
    throw error;
  }
}

// --- Main Execution ---
async function runMigrations() {
  log('Starting production database migration...');

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    log('Missing one or more required environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME', 'ERROR');
    process.exit(1);
  }

  const pool = new Pool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: Number(DB_PORT),
    ssl: {
      rejectUnauthorized: false, // Required for Supabase
    },
  });

  const client = await pool.connect();
  log('Successfully connected to the database.');

  try {
    const migrationFiles = await getMigrationFiles();

    await client.query('BEGIN');
    log('Transaction started.');

    for (const file of migrationFiles) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      log(`Executing migration: ${file}...`);
      const sql = await fs.readFile(filePath, 'utf-8');
      await client.query(sql);
      log(` -> ${file} executed successfully.`);
    }

    await client.query('COMMIT');
    log('Transaction committed.');
    log('✅ All migrations completed successfully!', 'SUCCESS');

  } catch (error) {
    await client.query('ROLLBACK');
    log('Transaction rolled back due to an error.', 'ERROR');
    log(`Error during migration: ${error.message}`, 'ERROR');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    log('Database connection closed.');
  }
}

runMigrations();
