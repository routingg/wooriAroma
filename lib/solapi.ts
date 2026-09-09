import { createHmac, randomUUID } from "node:crypto";
import { BUSINESS } from "@/lib/config/business";
import { maskRecipient } from "@/lib/notifications/devLog";
import { recordAttempt, wasAlreadySent } from "@/lib/repositories/notificationRepository";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";

/**
 * Admin-only SMS alert for a newly-submitted reservation, sent via Solapi's
 * REST API (https://api.solapi.com/messages/v4/send) — plain fetch with an
 * HMAC-SHA256 signature, no SDK. The official "solapi" package pulls in
 * `effect` (a large functional-effect runtime) for what is otherwise a
 * single POST; lib/notifications/providers/email.ts made the same call for
 * Resend, and this project deploys to a Cloudflare Workers runtime where an
 * unnecessary heavyweight dependency is a real risk, not just bundle size.
 *
 * This is deliberately independent of lib/notifications/service.ts (the
 * customer-facing EMAIL dispatcher): it always targets the fixed
 * ADMIN_NOTIFICATION_PHONE, never a customer number, and never sandbox/prod
 * redirection — there is only ever one recipient, the admin.
 */

const SOLAPI_ENDPOINT = "https://api.solapi.com/messages/v4/send";
const PROVIDER = "solapi";
const REQUEST_TIMEOUT_MS = 10_000;
// Conventional EUC-KR byte threshold Korean carriers use to route SMS vs LMS.
const SMS_BYTE_LIMIT = 90;
const EVENT = "RESERVATION_REQUEST_RECEIVED" as const;

interface SolapiConfig {
  apiKey: string;
  apiSecret: string;
  senderPhone: string;
  adminPhone: string;
}

/** Strips formatting so env-configured numbers never need to be hand-formatted, e.g. "010-1234-5678" -> "01012345678", "+82 10-1234-5678" -> "01012345678". */
export function normalizeKoreanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("82") && !digits.startsWith("820")) return `0${digits.slice(2)}`;
  return digits;
}

function isValidKoreanPhone(digits: string): boolean {
  return /^0\d{8,10}$/.test(digits);
}

function getSolapiConfig(): SolapiConfig | null {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const senderPhoneRaw = process.env.SOLAPI_SENDER_PHONE;
  const adminPhoneRaw = process.env.ADMIN_NOTIFICATION_PHONE;
  if (!apiKey || !apiSecret || !senderPhoneRaw || !adminPhoneRaw) return null;
  return {
    apiKey,
    apiSecret,
    senderPhone: normalizeKoreanPhone(senderPhoneRaw),
    adminPhone: normalizeKoreanPhone(adminPhoneRaw),
  };
}

/** Korean carriers count non-ASCII (Korean text) as 2 bytes when deciding SMS (<=90) vs LMS. */
function byteLength(text: string): number {
  let total = 0;
  for (const ch of text) total += (ch.codePointAt(0) ?? 0) > 0x7f ? 2 : 1;
  return total;
}

/**
 * Deliberately label-light (no "예약자:"/"날짜:" prefixes) so a typical
 * name/menu combination stays inside the 90-byte SMS threshold instead of
 * always falling back to LMS — see byteLength()/SMS_BYTE_LIMIT below. Field
 * order is fixed and consistent every time: date/time/guests, then name and
 * menu. No dashboard link in the body — that costs bytes an admin who
 * already knows to check /admin/reservations doesn't need.
 */
function buildMessageText(payload: ReservationNotificationPayload): string {
  return [
    `[${BUSINESS.nameKo}]신규예약`,
    `${payload.date} ${payload.time} ${payload.guestCount}명`,
    `${payload.customerName} ${payload.treatmentName}`,
  ].join("\n");
}

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = randomUUID();
  const signature = createHmac("sha256", apiSecret).update(`${date}${salt}`).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * Fire-and-forget: call it, don't await-and-throw on it. Mirrors the EMAIL
 * channel's idempotency contract (lib/notifications/service.ts) by reusing
 * the same `notifications` table — the (reservationId, "SMS", event) unique
 * row guarantees a genuinely new reservation is announced at most once, even
 * if this is invoked twice (double submit, client retry, React dev
 * double-invoke). Never throws: every failure path is logged and recorded,
 * never propagated to the caller.
 */
export async function sendAdminReservationSms(payload: ReservationNotificationPayload): Promise<void> {
  if (await wasAlreadySent(payload.reservationId, "SMS", EVENT)) return;

  const config = getSolapiConfig();
  if (!config) {
    console.info("[Admin SMS] SOLAPI configuration is missing. SMS skipped.");
    await recordAttempt({
      reservationId: payload.reservationId,
      channel: "SMS",
      event: EVENT,
      provider: PROVIDER,
      recipient: process.env.ADMIN_NOTIFICATION_PHONE ?? "",
      status: "SKIPPED",
      error: "provider_not_configured",
    });
    return;
  }

  if (!isValidKoreanPhone(config.adminPhone) || !isValidKoreanPhone(config.senderPhone)) {
    console.error("[Admin SMS] Failed to send reservation notification: invalid sender or admin phone number");
    await recordAttempt({
      reservationId: payload.reservationId,
      channel: "SMS",
      event: EVENT,
      provider: PROVIDER,
      recipient: config.adminPhone,
      status: "FAILED",
      error: "invalid_phone_number",
    });
    return;
  }

  const text = buildMessageText(payload);
  const type = byteLength(text) <= SMS_BYTE_LIMIT ? "SMS" : "LMS";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(SOLAPI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: buildAuthHeader(config.apiKey, config.apiSecret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { to: config.adminPhone, from: config.senderPhone, text, type } }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Provider error bodies can echo phone numbers/message content back — keep only the HTTP status.
      throw new Error(`solapi_http_${response.status}`);
    }

    const data = (await response.json()) as { messageId?: string; groupId?: string };
    await recordAttempt({
      reservationId: payload.reservationId,
      channel: "SMS",
      event: EVENT,
      provider: PROVIDER,
      recipient: config.adminPhone,
      status: "SENT",
      providerMessageId: data.messageId ?? data.groupId,
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "sms_delivery_timeout"
      : error instanceof Error ? error.message : "sms_delivery_failed";
    // Log a safe reason only — never the API secret, never the raw provider response.
    console.error(`[Admin SMS] Failed to send reservation notification: ${reason} (${maskRecipient(config.adminPhone)})`);
    await recordAttempt({
      reservationId: payload.reservationId,
      channel: "SMS",
      event: EVENT,
      provider: PROVIDER,
      recipient: config.adminPhone,
      status: "FAILED",
      error: reason,
    });
  }
}
