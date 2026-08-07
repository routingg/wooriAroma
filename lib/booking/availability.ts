import { fromMinutes, rangesOverlap, toMinutes, type TimeRange } from "./time";
import type { TimeSlot } from "@/types/booking";

/** Minutes required to set up before, and reset after, every treatment. */
export const PREP_MINUTES = 60;
export const CLEANUP_MINUTES = 60;

/** Spa operating window. Prep must start no earlier than open, cleanup must finish by close. */
export const BUSINESS_OPEN = "10:00";
export const BUSINESS_CLOSE = "23:00";

/** Candidate treatment start times are offered on this grid. */
const SLOT_STEP_MINUTES = 30;

/**
 * A confirmed group's blocked window: this is what actually occupies
 * the spa, since only one group may be present at a time.
 */
export type BlockedWindow = TimeRange;

/**
 * Given the customer-facing treatment window, returns the full
 * blocked window including prep and cleanup buffers.
 *
 * Example: Aroma Oil 16:00–17:30 → blocked 15:00–18:30.
 */
export function calculateBlockedTime(serviceStart: string, serviceEnd: string): BlockedWindow {
  return {
    start: fromMinutes(toMinutes(serviceStart) - PREP_MINUTES),
    end: fromMinutes(toMinutes(serviceEnd) + CLEANUP_MINUTES),
  };
}

/**
 * True if a candidate blocked window would overlap any existing
 * booking's blocked window on the same day. Since Woori Aroma only
 * ever hosts one group at a time, any overlap is a conflict.
 */
export function checkBookingConflict(
  candidate: BlockedWindow,
  existingBlockedWindows: BlockedWindow[],
): boolean {
  return existingBlockedWindows.some((existing) => rangesOverlap(candidate, existing));
}

/**
 * Produces every bookable start time for a treatment of the given
 * duration on a single day, honoring business hours, the prep/cleanup
 * buffers, and any already-booked groups.
 *
 * `existingBlockedWindows` is expected to come from the reservation
 * backend eventually; for this MVP it is sourced from mock data (see
 * lib/booking/mockData.ts).
 */
export function generateAvailableSlots(
  durationMinutes: number,
  existingBlockedWindows: BlockedWindow[],
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const openMinutes = toMinutes(BUSINESS_OPEN);
  const closeMinutes = toMinutes(BUSINESS_CLOSE);

  for (
    let startMinutes = openMinutes;
    startMinutes + durationMinutes <= closeMinutes;
    startMinutes += SLOT_STEP_MINUTES
  ) {
    const serviceStart = fromMinutes(startMinutes);
    const serviceEnd = fromMinutes(startMinutes + durationMinutes);
    const blocked = calculateBlockedTime(serviceStart, serviceEnd);

    if (toMinutes(blocked.start) < openMinutes || toMinutes(blocked.end) > closeMinutes) {
      continue;
    }

    slots.push({
      time: serviceStart,
      available: !checkBookingConflict(blocked, existingBlockedWindows),
    });
  }

  return slots;
}
