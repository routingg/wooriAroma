-- One row per (reservation, channel, event type) — the UNIQUE
-- constraint is the idempotency guard so a client retry of
-- POST /api/reservations can never re-send an already-SENT
-- confirmation. See lib/repositories/notificationRepository.ts.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL','SMS','ADMIN')),
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SENT','FAILED')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  UNIQUE(reservation_id, channel, event_type)
);
CREATE INDEX idx_notifications_reservation ON notifications(reservation_id);
