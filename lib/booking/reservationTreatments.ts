import { getTranslations } from "next-intl/server";
import { getService, getServiceOption } from "@/data/services";
import { listReservationGuests } from "@/lib/repositories/reservationGuestRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";
import type { AppLocale } from "@/i18n/routing";

export interface ReservationTreatmentDescription {
  isMixed: boolean;
  /** e.g. "Aroma Oil" when every guest chose the same course, or "Guest 1: Aroma Oil · Guest 2: Thai Massage" when they differ. */
  summary: string;
}

/**
 * Customer-facing (locale-aware) per-guest treatment summary — used
 * anywhere a reservation's treatment name is shown to or emailed to a
 * customer (see lib/booking/reservationNotifications.ts,
 * lib/admin/confirmationEmailTemplate.ts). Falls back to the reservation's
 * own service_option_id when no reservation_guests rows exist (reservations
 * created before that table existed), so old data still renders correctly.
 */
export async function describeReservationTreatments(
  reservation: ReservationRecord,
  locale: AppLocale,
): Promise<ReservationTreatmentDescription> {
  const guestRows = await listReservationGuests(reservation.id);
  const rows = guestRows.length > 0
    ? guestRows
    : [{ guestIndex: 1, serviceOptionId: reservation.serviceOptionId, pricePerPerson: reservation.pricePerPerson }];

  const [tServices, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "services" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  const names = rows.map((row) => {
    const option = getServiceOption(row.serviceOptionId);
    const service = option ? getService(option.serviceId) : undefined;
    return service ? tServices(service.nameKey.replace("services.", "")) : row.serviceOptionId;
  });

  const isMixed = new Set(rows.map((row) => row.serviceOptionId)).size > 1;
  const summary = isMixed
    ? names.map((name, index) => `${tCommon("guestLabel", { n: index + 1 })}: ${name}`).join(" · ")
    : (names[0] ?? "");

  return { isMixed, summary };
}
