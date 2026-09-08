import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { EmailDeliveryMode } from "@/lib/notifications/recipientPolicy";

export interface AdminBookingAlert {
  reservation_id: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "TESTED" | "DEAD";
  attempt_count: number;
  created_at: string;
  next_attempt_at: string;
  first_attempt_at: string | null;
  lease_token: string | null;
  lease_until: string | null;
  delivery_mode: EmailDeliveryMode | null;
  request_json: string | null;
  idempotency_key: string | null;
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: string | null;
}

// Successful sandbox sends remain TESTED, so they never suppress a later
// production alert. A production SENT event is never automatically reopened.
const DUE_CONDITION = `((status = 'PENDING' AND next_attempt_at <= ?)
  OR (status = 'PROCESSING' AND lease_until <= ?)
  OR (status = 'TESTED' AND ? = 'production'))`;

export async function listDueAdminBookingAlertIds(
  now: Date,
  mode: EmailDeliveryMode,
  reservationId?: string,
): Promise<string[]> {
  const { results } = await getDb()
    .prepare(`SELECT reservation_id FROM admin_booking_alerts
      WHERE ${DUE_CONDITION} ${reservationId ? "AND reservation_id = ?" : ""}
      ORDER BY created_at LIMIT 5`)
    .bind(now.toISOString(), now.toISOString(), mode, ...(reservationId ? [reservationId] : []))
    .all<{ reservation_id: string }>();
  return results.map((row) => row.reservation_id);
}

/** Atomic lease acquisition, including recovery after a worker is interrupted. */
export async function claimAdminBookingAlert(
  reservationId: string,
  input: { now: Date; mode: EmailDeliveryMode; requestJson: string; idempotencyKey: string },
): Promise<AdminBookingAlert | null> {
  const now = input.now.toISOString();
  return getDb()
    .prepare(`UPDATE admin_booking_alerts SET
      attempt_count = CASE WHEN status = 'TESTED' THEN 1 ELSE attempt_count + 1 END,
      first_attempt_at = CASE WHEN status = 'TESTED' THEN ? ELSE COALESCE(first_attempt_at, ?) END,
      request_json = CASE WHEN status = 'TESTED' THEN ? ELSE COALESCE(request_json, ?) END,
      idempotency_key = CASE WHEN status = 'TESTED' THEN ? ELSE COALESCE(idempotency_key, ?) END,
      delivery_mode = CASE WHEN status = 'TESTED' THEN ? ELSE COALESCE(delivery_mode, ?) END,
      status = 'PROCESSING', lease_token = ?, lease_until = ?, sent_at = NULL,
      provider_message_id = NULL, last_error = NULL
      WHERE reservation_id = ? AND ${DUE_CONDITION}
      RETURNING *`)
    .bind(
      now, now, input.requestJson, input.requestJson, input.idempotencyKey, input.idempotencyKey,
      input.mode, input.mode, randomUUID(), new Date(input.now.getTime() + 60_000).toISOString(),
      reservationId, now, now, input.mode,
    )
    .first<AdminBookingAlert>();
}

/** Only the current lease owner can settle an attempt; late workers cannot overwrite it. */
export async function settleAdminBookingAlert(
  alert: AdminBookingAlert,
  result: {
    status: "PENDING" | "SENT" | "TESTED" | "DEAD";
    now: Date;
    nextAttemptAt?: Date;
    error?: string;
    providerMessageId?: string;
  },
): Promise<void> {
  await getDb()
    .prepare(`UPDATE admin_booking_alerts SET status = ?, next_attempt_at = ?,
      last_error = ?, provider_message_id = ?, sent_at = ?, lease_token = NULL, lease_until = NULL
      WHERE reservation_id = ? AND status = 'PROCESSING' AND lease_token = ?`)
    .bind(
      result.status, (result.nextAttemptAt ?? result.now).toISOString(), result.error ?? null,
      result.providerMessageId ?? null,
      result.status === "SENT" || result.status === "TESTED" ? result.now.toISOString() : null,
      alert.reservation_id, alert.lease_token,
    )
    .run();
}

export async function listAdminBookingAlerts(): Promise<AdminBookingAlert[]> {
  const { results } = await getDb()
    .prepare(`SELECT * FROM admin_booking_alerts ORDER BY
      CASE WHEN status = 'DEAD' THEN 0 WHEN status IN ('PENDING','PROCESSING') THEN 1 ELSE 2 END,
      created_at DESC LIMIT 100`)
    .all<AdminBookingAlert>();
  return results;
}
