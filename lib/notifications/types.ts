import type { AppLocale } from "@/i18n/routing";

/**
 * Notification events the reservation domain can raise. Deliberately a
 * closed union (not a raw string) so adding a new event later — e.g.
 * RESERVATION_DEPOSIT_RECEIVED — is a one-line addition here plus whatever
 * policy/template entries it needs, not a schema change.
 */
export type NotificationEvent =
  | "RESERVATION_CONFIRMED"
  | "RESERVATION_UPDATED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_REMINDER";

export type NotificationChannel = "EMAIL";

/** Never thrown — see each provider's `send()` contract below. */
export type NotificationStatus = "SENT" | "FAILED" | "SKIPPED";

/**
 * Everything the email provider needs to render and deliver a message for
 * one reservation event. Deliberately flat and provider-agnostic — built
 * once from trusted server-side data (reservation + customer + service).
 */
export interface ReservationNotificationPayload {
  event: NotificationEvent;
  reservationId: string;
  reservationNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** The customer's preferred *communication* language, not the site UI locale. */
  preferredLanguage: AppLocale;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  guestCount: number;
  treatmentName: string;
  durationMinutes: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  status: string;
}

export interface NotificationResult {
  status: NotificationStatus;
  /** Concrete provider that handled (or declined) the send, e.g. "resend". */
  provider: string;
  providerMessageId?: string;
  /** Present when status is FAILED or SKIPPED — never thrown, always returned. */
  reason?: string;
  /** EMAIL only: true when sandbox mode redirected delivery away from the real customer address. */
  redirected?: boolean;
}

/**
 * The email channel. `send()` must resolve, never reject — a delivery
 * failure or missing configuration is data (NotificationResult), not an
 * exception, so it can never propagate up and endanger the reservation that
 * triggered it.
 */
export interface EmailProvider {
  /** `includeMap` defaults per-event in the template — see templates/email.ts. */
  send(payload: ReservationNotificationPayload, options?: { includeMap?: boolean }): Promise<NotificationResult>;
}
