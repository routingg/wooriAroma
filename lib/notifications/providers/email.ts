import { logFailure, notConfigured } from "../devLog";
import { getSketchmapAttachment } from "../mapAttachment";
import { resolveEmailRecipient } from "../recipientPolicy";
import { renderReservationEmail, resolveIncludeMap, type RenderEmailOptions } from "../templates/email";
import type { EmailProvider, NotificationResult, ReservationNotificationPayload } from "../types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const PROVIDER = "resend";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Resend REST provider — plain fetch, no SDK (a single POST doesn't
 * justify the dependency). Server-only: RESEND_API_KEY must never reach
 * client code, which is guaranteed here since every caller of this module
 * runs from lib/notifications/service.ts or an admin Server Action, never
 * directly from a Route Handler exposed to the client.
 *
 * Every outbound EMAIL send — automatic on booking confirmation or an
 * admin's manual "Send Confirmation" — funnels through this one function,
 * which is why the sandbox/production recipient policy
 * (lib/notifications/recipientPolicy.ts) lives here rather than in every
 * caller: there is exactly one place that ever calls Resend's API.
 */
export const resendEmailProvider: EmailProvider = {
  async send(payload: ReservationNotificationPayload, options: RenderEmailOptions = {}): Promise<NotificationResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return notConfigured(PROVIDER, payload.event, payload.customerEmail);
    }

    const { recipient, redirected, skippedReason } = resolveEmailRecipient(payload.customerEmail);
    if (!recipient) {
      return { status: "SKIPPED", provider: PROVIDER, reason: skippedReason ?? "no_recipient" };
    }

    try {
      const { subject, html, text } = await renderReservationEmail(payload, options);
      const sketchmap = resolveIncludeMap(payload, options) ? getSketchmapAttachment() : null;

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
          body: JSON.stringify({
            from,
            to: recipient,
            subject,
            html,
            text,
            attachments: sketchmap ? [sketchmap] : undefined,
          }),
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
      return { status: "SENT", provider: PROVIDER, providerMessageId: data.id, redirected };
    } catch (error) {
      logFailure(PROVIDER, payload.event, payload.customerEmail, error);
      return { status: "FAILED", provider: PROVIDER, reason: error instanceof Error ? error.message : String(error) };
    }
  },
};
