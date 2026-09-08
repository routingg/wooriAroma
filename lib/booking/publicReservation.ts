import type { AppLocale } from "@/i18n/routing";
import type { ReservationRecord, ReservationStatus } from "@/lib/repositories/reservationRepository";
import { getCustomerById } from "@/lib/repositories/customerRepository";

/**
 * Minimal reservation response after the caller has checked access.
 * Omits phone/email. GET lookups require the random hold capability;
 * submission already requires that same capability. This serializer does
 * not itself authorize a caller and must never be used for number-only lookup.
 */
export interface PublicReservation {
  reservationNumber: string;
  status: ReservationStatus;
  dateKey: string;
  serviceStart: string;
  serviceEnd: string;
  guestCount: number;
  serviceOptionId: string;
  pricePerPerson: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  locale: AppLocale;
  customerName: string;
  createdAt: string;
}

export async function toPublicReservation(reservation: ReservationRecord): Promise<PublicReservation> {
  const customer = await getCustomerById(reservation.customerId);
  return {
    reservationNumber: reservation.reservationNumber,
    status: reservation.status,
    dateKey: reservation.dateKey,
    serviceStart: reservation.serviceStart,
    serviceEnd: reservation.serviceEnd,
    guestCount: reservation.guestCount,
    serviceOptionId: reservation.serviceOptionId,
    pricePerPerson: reservation.pricePerPerson,
    totalAmount: reservation.totalAmount,
    depositAmount: reservation.depositAmount,
    remainingAmount: reservation.remainingAmount,
    locale: reservation.locale,
    customerName: customer?.name ?? "",
    createdAt: reservation.createdAt,
  };
}
