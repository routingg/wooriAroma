import { DatabaseSync } from "node:sqlite";

/**
 * A minimal D1Database-shaped wrapper around node:sqlite, used only in
 * tests (see dbTestUtils.ts, which mocks @opennextjs/cloudflare's
 * getCloudflareContext() to hand this out as env.DB). D1 *is* SQLite under
 * the hood and every statement this codebase runs (parameterized SQL,
 * NOT EXISTS subqueries, ON CONFLICT ... RETURNING, correlated UPDATE
 * WHERE) is standard SQLite behavior node:sqlite reproduces exactly — the
 * Interactive transactions are not exposed to repository code. batch()
 * models D1's sequential, all-or-nothing batch API using a SQLite transaction.
 */

interface FakeD1Result<T> {
  results: T[];
  success: true;
  meta: {
    changes: number;
    last_row_id: number;
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

class FakeD1PreparedStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly args: unknown[] = [],
  ) {}

  bind(...args: unknown[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.db, this.sql, args);
  }

  async first<T = unknown>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...(this.args as never[]));
    return (row as T | undefined) ?? null;
  }

  async all<T = unknown>(): Promise<FakeD1Result<T>> {
    const rows = this.db.prepare(this.sql).all(...(this.args as never[])) as T[];
    return {
      results: rows,
      success: true,
      meta: { changes: 0, last_row_id: 0, duration: 0, rows_read: rows.length, rows_written: 0 },
    };
  }

  async run<T = unknown>(): Promise<FakeD1Result<T>> {
    const info = this.db.prepare(this.sql).run(...(this.args as never[]));
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
        duration: 0,
        rows_read: 0,
        rows_written: Number(info.changes),
      },
    };
  }
}

export class FakeD1Database {
  private readonly db: DatabaseSync;
  private batchTail: Promise<unknown> = Promise.resolve();

  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  prepare(sql: string): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.db, sql);
  }

  async batch(statements: FakeD1PreparedStatement[]): Promise<FakeD1Result<unknown>[]> {
    const operation = this.batchTail.then(async () => {
      this.db.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        this.db.exec("COMMIT");
        return results;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    });
    this.batchTail = operation.catch(() => {});
    return operation;
  }

  /** Runs a full migration file's text (possibly multiple ;-separated statements) directly. */
  applyMigrationScript(sql: string): void {
    this.db.exec("BEGIN");
    try {
      this.db.exec(sql);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
