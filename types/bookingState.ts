import type { AppLocale } from "@/i18n/routing";

export const BOOKING_STEPS = [
  "guests",
  "treatment",
  "duration",
  "date",
  "time",
  "details",
  "review",
  "payment",
  "confirmation",
] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];

export interface BookingDetailsDraft {
  name: string;
  phone: string;
  email: string;
  country: string;
  preferredLanguage: AppLocale;
  specialRequest: string;
}

/**
 * In-progress booking selections, kept in memory + localStorage while
 * the customer moves through the wizard. Nothing here is submitted
 * until the mock payment succeeds (see lib/payment).
 */
export interface BookingDraft {
  step: BookingStep;
  guestCount: number | null;
  serviceId: string | null;
  serviceOptionId: string | null;
  date: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:mm"
  details: BookingDetailsDraft | null;
  reservationNumber: string | null;
  depositTransactionId: string | null;
}

export const emptyBookingDraft: BookingDraft = {
  step: "guests",
  guestCount: null,
  serviceId: null,
  serviceOptionId: null,
  date: null,
  time: null,
  details: null,
  reservationNumber: null,
  depositTransactionId: null,
};
