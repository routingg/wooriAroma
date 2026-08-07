import type { BookingConfirmationPayload, NotificationResult, NotificationService } from "./types";

/**
 * Development/fallback implementation: logs what *would* have been
 * sent and reports success, without contacting any real provider.
 * Active whenever no real provider is configured — see
 * lib/notifications/index.ts for how a real one would be selected.
 */
export const mockNotificationService: NotificationService = {
  async sendBookingConfirmationEmail(payload: BookingConfirmationPayload): Promise<NotificationResult> {
    console.info(
      `[notifications] (mock) confirmation email → ${payload.customerEmail} for ${payload.reservationNumber} — not actually sent, no email provider configured`,
    );
    return { success: true };
  },

  async sendBookingSms(payload: BookingConfirmationPayload): Promise<NotificationResult> {
    console.info(
      `[notifications] (mock) booking SMS/WhatsApp → ${payload.customerPhone} for ${payload.reservationNumber} — not actually sent, no SMS/WhatsApp provider configured`,
    );
    return { success: true };
  },

  async sendAdminNotification(payload: BookingConfirmationPayload): Promise<NotificationResult> {
    console.info(`[notifications] (mock) admin alert for new reservation ${payload.reservationNumber}`);
    return { success: true };
  },
};
