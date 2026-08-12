import { logFailure, notConfigured } from "../devLog";
import { renderTelegramAdminMessage } from "../templates/telegram";
import type { AdminNotificationProvider, NotificationResult, ReservationNotificationPayload } from "../types";

const PROVIDER = "telegram";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Telegram Bot API — plain fetch, single POST, no SDK needed. Store
 * administrator alerts only; never used for customer messaging (see
 * lib/notifications/policy.ts — Telegram isn't a channel resolveChannels
 * ever returns for a customer).
 */
export const telegramAdminProvider: AdminNotificationProvider = {
  async send(payload: ReservationNotificationPayload): Promise<NotificationResult> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!botToken || !chatId) {
      return notConfigured(PROVIDER, payload.event, "admin");
    }

    try {
      const text = renderTelegramAdminMessage(payload);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telegram responded ${response.status}: ${body.slice(0, 300)}`);
      }

      const data = (await response.json()) as { result?: { message_id?: number } };
      return { status: "SENT", provider: PROVIDER, providerMessageId: data.result?.message_id?.toString() };
    } catch (error) {
      logFailure(PROVIDER, payload.event, "admin", error);
      return { status: "FAILED", provider: PROVIDER, reason: error instanceof Error ? error.message : String(error) };
    }
  },
};
