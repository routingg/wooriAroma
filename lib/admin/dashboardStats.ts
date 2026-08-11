import { listByDate, type ReservationRecord } from "@/lib/repositories/reservationRepository";
import { getSeoulNow } from "@/lib/booking/timezone";
import { toMinutes } from "@/lib/booking/time";

export interface TodayStats {
  confirmedTeams: number;
  totalGuests: number;
  expectedRevenue: number;
  depositsCollected: number;
  nextReservation: ReservationRecord | null;
  todaysReservations: ReservationRecord[];
}

/** Backs the 오늘 현황 dashboard (AGENTS.md §12.1) — CONFIRMED-only, since HOLD isn't a real booking yet. */
export function getTodayStats(): TodayStats {
  const now = getSeoulNow();
  const all = listByDate(now.dateKey);
  const confirmed = all.filter((r) => r.status === "CONFIRMED");

  const nextReservation =
    confirmed
      .filter((r) => toMinutes(r.serviceStart) > now.minutes)
      .sort((a, b) => a.serviceStart.localeCompare(b.serviceStart))[0] ?? null;

  return {
    confirmedTeams: confirmed.length,
    totalGuests: confirmed.reduce((sum, r) => sum + r.guestCount, 0),
    expectedRevenue: confirmed.reduce((sum, r) => sum + r.totalAmount, 0),
    depositsCollected: confirmed.reduce((sum, r) => sum + r.depositAmount, 0),
    nextReservation,
    todaysReservations: [...all].sort((a, b) => a.blockedStart.localeCompare(b.blockedStart)),
  };
}
