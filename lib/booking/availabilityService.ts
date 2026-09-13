import type { TimeSlot } from "@/types/booking";
import { generateAvailableSlots } from "./availability";
import { getSeoulNow } from "./timezone";
import { getActiveBlockedWindows } from "@/lib/repositories/reservationRepository";
import { getAdminBlockedWindows } from "@/lib/repositories/blockedTimeRepository";
import { getBookingSettings } from "@/lib/repositories/bookingSettingsRepository";

/**
 * Server-authoritative slot list for `dateKey`: the pure grid/prep/cleanup
 * math from availability.ts, fed with real blocked windows from the
 * database (active reservations + admin manual blocks) and the admin's
 * current prep/cleanup buffer setting, instead of mock data. This is what
 * GET /api/availability calls — never compute this in the browser for a
 * real booking decision.
 */
export async function getAvailableSlotsForDate(dateKey: string, durationMinutes: number): Promise<TimeSlot[]> {
  const [active, admin, settings] = await Promise.all([
    getActiveBlockedWindows(dateKey),
    getAdminBlockedWindows(dateKey),
    getBookingSettings(),
  ]);
  return generateAvailableSlots(dateKey, durationMinutes, active, admin, getSeoulNow(), settings);
}
