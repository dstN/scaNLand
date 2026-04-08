import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/scanland.db');

  // Ensure the data directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });
  return db;
}

export { schema };
