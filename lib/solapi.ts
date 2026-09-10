import { createHmac, randomUUID } from "node:crypto";
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
 * Short Korean label per data/services.ts Service.id — this admin SMS is
 * always Korean regardless of the guest's preferredLanguage, so it can't
 * reuse payload.treatmentName (localized for the customer-facing EMAIL
 * channel, e.g. English for an overseas guest). Falls back to
 * payload.treatmentName for an unmapped/missing id rather than throwing —
 * a new service should degrade to its full name, not break the SMS.
 */
const SHORT_TREATMENT_NAMES: Record<string, string> = {
  "thai-massage": "건식",
  "aroma-oil": "아로마",
  "hot-stone": "스톤",
  "quick-spa-foot": "발관리",
  facial: "얼굴",
};

function shortTreatmentName(payload: ReservationNotificationPayload): string {
  return (payload.serviceId && SHORT_TREATMENT_NAMES[payload.serviceId]) || payload.treatmentName;
}

/** payload.date is always "YYYY-MM-DD" (see ReservationNotificationPayload) — drop the year for the admin SMS, nobody reads this more than a season out. */
function monthDay(date: string): string {
  return date.slice(5);
}

/**
 * Deliberately label-light (no "예약자:"/"날짜:" prefixes) and no reservation
 * number — the admin dashboard link now covers "which reservation is this",
 * so it stays inside the 90-byte SMS threshold instead of falling back to
 * LMS. Fixed order every time: name, date/time/guests, then course+duration,
 * then the admin dashboard link (omitted when ADMIN_NOTIFICATION_ORIGIN
 * isn't configured, so a missing/malformed origin never blocks the alert).
 */
function buildMessageText(payload: ReservationNotificationPayload, adminUrl: string | null): string {
  const lines = [
    `${payload.customerName} ${monthDay(payload.date)} ${payload.time} ${payload.guestCount}명`,
    `${shortTreatmentName(payload)} ${payload.durationMinutes}분`,
  ];
  if (adminUrl) lines.push(adminUrl);
  return lines.join("\n");
}

/**
 * Mirrors the origin validation in lib/notifications/providers/adminBookingEmail.ts
 * (https-only, no userinfo/path/query/hash) — same env var, same trust
 * boundary, just linking to the /admin list instead of one reservation.
 */
function getAdminDashboardUrl(): string | null {
  try {
    const url = new URL(process.env.ADMIN_NOTIFICATION_ORIGIN ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return new URL("/admin", url.origin).toString();
  } catch {
    return null;
  }
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

  const text = buildMessageText(payload, getAdminDashboardUrl());
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
