import { recordAttempt, wasAlreadySent } from "@/lib/repositories/notificationRepository";
import { resendEmailProvider } from "./providers/email";
import { koreanMessagingProvider } from "./providers/korean";
import { whatsAppProvider } from "./providers/whatsapp";
import { telegramAdminProvider } from "./providers/telegram";
import { resolveChannels } from "./policy";
import type { NotificationChannel, NotificationResult, ReservationNotificationPayload } from "./types";

/**
 * The one place that knows about every channel. Reservation domain code
 * never imports a provider directly — it calls one of the four methods
 * below with a fully-built payload and forgets about it (fire-and-forget;
 * see lib/booking/reservationNotifications.ts). Every attempt is logged
 * through notificationRepository, guarded by the same
 * (reservationId, channel, event) idempotency key the reminder job relies on.
 */
export const notificationService = {
  sendReservationConfirmation: (payload: ReservationNotificationPayload) => dispatch(payload),
  sendReservationUpdated: (payload: ReservationNotificationPayload) => dispatch(payload),
  sendReservationCancelled: (payload: ReservationNotificationPayload) => dispatch(payload),
  sendReservationReminder: (payload: ReservationNotificationPayload) => dispatch(payload),
};

async function dispatch(payload: ReservationNotificationPayload): Promise<void> {
  const channels = resolveChannels(payload.event, payload);

  const jobs: Promise<void>[] = [];

  if (channels.includes("EMAIL")) {
    jobs.push(sendOnce(payload, "EMAIL", payload.customerEmail, () => resendEmailProvider.send(payload)));
  }
  if (channels.includes("KAKAO")) {
    // Kakao + SMS fallback come back as a pair of results from one call —
    // each is logged under its own channel key (see providers/korean.ts).
    jobs.push(sendKoreanOnce(payload));
  }
  if (channels.includes("WHATSAPP")) {
    jobs.push(sendOnce(payload, "WHATSAPP", payload.customerPhone, () => whatsAppProvider.send(payload)));
  }

  // Admin Telegram alert fires on every event, independent of customer
  // channel eligibility — the admin isn't "the customer for this event".
  jobs.push(sendOnce(payload, "TELEGRAM", "admin", () => telegramAdminProvider.send(payload)));

  await Promise.allSettled(jobs);
}

async function sendOnce(
  payload: ReservationNotificationPayload,
  channel: NotificationChannel,
  recipient: string,
  send: () => Promise<NotificationResult>,
): Promise<void> {
  if (wasAlreadySent(payload.reservationId, channel, payload.event)) return;

  try {
    const result = await send();
    recordAttempt({
      reservationId: payload.reservationId,
      channel,
      event: payload.event,
      provider: result.provider,
      recipient,
      status: result.status,
      providerMessageId: result.providerMessageId,
      error: result.reason,
    });
  } catch (error) {
    // Providers are contractually never supposed to throw, but a channel's
    // delivery failure — of all things — must never be what breaks a
    // reservation, so this backstop logs and swallows regardless.
    recordAttempt({
      reservationId: payload.reservationId,
      channel,
      event: payload.event,
      provider: "unknown",
      recipient,
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sendKoreanOnce(payload: ReservationNotificationPayload): Promise<void> {
  const alreadySentKakao = wasAlreadySent(payload.reservationId, "KAKAO", payload.event);
  const alreadySentSms = wasAlreadySent(payload.reservationId, "SMS", payload.event);
  if (alreadySentKakao && alreadySentSms) return;

  try {
    const results = await koreanMessagingProvider.send(payload);
    for (const result of results) {
      const channel: NotificationChannel = result.provider.includes("sms") ? "SMS" : "KAKAO";
      if (channel === "KAKAO" && alreadySentKakao) continue;
      if (channel === "SMS" && alreadySentSms) continue;
      recordAttempt({
        reservationId: payload.reservationId,
        channel,
        event: payload.event,
        provider: result.provider,
        recipient: payload.customerPhone,
        status: result.status,
        providerMessageId: result.providerMessageId,
        error: result.reason,
      });
    }
  } catch (error) {
    recordAttempt({
      reservationId: payload.reservationId,
      channel: "KAKAO",
      event: payload.event,
      provider: "unknown",
      recipient: payload.customerPhone,
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
