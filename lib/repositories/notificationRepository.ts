import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { NotificationChannel, NotificationEvent, NotificationStatus } from "@/lib/notifications/types";

/** True if (reservationId, channel, eventType) already succeeded — the idempotency guard against duplicate sends (also what makes reminder re-runs safe, see lib/booking/reminderService.ts). */
export async function wasAlreadySent(
  reservationId: string,
  channel: NotificationChannel,
  event: NotificationEvent,
): Promise<boolean> {
  const row = await getDb()
    .prepare(`SELECT status FROM notifications WHERE reservation_id = ? AND channel = ? AND event_type = ?`)
    .bind(reservationId, channel, event)
    .first<{ status: NotificationStatus }>();
  return row?.status === "SENT";
}

export interface RecordAttemptInput {
  reservationId: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  provider: string;
  recipient: string;
  status: NotificationStatus;
  providerMessageId?: string;
  error?: string;
}

/** Upserts the attempt row for this (reservation, channel, eventType) key, incrementing attempt_count. */
export async function recordAttempt(input: RecordAttemptInput): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = await db
    .prepare(`SELECT id, attempt_count FROM notifications WHERE reservation_id = ? AND channel = ? AND event_type = ?`)
    .bind(input.reservationId, input.channel, input.event)
    .first<{ id: string; attempt_count: number }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE notifications
         SET status = ?, provider = ?, attempt_count = ?, provider_message_id = COALESCE(?, provider_message_id), last_error = ?, sent_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.status,
        input.provider,
        existing.attempt_count + 1,
        input.providerMessageId ?? null,
        input.error ?? null,
        input.status === "SENT" ? now : null,
        existing.id,
      )
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO notifications
         (id, reservation_id, channel, event_type, provider, recipient, status, provider_message_id, attempt_count, last_error, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    .bind(
      randomUUID(),
      input.reservationId,
      input.channel,
      input.event,
      input.provider,
      input.recipient,
      input.status,
      input.providerMessageId ?? null,
      input.error ?? null,
      now,
      input.status === "SENT" ? now : null,
    )
    .run();
}

export interface NotificationLogRow {
  id: string;
  channel: NotificationChannel;
  eventType: NotificationEvent;
  provider: string;
  recipient: string;
  status: NotificationStatus;
  providerMessageId: string | null;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface RawNotificationRow {
  id: string;
  channel: NotificationChannel;
  event_type: NotificationEvent;
  provider: string;
  recipient: string;
  status: NotificationStatus;
  provider_message_id: string | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

/** Powers the admin reservation detail "Notifications" panel (§16 of the notification spec). */
export async function listByReservation(reservationId: string): Promise<NotificationLogRow[]> {
  const { results } = await getDb()
    .prepare(`SELECT * FROM notifications WHERE reservation_id = ? ORDER BY created_at`)
    .bind(reservationId)
    .all<RawNotificationRow>();

  return results.map((row) => ({
    id: row.id,
    channel: row.channel,
    eventType: row.event_type,
    provider: row.provider,
    recipient: row.recipient,
    status: row.status,
    providerMessageId: row.provider_message_id,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  }));
}
