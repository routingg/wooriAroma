import { getService, getServiceOption } from "@/data/services";
import { formatTimeLabel } from "@/lib/booking/time";
import { SEOUL_TIME_ZONE } from "@/lib/booking/timezone";
import { SERVICE_NAMES_KO } from "@/lib/admin/labels";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

export interface ReservationDeletionSummary {
  customerName: string;
  dateTimeLabel: string;
  serviceLabel: string;
  guestCount: number;
}

/**
 * Small, display-only summary for the 삭제 확인창 (AGENTS.md §6) — a single
 * shared resolver so the list page and detail page can never show
 * different information for the same reservation. Any field that can't be
 * resolved is left as an empty string; DeleteReservationButton omits that
 * row entirely rather than rendering "undefined"/"null".
 */
export async function resolveReservationDeletionSummary(
  reservation: ReservationRecord,
): Promise<ReservationDeletionSummary> {
  const customer = await getCustomerById(reservation.customerId);
  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;

  const dateLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL_TIME_ZONE, dateStyle: "long" }).format(
    new Date(`${reservation.dateKey}T00:00:00+09:00`),
  );
  const timeLabel = formatTimeLabel(reservation.serviceStart, "ko");

  return {
    customerName: customer?.name ?? "",
    dateTimeLabel: `${dateLabel} ${timeLabel}`,
    serviceLabel: service ? `${SERVICE_NAMES_KO[service.id]} · ${reservation.durationMinutes}분` : "",
    guestCount: reservation.guestCount,
  };
}
