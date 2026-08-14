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
