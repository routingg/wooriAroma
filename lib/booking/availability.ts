import { fromMinutes, rangesOverlap, toMinutes, type TimeRange } from "./time";
import { getSeoulNow, type SeoulNow } from "./timezone";
import type { TimeSlot } from "@/types/booking";

/**
 * Historical hardcoded minutes to set up before, and reset after, every
 * treatment — now admin-configurable (lib/repositories/bookingSettingsRepository.ts).
 * These remain only as the fallback/default for callers that don't pass an
 * explicit buffer (mainly tests).
 */
export const DEFAULT_PREP_MINUTES = 60;
export const DEFAULT_CLEANUP_MINUTES = 60;

/**
 * Fixed customer-facing start-time grid. 21:00 is the latest
 * selectable START time, not a closing time — a treatment's
 * prep/cleanup buffer may extend past it. This is a business policy,
 * not a physical constraint, so it's kept centralized here for the
 * future admin dashboard to override.
 */
export const SLOT_GRID_START = "10:00";
export const SLOT_GRID_LATEST_START = "21:00";
const SLOT_STEP_MINUTES = 30;

/**
 * A confirmed group's blocked window: this is what actually occupies
 * the spa, since only one group may be present at a time.
 */
export type BlockedWindow = TimeRange;

/** Every start time on the fixed grid, independent of date or availability. */
export function generateBaseTimeSlots(): string[] {
  const slots: string[] = [];
  for (
    let minutes = toMinutes(SLOT_GRID_START);
    minutes <= toMinutes(SLOT_GRID_LATEST_START);
    minutes += SLOT_STEP_MINUTES
  ) {
    slots.push(fromMinutes(minutes));
  }
  return slots;
}

/**
 * Given the customer-facing treatment window, returns the full
 * blocked window including prep and cleanup buffers.
 *
 * Example (default 60/60 buffer): Aroma Oil 16:00–17:30 → blocked 15:00–18:30.
 */
export function calculateBlockedTime(
  serviceStart: string,
  serviceEnd: string,
  prepMinutes: number = DEFAULT_PREP_MINUTES,
  cleanupMinutes: number = DEFAULT_CLEANUP_MINUTES,
): BlockedWindow {
  return {
    start: fromMinutes(toMinutes(serviceStart) - prepMinutes),
    end: fromMinutes(toMinutes(serviceEnd) + cleanupMinutes),
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
 * True if `time` on `dateKey` has already passed, in Asia/Seoul.
 * A date before today is entirely in the past regardless of the time
 * requested; a date after today is never in the past regardless of
 * today's clock — today's current time only matters when the
 * selected date IS today.
 */
export function isSlotInPast(dateKey: string, time: string, now: SeoulNow = getSeoulNow()): boolean {
  if (dateKey !== now.dateKey) return dateKey < now.dateKey;
  return toMinutes(time) <= now.minutes;
}

/**
 * Produces every slot on the fixed start-time grid for a treatment of
 * the given duration on `dateKey`, marking each as available/
 * unavailable based on: whether it has already passed (Asia/Seoul),
 * whether its prep/cleanup-inclusive blocked window conflicts with an
 * already-booked group, and whether its raw treatment window (no
 * prep/cleanup buffer) falls inside an admin manual block.
 *
 * Admin blocks (closures, maintenance) are compared against the exact
 * customer-facing treatment window, not the buffered one: a closure
 * only takes the clock time the admin entered, it doesn't additionally
 * swallow the neighboring prep/cleanup slots the way another booking
 * would.
 *
 * `reservationBlockedWindows` and `adminBlockedWindows` come from the
 * database — see lib/booking/availabilityService.ts, which wires this
 * pure function up to lib/repositories/reservationRepository.ts and
 * blockedTimeRepository.ts. `buffer` is the admin-configurable prep/cleanup
 * setting (lib/repositories/bookingSettingsRepository.ts); it defaults to
 * the historical 60/60 minutes for callers (mainly tests) that don't pass one.
 */
export function generateAvailableSlots(
  dateKey: string,
  durationMinutes: number,
  reservationBlockedWindows: BlockedWindow[],
  adminBlockedWindows: BlockedWindow[] = [],
  now: SeoulNow = getSeoulNow(),
  buffer: { prepMinutes: number; cleanupMinutes: number } = {
    prepMinutes: DEFAULT_PREP_MINUTES,
    cleanupMinutes: DEFAULT_CLEANUP_MINUTES,
  },
): TimeSlot[] {
  return generateBaseTimeSlots().map((time) => {
    const serviceEnd = fromMinutes(toMinutes(time) + durationMinutes);
    const blocked = calculateBlockedTime(time, serviceEnd, buffer.prepMinutes, buffer.cleanupMinutes);
    const past = isSlotInPast(dateKey, time, now);
    const reservationConflict = checkBookingConflict(blocked, reservationBlockedWindows);
    const adminConflict = checkBookingConflict({ start: time, end: serviceEnd }, adminBlockedWindows);

    return { time, available: !past && !reservationConflict && !adminConflict };
  });
}
