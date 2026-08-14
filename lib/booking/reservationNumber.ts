/**
 * Atomically issues the next sequence number for `dateKey` and formats it as
 * "WA-YYYYMMDD-NNN" (e.g. "WA-20260812-001"). The INSERT ... ON CONFLICT ...
 * RETURNING is itself a single atomic D1 statement, so concurrent callers
 * for the same date are safe on their own — but D1 has no interactive
 * transactions, so this call is no longer guaranteed to commit atomically
 * with the reservation row it's for (see reservationRepository.createHold).
 * If the reservation insert that follows loses the availability race, the
 * sequence number issued here is simply not used, producing an occasional
 * gap (e.g. WA-20260812-002 never existing). That's an accepted cosmetic
 * side effect, not a booking-integrity issue.
 */
export async function nextReservationNumber(db: D1Database, dateKey: string): Promise<string> {
  const compactDate = dateKey.replaceAll("-", "");

  const row = await db
    .prepare(
      `INSERT INTO reservation_counters (date_key, next_seq) VALUES (?, 1)
       ON CONFLICT(date_key) DO UPDATE SET next_seq = next_seq + 1
       RETURNING next_seq;`,
    )
    .bind(dateKey)
    .first<{ next_seq: number }>();

  const sequence = String(row!.next_seq).padStart(3, "0");
  return `WA-${compactDate}-${sequence}`;
}
