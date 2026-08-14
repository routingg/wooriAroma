-- Deposit removal (AGENTS.md): a submitted reservation is no longer
-- auto-CONFIRMED by a mock deposit payment — it now lands as PENDING
-- until an admin reviews and confirms it. SQLite can't ALTER a CHECK
-- constraint, so both tables are rebuilt (same technique as 0004).
-- notifications.reservation_id has a FK on reservations, so the child
-- table must be backed up and dropped *before* the parent can be
-- rebuilt (SQLite refuses to DROP a table that is the parent of an
-- existing foreign key while PRAGMA foreign_keys=ON), then recreated
-- afterward with its data restored and the new RESERVATION_REQUEST_RECEIVED
-- event type added.
CREATE TABLE notifications_backup AS SELECT * FROM notifications;
DROP TABLE notifications;

CREATE TABLE reservations_v2 (
  id TEXT PRIMARY KEY,
  reservation_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  service_option_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count BETWEEN 1 AND 4),
  date_key TEXT NOT NULL,
  service_start TEXT NOT NULL,
  service_end TEXT NOT NULL,
  blocked_start TEXT NOT NULL,
  blocked_end TEXT NOT NULL,
  price_per_person INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','HOLD','PENDING','CONFIRMED','CANCELLED','NO_SHOW','COMPLETED')),
  hold_expires_at TEXT,
  special_requests TEXT,
  source TEXT NOT NULL DEFAULT 'DIRECT' CHECK (source IN ('GOOGLE_MAPS','GOOGLE_SEARCH','INSTAGRAM','NAVER','HOTEL','DIRECT','REPEAT')),
  locale TEXT NOT NULL,
  deposit_transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO reservations_v2 SELECT * FROM reservations;
DROP TABLE reservations;
ALTER TABLE reservations_v2 RENAME TO reservations;
CREATE INDEX idx_reservations_date_status ON reservations(date_key, status);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL','KAKAO','SMS','WHATSAPP','TELEGRAM')),
  event_type TEXT NOT NULL CHECK (event_type IN ('RESERVATION_REQUEST_RECEIVED','RESERVATION_CONFIRMED','RESERVATION_UPDATED','RESERVATION_CANCELLED','RESERVATION_REMINDER')),
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
INSERT INTO notifications SELECT * FROM notifications_backup;
DROP TABLE notifications_backup;
CREATE INDEX idx_notifications_reservation ON notifications(reservation_id);
