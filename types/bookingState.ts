import type { AppLocale } from "@/i18n/routing";

export const BOOKING_STEPS = [
  "guests",
  "sameCourse",
  "treatment",
  "duration",
  "guestTreatments",
  "date",
  "time",
  "details",
  "review",
  "submit",
  "confirmation",
] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];

export interface BookingDetailsDraft {
  name: string;
  phone: string;
  email: string;
  preferredLanguage: AppLocale;
  specialRequest: string;
}

/**
 * In-progress booking choices are kept in localStorage; contact details
 * stay in memory and a tab-scoped session that expires after 30 minutes while
 * the customer moves through the wizard. Nothing here is submitted to the
 * server as a reservation request until the "submit" step succeeds (see
 * components/booking/steps/SubmitStep.tsx) — no payment is collected;
 * submitting only creates a PENDING request pending admin review.
 */
export interface BookingDraft {
  step: BookingStep;
  guestCount: number | null;
  /** null = not yet answered. Meaningless (never asked) when guestCount is 1. */
  sameCourse: boolean | null;
  /** Guest 1's treatment — the anchor/shared choice when sameCourse is true, unchanged from before this field existed. */
  serviceId: string | null;
  serviceOptionId: string | null;
  /**
   * Guests 2..guestCount's own treatment, in guest order — populated only
   * when sameCourse is false. Length is guestCount - 1 once guest count is
   * known; each entry is null until that guest has chosen. See
   * lib/booking/guestSelection.ts for how this combines with serviceOptionId
   * into one per-guest list.
   */
  otherGuestServiceOptionIds: (string | null)[];
  date: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:mm"
  details: BookingDetailsDraft | null;
  reservationNumber: string | null;
}

export const emptyBookingDraft: BookingDraft = {
  step: "guests",
  guestCount: null,
  sameCourse: null,
  serviceId: null,
  serviceOptionId: null,
  otherGuestServiceOptionIds: [],
  date: null,
  time: null,
  details: null,
  reservationNumber: null,
};
