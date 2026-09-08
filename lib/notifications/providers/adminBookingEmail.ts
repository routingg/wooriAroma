import { createHash } from "node:crypto";
import { EMAIL_PATTERN } from "@/lib/booking/validation";
import { resolveEmailDeliveryMode, resolveEmailRecipient, type EmailDeliveryMode } from "../recipientPolicy";

export interface AdminAlertConfiguration {
  apiKey: string;
  from: string;
  recipient: string;
  origin: string;
  mode: EmailDeliveryMode;
}

export type AdminAlertConfigurationResult =
  | { configured: true; value: AdminAlertConfiguration }
  | { configured: false; reason: string };

/** Server-only configuration. Never derive the dashboard URL from request headers. */
export function getAdminAlertConfiguration(): AdminAlertConfigurationResult {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { configured: false, reason: "provider_not_configured" };
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!adminEmail || !EMAIL_PATTERN.test(adminEmail)) {
    return { configured: false, reason: "admin_recipient_not_configured" };
  }
  const mode = resolveEmailDeliveryMode();
  const resolution = resolveEmailRecipient(adminEmail);
  if (!resolution.recipient || !EMAIL_PATTERN.test(resolution.recipient)) {
    return { configured: false, reason: "sandbox_recipient_not_configured" };
  }
  try {
    const url = new URL(process.env.ADMIN_NOTIFICATION_ORIGIN ?? "");
    const localSandbox = mode === "sandbox" && url.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((!localSandbox && url.protocol !== "https:") || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) {
      return { configured: false, reason: "admin_origin_not_configured" };
    }
    return { configured: true, value: { apiKey, from, recipient: resolution.recipient, origin: url.origin, mode } };
  } catch {
    return { configured: false, reason: "admin_origin_not_configured" };
  }
}

/** Persist the exact request on the first attempt: Resend retries must have an unchanged body. */
export function buildAdminAlertRequest(reservationId: string, config: AdminAlertConfiguration) {
  const link = new URL(`/admin/reservations/${encodeURIComponent(reservationId)}`, config.origin).toString();
  const requestJson = JSON.stringify({
    from: config.from,
    to: config.recipient,
    subject: "[우리같이아로마] 새 예약 요청이 도착했습니다",
    text: `새 예약 요청이 접수되었습니다. 관리자 화면에서 내용을 확인하고 예약을 확정해 주세요.\n\n${link}\n\n관리자 로그인이 필요합니다.`,
  });
  const recipientHash = createHash("sha256").update(config.recipient).digest("hex");
  return { requestJson, idempotencyKey: `admin-booking/${reservationId}/${config.mode}/${recipientHash}` };
}

export type AdminAlertEmailResult =
  | { sent: true; providerMessageId: string }
  | { sent: false; retryable: boolean; reason: string };

export async function sendAdminBookingEmail(
  requestJson: string,
  idempotencyKey: string,
  apiKey: string,
): Promise<AdminAlertEmailResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: requestJson,
      signal: controller.signal,
    });
    if (!response.ok) {
      // Provider bodies may contain addresses or request details; keep only a safe code.
      return {
        sent: false,
        retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
        reason: `provider_http_${response.status}`,
      };
    }
    const data = await response.json() as { id?: unknown };
    if (typeof data.id !== "string" || !data.id) {
      return { sent: false, retryable: true, reason: "provider_invalid_response" };
    }
    return { sent: true, providerMessageId: data.id };
  } catch {
    return { sent: false, retryable: true, reason: "provider_request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
