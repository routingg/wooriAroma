import { listConfirmedReservationsForDates } from "@/lib/repositories/reservationRepository";
import { notifyReservationReminder } from "./reservationNotifications";
import { getSeoulNow } from "./timezone";

/**
 * "24 hours before" is a window, not an instant — how wide it needs to be
 * depends entirely on how often whatever external scheduler is configured
 * (see app/api/cron/reminders/route.ts) actually calls this. A 3-hour band
 * comfortably tolerates an hourly-or-better cron without ever double-firing
 * for the same reservation: re-entering the window on a later run is a
 * no-op because notificationService's per-channel idempotency guard (same
 * one the reminder repurposes from confirmation emails) skips anything
 * already SENT for (reservationId, channel, RESERVATION_REMINDER).
 */
const REMINDER_TARGET_HOURS = 24;
const REMINDER_WINDOW_HOURS = 3;

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ReminderRunResult {
  checked: number;
  sent: number;
}

/**
 * Finds every CONFIRMED reservation whose start time is ~24h away and fires
 * its reminder. Safe to call as often as the scheduler likes — never relies
 * on being called exactly once. Never throws: a reminder failure for one
 * reservation must not stop the rest of the batch (see
 * lib/notifications — every provider already honors this, this just
 * doesn't add a new way to break that guarantee).
 */
export async function sendDueReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const seoulToday = getSeoulNow(now).dateKey;
  const seoulTomorrow = addDaysToDateKey(seoulToday, 1);
  const candidates = await listConfirmedReservationsForDates([seoulToday, seoulTomorrow]);

  let sent = 0;
  for (const reservation of candidates) {
    // Asia/Seoul is UTC+9 year-round (no DST), so this offset is always correct.
    const startInstant = new Date(`${reservation.dateKey}T${reservation.serviceStart}:00+09:00`);
    const hoursUntilStart = (startInstant.getTime() - now.getTime()) / 3_600_000;
    const inWindow =
      hoursUntilStart <= REMINDER_TARGET_HOURS + REMINDER_WINDOW_HOURS / 2 &&
      hoursUntilStart > REMINDER_TARGET_HOURS - REMINDER_WINDOW_HOURS / 2;
    if (!inWindow) continue;

    try {
      await notifyReservationReminder(reservation);
      sent += 1;
    } catch (error) {
      console.error(`[reminderService] failed to dispatch reminder for ${reservation.reservationNumber}`, error);
    }
  }

  return { checked: candidates.length, sent };
}
