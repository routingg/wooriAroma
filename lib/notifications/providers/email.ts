import { logFailure, notConfigured } from "../devLog";
import { renderReservationEmail } from "../templates/email";
import type { EmailProvider, NotificationResult, ReservationNotificationPayload } from "../types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const PROVIDER = "resend";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Resend REST provider — plain fetch, no SDK (a single POST doesn't
 * justify the dependency). Server-only: RESEND_API_KEY must never reach
 * client code, which is guaranteed here since every caller of this module
 * runs from lib/notifications/service.ts, itself only ever invoked from
 * Server Actions / Route Handlers.
 */
export const resendEmailProvider: EmailProvider = {
  async send(payload: ReservationNotificationPayload): Promise<NotificationResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return notConfigured(PROVIDER, payload.event, payload.customerEmail);
    }

    try {
      const { subject, html, text } = await renderReservationEmail(payload);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: payload.customerEmail, subject, html, text }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Resend responded ${response.status}: ${body.slice(0, 300)}`);
      }

      const data = (await response.json()) as { id?: string };
      return { status: "SENT", provider: PROVIDER, providerMessageId: data.id };
    } catch (error) {
      logFailure(PROVIDER, payload.event, payload.customerEmail, error);
      return { status: "FAILED", provider: PROVIDER, reason: error instanceof Error ? error.message : String(error) };
    }
  },
};
