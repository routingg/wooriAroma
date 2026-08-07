import { mockNotificationService } from "./mockNotificationService";
import type { BookingConfirmationPayload, NotificationService } from "./types";

export type { BookingConfirmationPayload, NotificationResult, NotificationService } from "./types";

/**
 * Central lookup for the active notification channel set. Always
 * returns the mock/dev implementation today.
 *
 * IMPORTANT for the real integration later: a transactional email
 * API key (e.g. RESEND_API_KEY) must never run in client code — this
 * booking flow is entirely client components today, so a real
 * EmailProvider implementation has to live behind a server-only
 * entry point (a Next.js Route Handler or Server Action) that this
 * function is swapped to call, not inline in the browser bundle.
 * Branch on an env var here once that route exists, e.g.:
 *
 *   return process.env.RESEND_API_KEY ? resendNotificationService : mockNotificationService;
 *
 * Required environment variables once a real provider is wired up:
 *   RESEND_API_KEY        — email (or equivalent provider's key)
 *   NOTIFICATIONS_SMS_*   — SMS/WhatsApp provider credentials (TBD provider)
 */
export function getNotificationService(): NotificationService {
  return mockNotificationService;
}

/**
 * Fires all reservation-created notifications. Never throws: each
 * channel's promise settles independently, so one failing (or all of
 * them failing) can never invalidate the reservation that already
 * succeeded before this was called. Callers should not await this
 * before navigating the customer to the confirmation screen.
 */
export async function notifyBookingCreated(payload: BookingConfirmationPayload): Promise<void> {
  const service = getNotificationService();

  const results = await Promise.allSettled([
    service.sendBookingConfirmationEmail(payload),
    service.sendBookingSms(payload),
    service.sendAdminNotification(payload),
  ]);

  results.forEach((result, index) => {
    const channel = ["email", "sms", "admin"][index];
    if (result.status === "rejected") {
      console.error(`[notifications] ${channel} delivery threw unexpectedly`, result.reason);
    } else if (!result.value.success) {
      console.error(`[notifications] ${channel} delivery failed`, result.value.error);
    }
  });
}
