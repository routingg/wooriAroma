import { getService, getServiceOption } from "@/data/services";
import { SERVICE_NAMES_KO } from "@/lib/admin/labels";
import { listReservationGuests } from "@/lib/repositories/reservationGuestRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

export interface ReservationTreatmentSummaryKo {
  isMixed: boolean;
  /** e.g. "아로마 오일" or "게스트1 아로마 오일 · 게스트2 전통 타이 마사지" */
  label: string;
}

/**
 * Korean admin-dashboard per-guest treatment summary (components/admin/
 * ReservationRow.tsx, app/admin/reservations/[id]/page.tsx,
 * lib/admin/reservationSummary.ts) — always Korean, so it uses the static
 * SERVICE_NAMES_KO map instead of next-intl. Falls back to the
 * reservation's own service_option_id when no reservation_guests rows
 * exist (reservations created before that table existed).
 */
export async function describeReservationTreatmentsKo(reservation: ReservationRecord): Promise<ReservationTreatmentSummaryKo> {
  const guestRows = await listReservationGuests(reservation.id);
  const rows = guestRows.length > 0
    ? guestRows
    : [{ guestIndex: 1, serviceOptionId: reservation.serviceOptionId, pricePerPerson: reservation.pricePerPerson }];

  const names = rows.map((row) => {
    const option = getServiceOption(row.serviceOptionId);
    const service = option ? getService(option.serviceId) : undefined;
    return service ? SERVICE_NAMES_KO[service.id] : row.serviceOptionId;
  });

  const isMixed = new Set(rows.map((row) => row.serviceOptionId)).size > 1;
  const label = isMixed ? names.map((name, index) => `게스트${index + 1} ${name}`).join(" · ") : (names[0] ?? "");

  return { isMixed, label };
}
