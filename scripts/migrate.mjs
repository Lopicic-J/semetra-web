#!/usr/bin/env node
/**
 * Semetra Migration Runner
 *
 * Runs all pending SQL migrations against your Supabase database.
 *
 * Usage:
 *   node scripts/migrate.mjs                    # Run all pending migrations
 *   node scripts/migrate.mjs --status           # Show applied vs pending
 *   node scripts/migrate.mjs --up 074           # Run specific migration
 *   node scripts/migrate.mjs --dry-run          # Show what would run
 *
 * Setup:
 *   Add DATABASE_URL to your .env.local:
 *   DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
 *
 *   Find your DATABASE_URL in: Supabase Dashboard → Settings → Database → Connection string → URI
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

// Load .env.local
function loadEnv() {
  try {
    const envContent = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.+)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  } catch { /* no .env.local */ }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('\x1b[31mFehler: DATABASE_URL nicht gefunden!\x1b[0m');
  console.error('');
  console.error('Füge DATABASE_URL in .env.local hinzu:');
  console.error('DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres');
  console.error('');
  console.error('Findest du unter: Supabase Dashboard → Settings → Database → Connection string → URI');
  process.exit(1);
}

// Dynamic import of pg (installed in semetra-web or globally)
let pg;
try {
  const require = createRequire(import.meta.url);
  pg = require('pg');
} catch {
  console.error('\x1b[31mFehler: pg Modul nicht gefunden!\x1b[0m');
  console.error('Installiere es mit: npm install pg');
  process.exit(1);
}

const { Client } = pg;

// ── Helpers ──
function getMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({
      filename: f,
      version: f.split('_')[0],
      name: f.replace('.sql', ''),
      path: join(MIGRATIONS_DIR, f),
    }));
}

function extractNumber(filename) {
  // Extract the original migration number from the name or timestamp
  const match = filename.match(/(\d{14})_/);
  if (match) {
    const ts = match[1];
    // Our timestamps encode the number: 20260101NNNN00
    const num = parseInt(ts.slice(8, 12));
    return num;
  }
  return 0;
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isStatus = args.includes('--status');
  const upIndex = args.indexOf('--up');
  const targetMigration = upIndex >= 0 ? args[upIndex + 1] : null;

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('\x1b[32m✓ Verbunden mit Datenbank\x1b[0m\n');

    // Ensure tracking table exists
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text NOT NULL PRIMARY KEY,
        statements text[],
        name text
      );
    `);

    // Get applied migrations
    const { rows: applied } = await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version'
    );
    const appliedSet = new Set(applied.map(r => r.version));

    // Get all migration files
    const migrations = getMigrationFiles();

    if (isStatus) {
      console.log('Migration Status:\n');
      for (const m of migrations) {
        const status = appliedSet.has(m.version) ? '\x1b[32m✓ APPLIED\x1b[0m' : '\x1b[33m○ PENDING\x1b[0m';
        const num = extractNumber(m.filename);
        console.log(`  ${status}  ${String(num).padStart(3, '0')} - ${m.name}`);
      }
      const pendingCount = migrations.filter(m => !appliedSet.has(m.version)).length;
      console.log(`\n${migrations.length - pendingCount} applied, ${pendingCount} pending`);
      return;
    }

    // Filter to pending
    let pending = migrations.filter(m => !appliedSet.has(m.version));

    if (targetMigration) {
      pending = pending.filter(m => {
        const num = extractNumber(m.filename);
        return String(num) === targetMigration || String(num).padStart(3, '0') === targetMigration;
      });
      if (pending.length === 0) {
        console.log(`Migration ${targetMigration} nicht gefunden oder bereits applied.`);
        return;
      }
    }

    if (pending.length === 0) {
      console.log('\x1b[32m✓ Alle Migrationen sind aktuell!\x1b[0m');
      return;
    }

    console.log(`${pending.length} ausstehende Migration(en):\n`);
    for (const m of pending) {
      const num = extractNumber(m.filename);
      console.log(`  ○ ${String(num).padStart(3, '0')} - ${m.name}`);
    }
    console.log('');

    if (isDryRun) {
      console.log('\x1b[33m[DRY RUN] Keine Änderungen durchgeführt.\x1b[0m');
      return;
    }

    // Execute migrations
    let success = 0;
    let failed = 0;

    for (const m of pending) {
      const num = extractNumber(m.filename);
      const label = `${String(num).padStart(3, '0')} - ${m.name}`;
      process.stdout.write(`  Ausführen: ${label} ... `);

      try {
        const sql = readFileSync(m.path, 'utf-8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [m.version, m.name]
        );
        await client.query('COMMIT');

        console.log('\x1b[32m✓\x1b[0m');
        success++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('\x1b[31m✗\x1b[0m');
        console.error(`\n\x1b[31mFehler in Migration ${label}:\x1b[0m`);
        console.error(err.message);
        console.error('\nAbbruch. Behebe den Fehler und starte erneut.');
        failed++;
        break; // Stop on first error
      }
    }

    console.log(`\n${success} erfolgreich, ${failed} fehlgeschlagen, ${pending.length - success - failed} übersprungen`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\x1b[31mKritischer Fehler:\x1b[0m', err.message);
  process.exit(1);
});
