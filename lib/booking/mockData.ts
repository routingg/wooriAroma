import type { BlockedWindow } from "./availability";

/**
 * Stand-in for the reservation database. Keyed by "YYYY-MM-DD", each
 * entry is a group already holding that time on the calendar.
 *
 * Replace with a real query (e.g. Supabase) once the backend exists —
 * `generateAvailableSlots()` only needs a `BlockedWindow[]`, so no
 * caller has to change.
 */
const mockBookedWindowsByDate: Record<string, BlockedWindow[]> = {};

/** Deterministic mock: every day has one early-afternoon group already booked. */
export function getMockBlockedWindows(date: string): BlockedWindow[] {
  if (mockBookedWindowsByDate[date]) {
    return mockBookedWindowsByDate[date];
  }
  return [{ start: "13:00", end: "15:30" }];
}

let mockReservationSequence = 1;

/** e.g. "WA-20260812-001" */
export function generateReservationNumber(date: string): string {
  const compactDate = date.replaceAll("-", "");
  const sequence = String(mockReservationSequence++).padStart(3, "0");
  return `WA-${compactDate}-${sequence}`;
}
