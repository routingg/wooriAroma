-- A booking and its admin alert must commit together. The trigger covers
-- both the booking wizard and the AI booking flow, without copying customer
-- names, contact details, or special requests into the delivery queue.
CREATE TABLE admin_booking_alerts (
  reservation_id TEXT PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','TESTED','DEAD')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  next_attempt_at TEXT NOT NULL,
  first_attempt_at TEXT,
  lease_token TEXT,
  lease_until TEXT,
  delivery_mode TEXT CHECK (delivery_mode IN ('sandbox','production')),
  request_json TEXT,
  idempotency_key TEXT,
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TEXT
);
CREATE INDEX idx_admin_booking_alerts_due ON admin_booking_alerts(status, next_attempt_at);

CREATE TRIGGER enqueue_admin_booking_alert
AFTER UPDATE OF status ON reservations
WHEN OLD.status = 'HOLD' AND NEW.status = 'PENDING'
BEGIN
  INSERT INTO admin_booking_alerts (reservation_id, created_at, next_attempt_at)
  VALUES (NEW.id, NEW.updated_at, NEW.updated_at)
  ON CONFLICT(reservation_id) DO NOTHING;
END;
