import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";

export type NotificationChannel = "EMAIL" | "SMS" | "ADMIN";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

/** True if (reservationId, channel, eventType) already succeeded — the idempotency guard against duplicate sends. */
export function wasAlreadySent(reservationId: string, channel: NotificationChannel, eventType: string): boolean {
  const row = getDb()
    .prepare(`SELECT status FROM notifications WHERE reservation_id = ? AND channel = ? AND event_type = ?`)
    .get(reservationId, channel, eventType) as { status: NotificationStatus } | undefined;
  return row?.status === "SENT";
}

export interface RecordAttemptInput {
  reservationId: string;
  channel: NotificationChannel;
  eventType: string;
  recipient: string;
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/** Upserts the attempt row for this (reservation, channel, eventType) key, incrementing attempt_count. */
export function recordAttempt(input: RecordAttemptInput): void {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare(`SELECT id, attempt_count FROM notifications WHERE reservation_id = ? AND channel = ? AND event_type = ?`)
    .get(input.reservationId, input.channel, input.eventType) as { id: string; attempt_count: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE notifications
       SET status = ?, attempt_count = ?, provider_message_id = COALESCE(?, provider_message_id), last_error = ?, sent_at = ?
       WHERE id = ?`,
    ).run(
      input.success ? "SENT" : "FAILED",
      existing.attempt_count + 1,
      input.providerMessageId ?? null,
      input.error ?? null,
      input.success ? now : null,
      existing.id,
    );
    return;
  }

  db.prepare(
    `INSERT INTO notifications
       (id, reservation_id, channel, event_type, recipient, status, provider_message_id, attempt_count, last_error, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.reservationId,
    input.channel,
    input.eventType,
    input.recipient,
    input.success ? "SENT" : "FAILED",
    input.providerMessageId ?? null,
    input.error ?? null,
    now,
    input.success ? now : null,
  );
}
