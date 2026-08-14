import { EMAIL_PATTERN } from "@/lib/booking/validation";
import { recordAttempt } from "@/lib/repositories/notificationRepository";
import { resendEmailProvider } from "./providers/email";
import type { ReservationNotificationPayload } from "./types";

export interface AdminSendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  redirected: boolean;
  reason?: string;
}

export interface SendResultState {
  status: "idle" | "sent" | "failed" | "skipped";
  reason?: string;
  redirected?: boolean;
}

/** Shared SENT/FAILED/SKIPPED → idle/sent/failed/skipped mapping so every admin send action (reservation-linked or manual) reports results the same way. */
export function toSendResultState(result: AdminSendResult): SendResultState {
  if (result.status === "SENT") return { status: "sent", redirected: result.redirected };
  if (result.status === "SKIPPED") return { status: "skipped", reason: result.reason };
  return { status: "failed", reason: result.reason };
}

/**
 * Admin-triggered confirmation send (initial "Send Confirmation" or
 * "Resend Confirmation" from app/admin/reservations/[id]/actions.ts, or a
 * manual/unlinked send from app/admin/send-confirmation/actions.ts).
 *
 * Deliberately does not check the automatic dispatch path's
 * wasAlreadySent() guard (lib/notifications/service.ts) — an admin
 * explicitly clicking Resend must be able to resend even though the
 * confirmation already succeeded once. recordAttempt() still upserts the
 * same (reservation, EMAIL, RESERVATION_CONFIRMED) row the automatic path
 * writes to, so both the "Sent" status shown in the admin UI and the
 * idempotency guard the automatic path relies on stay accurate and
 * consistent — this is the one place besides service.ts that is allowed
 * to write to that row, and it always does so through the same
 * repository function.
 *
 * `persist` defaults to true for the reservation-linked flow. Pass
 * `persist: false` for a manual/unlinked send (lib/notifications/manualPayload.ts)
 * — those payloads carry a synthetic reservationId with no matching row in
 * `reservations`, and recordAttempt() would violate the notifications
 * table's FOREIGN KEY constraint (PRAGMA foreign_keys = ON) if called.
 */
export async function sendAdminConfirmationEmail(
  payload: ReservationNotificationPayload,
  options: { includeMap: boolean; persist?: boolean },
): Promise<AdminSendResult> {
  if (!EMAIL_PATTERN.test(payload.customerEmail)) {
    return { status: "SKIPPED", redirected: false, reason: "invalid_customer_email" };
  }

  const result = await resendEmailProvider.send(payload, { includeMap: options.includeMap });

  if (options.persist ?? true) {
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
  }

  return { status: result.status, redirected: result.redirected ?? false, reason: result.reason };
}

/**
 * "Send Test Email" — always targets the approved sandbox recipient
 * (EMAIL_TEST_RECIPIENT), regardless of EMAIL_DELIVERY_MODE, and is never
 * persisted to the notifications table: a test send must never appear as
 * "confirmation sent" for the reservation, and must never satisfy the
 * idempotency guard the real confirmation relies on (customer-safety
 * requirement — see recipientPolicy.ts).
 */
export async function sendAdminTestEmail(
  payload: ReservationNotificationPayload,
  options: { includeMap: boolean },
): Promise<AdminSendResult> {
  const testRecipient = process.env.EMAIL_TEST_RECIPIENT;
  if (!testRecipient) {
    return { status: "SKIPPED", redirected: false, reason: "sandbox_mode_no_test_recipient" };
  }

  const testPayload: ReservationNotificationPayload = { ...payload, customerEmail: testRecipient };
  const result = await resendEmailProvider.send(testPayload, { includeMap: options.includeMap });

  return { status: result.status, redirected: result.redirected ?? false, reason: result.reason };
}
