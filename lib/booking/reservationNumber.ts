import type { DatabaseSync } from "node:sqlite";

/**
 * Atomically issues the next sequence number for `dateKey` and formats it as
 * "WA-YYYYMMDD-NNN" (e.g. "WA-20260812-001"). Must be called from inside an
 * existing write transaction (see lib/db/transaction.ts) — the
 * INSERT ... ON CONFLICT ... RETURNING is what makes concurrent callers for
 * the same date safe, but only within one atomic unit that also inserts the
 * reservation row, so a crash between the two can never happen.
 */
export function nextReservationNumber(db: DatabaseSync, dateKey: string): string {
  const compactDate = dateKey.replaceAll("-", "");

  const row = db
    .prepare(
      `INSERT INTO reservation_counters (date_key, next_seq) VALUES (?, 1)
       ON CONFLICT(date_key) DO UPDATE SET next_seq = next_seq + 1
       RETURNING next_seq;`,
    )
    .get(dateKey) as { next_seq: number };

  const sequence = String(row.next_seq).padStart(3, "0");
  return `WA-${compactDate}-${sequence}`;
}
