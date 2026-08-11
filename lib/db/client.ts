import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { migrations } from "./migrations";

/**
 * SQLite via Node's built-in `node:sqlite` (stable enough as of Node 22.5+,
 * still flagged experimental — see package.json's `engines.node`). Chosen
 * over Cloudflare D1 / Supabase to unblock Phase 2 without a paid account or
 * a native build toolchain (better-sqlite3 needs one; node:sqlite ships with
 * Node itself). All access goes through plain parameterized SQL behind the
 * repositories in lib/repositories/, so swapping to Postgres (Supabase) or
 * D1 later is a driver change, not a rewrite. See proposal.md for the
 * decision record this resolves.
 */

const DEFAULT_DB_PATH = join(process.cwd(), ".data", "woori-aroma.sqlite3");

let dbInstance: DatabaseSync | null = null;

function resolveDbPath(): string {
  const configured = process.env.DATABASE_FILE?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_DB_PATH;
}

function applyMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[];
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const path = resolveDbPath();
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  // Let concurrent writers (multiple server processes) wait briefly for the
  // write lock instead of failing immediately — see lib/db/transaction.ts
  // for the application-level retry on top of this.
  db.exec("PRAGMA busy_timeout = 5000;");
  applyMigrations(db);

  dbInstance = db;
  return dbInstance;
}

/** Test-only: forces a fresh database (typically ":memory:") on next getDb(). */
export function resetDbForTests(): void {
  dbInstance?.close();
  dbInstance = null;
}
