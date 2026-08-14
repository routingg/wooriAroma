-- Multi-channel notification system (email/Kakao/SMS/WhatsApp/Telegram).
-- SQLite can't ALTER a CHECK constraint, so the table is rebuilt:
-- old 'ADMIN' channel rows become 'TELEGRAM' (that's what admin alerts
-- actually are now), old 'BOOKING_CONFIRMED' event rows become
-- 'RESERVATION_CONFIRMED', and the never-actually-written 'PENDING'
-- status collapses to 'FAILED' (status is now only ever recorded after
-- an attempt settles — see lib/repositories/notificationRepository.ts).
CREATE TABLE notifications_v2 (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL','KAKAO','SMS','WHATSAPP','TELEGRAM')),
  event_type TEXT NOT NULL CHECK (event_type IN ('RESERVATION_CONFIRMED','RESERVATION_UPDATED','RESERVATION_CANCELLED','RESERVATION_REMINDER')),
  provider TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT','FAILED','SKIPPED')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  UNIQUE(reservation_id, channel, event_type)
);

INSERT INTO notifications_v2
  (id, reservation_id, channel, event_type, provider, recipient, status, provider_message_id, attempt_count, last_error, created_at, sent_at)
SELECT
  id,
  reservation_id,
  CASE channel WHEN 'ADMIN' THEN 'TELEGRAM' ELSE channel END,
  CASE event_type WHEN 'BOOKING_CONFIRMED' THEN 'RESERVATION_CONFIRMED' ELSE event_type END,
  'legacy',
  recipient,
  CASE status WHEN 'PENDING' THEN 'FAILED' ELSE status END,
  provider_message_id,
  attempt_count,
  last_error,
  created_at,
  sent_at
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_v2 RENAME TO notifications;
CREATE INDEX idx_notifications_reservation ON notifications(reservation_id);

-- WhatsApp requires explicit customer opt-in (Meta template-messaging
-- rules) — Kakao/SMS/email need no such flag since they're the
-- expected default channel for their respective customer segment.
ALTER TABLE customers ADD COLUMN whatsapp_opt_in INTEGER NOT NULL DEFAULT 0;
