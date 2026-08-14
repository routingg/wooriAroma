export interface Migration {
  id: string;
  sql: string;
}

/**
 * Applied in order, tracked in `schema_migrations` (see client.ts). Add new
 * migrations by appending here — never edit a migration that has already
 * shipped, since `schema_migrations` marks it applied and it will never run
 * again on existing databases.
 */
export const migrations: Migration[] = [
  {
    id: "001_init",
    sql: `
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        preferred_language TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Service catalog (names, prices, durations) intentionally stays in
      -- data/services.ts, not this table — see proposal.md for the decision
      -- record. Reservations reference service_option_id as a plain string,
      -- validated against data/services.ts at write time.
      CREATE TABLE reservations (
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
        status TEXT NOT NULL CHECK (status IN ('DRAFT','HOLD','CONFIRMED','CANCELLED','NO_SHOW','COMPLETED')),
        hold_expires_at TEXT,
        special_requests TEXT,
        source TEXT NOT NULL DEFAULT 'DIRECT' CHECK (source IN ('GOOGLE_MAPS','GOOGLE_SEARCH','INSTAGRAM','NAVER','HOTEL','DIRECT','REPEAT')),
        locale TEXT NOT NULL,
        deposit_transaction_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_reservations_date_status ON reservations(date_key, status);
      CREATE INDEX idx_reservations_customer ON reservations(customer_id);

      -- Manual admin blocks: closures, maintenance, private events.
      -- full_day rows use start_time='00:00', end_time='24:00'.
      CREATE TABLE blocked_times (
        id TEXT PRIMARY KEY,
        date_key TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        full_day INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_blocked_times_date ON blocked_times(date_key);

      -- Backs server-side, concurrency-safe reservation number generation
      -- (WA-YYYYMMDD-NNN). See lib/booking/reservationNumber.ts.
      CREATE TABLE reservation_counters (
        date_key TEXT PRIMARY KEY,
        next_seq INTEGER NOT NULL
      );
    `,
  },
  {
    id: "002_notifications",
    sql: `
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
    `,
  },
  {
    id: "003_agent_handoffs",
    sql: `
      -- "에이전트 예외함" (AGENTS.md §18): cases the Gemini agent could not
      -- safely resolve itself and must hand to a human. The agent never
      -- gets tools for discounts, refunds, or bypassing blocked times — it
      -- can only ever escalate here, never act around a missing policy.
      CREATE TABLE agent_handoffs (
        id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        summary TEXT NOT NULL,
        customer_contact TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_agent_handoffs_status ON agent_handoffs(status);
    `,
  },
  {
    id: "004_notifications_v2",
    sql: `
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
    `,
  },
  {
    id: "005_pending_reservation_status",
    sql: `
      -- Deposit removal (AGENTS.md): a submitted reservation is no longer
      -- auto-CONFIRMED by a mock deposit payment — it now lands as PENDING
      -- until an admin reviews and confirms it. SQLite can't ALTER a CHECK
      -- constraint, so both tables are rebuilt (same technique as 004).
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
    `,
  },
  {
    id: "006_reservation_soft_delete",
    sql: `
      -- Soft delete for completed reservations (AGENTS.md admin "삭제"
      -- feature): removing an item from the admin dashboard only ever sets
      -- deleted_at, never physically deletes the row — reservation history
      -- (and any future analytics) stays intact. No CHECK constraint is
      -- involved, so a plain ADD COLUMN is sufficient here (unlike 004/005).
      ALTER TABLE reservations ADD COLUMN deleted_at TEXT;
      CREATE INDEX idx_reservations_deleted_at ON reservations(deleted_at);
    `,
  },
];
