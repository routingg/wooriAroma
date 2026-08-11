import type { DatabaseSync } from "node:sqlite";

const MAX_BUSY_RETRIES = 5;

function isBusyError(error: unknown): boolean {
  return error instanceof Error && /SQLITE_BUSY|database is locked/i.test(error.message);
}

/**
 * Runs `fn` inside a BEGIN IMMEDIATE / COMMIT block, rolling back on any
 * throw. `fn` must be synchronous (node:sqlite's API is synchronous) so no
 * other request can interleave mid-transaction within this process; across
 * processes, SQLite's write lock plus PRAGMA busy_timeout serializes access,
 * and a small retry here absorbs the rare case where that timeout is still
 * exceeded. This is the sole mechanism preventing double bookings — see
 * lib/repositories/reservationRepository.ts's createHold/confirmReservation.
 */
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  let attempt = 0;
  for (;;) {
    try {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) {
      attempt += 1;
      if (isBusyError(error) && attempt < MAX_BUSY_RETRIES) {
        continue;
      }
      throw error;
    }
  }
}
