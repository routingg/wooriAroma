import { normalizePhone } from "../phone";
import { logFailure, notConfigured } from "../devLog";
import { buildWhatsAppBodyParameters, metaLanguageCode, templateNameForEvent } from "../templates/whatsapp";
import type { NotificationResult, ReservationNotificationPayload, WhatsAppProvider } from "../types";

const PROVIDER = "meta-whatsapp";
const REQUEST_TIMEOUT_MS = 10_000;
const GRAPH_API_VERSION = "v21.0";

/**
 * Meta WhatsApp Cloud API directly (no Twilio dependency) — plain fetch,
 * one POST. Only ever called for customers who opted in (enforced one layer
 * up in lib/notifications/policy.ts), and only ever sends pre-approved
 * template messages: Meta rejects arbitrary free-form outbound messages
 * outside a customer-initiated 24h session window, so a template is the
 * only reliable way to deliver a reservation notification.
 */
export const whatsAppProvider: WhatsAppProvider = {
  async send(payload: ReservationNotificationPayload): Promise<NotificationResult> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = templateNameForEvent(payload.event);
    if (!accessToken || !phoneNumberId || !templateName) {
      return notConfigured(PROVIDER, payload.event, payload.customerPhone);
    }

    const normalized = normalizePhone(payload.customerPhone);
    if (!normalized) {
      return { status: "SKIPPED", provider: PROVIDER, reason: "invalid_phone_number" };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: normalized.e164.replace("+", ""),
            type: "template",
            template: {
              name: templateName,
              language: { code: metaLanguageCode(payload.preferredLanguage) },
              components: [
                {
                  type: "body",
                  parameters: buildWhatsAppBodyParameters(payload).map((text) => ({ type: "text", text })),
                },
              ],
            },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const body = (await response.json().catch(() => ({}))) as {
        messages?: { id?: string }[];
        error?: { message?: string };
      };

      if (!response.ok || body.error) {
        throw new Error(`WhatsApp Cloud API ${response.status}: ${body.error?.message ?? "unknown error"}`);
      }

      return { status: "SENT", provider: PROVIDER, providerMessageId: body.messages?.[0]?.id };
    } catch (error) {
      logFailure(PROVIDER, payload.event, payload.customerPhone, error);
      return { status: "FAILED", provider: PROVIDER, reason: error instanceof Error ? error.message : String(error) };
    }
  },
};
