import { recordAttempt, wasAlreadySent } from "@/lib/repositories/notificationRepository";
import { resendEmailProvider } from "./providers/email";
import type { NotificationResult, ReservationNotificationPayload } from "./types";

/**
 * The one place that knows about the notification channel. Reservation
 * domain code never imports a provider directly — it calls one of the four
 * methods below with a fully-built payload and forgets about it
 * (fire-and-forget; see lib/booking/reservationNotifications.ts). Every
 * attempt is logged through notificationRepository, guarded by the same
 * (reservationId, channel, event) idempotency key the reminder job relies on.
 */
export const notificationService = {
  sendReservationRequestReceived: (payload: ReservationNotificationPayload) => dispatch(payload),
  sendReservationConfirmation: (payload: ReservationNotificationPayload) => dispatch(payload),
  sendReservationUpdated: (payload: ReservationNotificationPayload) => dispatch(payload),
  sendReservationCancelled: (payload: ReservationNotificationPayload) => dispatch(payload),
  sendReservationReminder: (payload: ReservationNotificationPayload) => dispatch(payload),
};

async function dispatch(payload: ReservationNotificationPayload): Promise<void> {
  if (!payload.customerEmail) return;
  await sendOnce(payload, () => resendEmailProvider.send(payload));
}

async function sendOnce(
  payload: ReservationNotificationPayload,
  send: () => Promise<NotificationResult>,
): Promise<void> {
  if (await wasAlreadySent(payload.reservationId, "EMAIL", payload.event)) return;

  try {
    const result = await send();
    await recordAttempt({
      reservationId: payload.reservationId,
      channel: "EMAIL",
      event: payload.event,
      provider: result.provider,
      recipient: payload.customerEmail,
      status: result.status,
      providerMessageId: result.providerMessageId,
      error: result.reason,
    });
  } catch (error) {
    // Providers are contractually never supposed to throw, but a channel's
    // delivery failure — of all things — must never be what breaks a
    // reservation, so this backstop logs and swallows regardless.
    await recordAttempt({
      reservationId: payload.reservationId,
      channel: "EMAIL",
      event: payload.event,
      provider: "unknown",
      recipient: payload.customerEmail,
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
