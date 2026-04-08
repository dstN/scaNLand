import { getDb, schema } from '../db/index.js';
import argon2 from 'argon2';
import { sql } from 'drizzle-orm';

async function createAdmin() {
  const db = getDb();

  // Ensure tables exist (auto-migrate)
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'moderator',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_code TEXT NOT NULL,
    product_image_url TEXT,
    brand_name TEXT,
    product_name TEXT,
    company_name TEXT,
    address TEXT,
    country TEXT,
    region TEXT,
    category TEXT,
    ocr_confidence REAL,
    device_fingerprint TEXT,
    moderation_status TEXT NOT NULL DEFAULT 'pending',
    moderation_queue TEXT NOT NULL DEFAULT 'pending',
    suspicion_reasons TEXT DEFAULT '[]',
    reviewed_by INTEGER,
    reviewed_at TEXT,
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_approval_code ON submissions(approval_code)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_moderation_status ON submissions(moderation_status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_moderation_queue ON submissions(moderation_queue)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_created_at ON submissions(created_at)`);

  db.run(sql`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    submission_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const email = 'admin@scanland.app';
  const password = 'password123';

  console.log('Generating password hash...');
  const passwordHash = await argon2.hash(password);

  console.log(`Inserting admin user: ${email}...`);
  db.insert(schema.users).values({
    email,
    passwordHash,
    role: 'admin',
  }).onConflictDoUpdate({
    target: schema.users.email,
    set: { passwordHash, role: 'admin' },
  }).run();

  console.log('');
  console.log('✓ Database tables created');
  console.log('✓ Admin user seeded');
  console.log('');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('');
  process.exit(0);
}

createAdmin().catch(console.error);
