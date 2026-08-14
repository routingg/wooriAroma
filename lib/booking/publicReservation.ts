import type { AppLocale } from "@/i18n/routing";
import type { ReservationRecord, ReservationStatus } from "@/lib/repositories/reservationRepository";
import { getCustomerById } from "@/lib/repositories/customerRepository";

/**
 * What a reservation lookup is allowed to expose over the public API.
 * Deliberately omits the customer's phone/email — only the display name
 * needed to render a confirmation-style view. A future authenticated
 * "manage my booking" flow or the Gemini agent's getReservation tool (see
 * lib/agent/tools.ts) can add an identity check to unlock more.
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
