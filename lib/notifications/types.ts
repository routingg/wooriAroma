import type { AppLocale } from "@/i18n/routing";

/**
 * Everything a notification (email, SMS, admin alert) needs to
 * describe a confirmed reservation. Deliberately flat and provider-
 * agnostic — it's built once from booking state and handed to
 * whichever channels are wired up.
 */
export interface BookingConfirmationPayload {
  reservationNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Language to write the message in — the customer's preferred *communication* language, not the site UI locale. */
  preferredLanguage: AppLocale;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  guestCount: number;
  treatmentName: string;
  durationMinutes: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
}

export interface NotificationResult {
  success: boolean;
  /** Present when success is false — never thrown, always returned. */
  error?: string;
}

/**
 * One channel Woori Aroma can notify a booking through. Each method
 * must resolve, never reject/throw — a delivery failure is data
 * (NotificationResult), not an exception, so it can never propagate
 * up and endanger the reservation that triggered it.
 */
export interface NotificationService {
  sendBookingConfirmationEmail(payload: BookingConfirmationPayload): Promise<NotificationResult>;
  sendBookingSms(payload: BookingConfirmationPayload): Promise<NotificationResult>;
  sendAdminNotification(payload: BookingConfirmationPayload): Promise<NotificationResult>;
}
