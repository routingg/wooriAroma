-- Per-guest treatment selection within one private-group reservation. A
-- reservation's duration_minutes/service_start/service_end still describe
-- the single shared time slot the whole group occupies together (every
-- guest must choose an option of the same duration — enforced in
-- lib/repositories/reservationRepository.ts, not here) — only which
-- treatment each guest receives during that slot can differ.
--
-- Always populated with one row per guest, even when every guest chose the
-- same course, so every reader has exactly one code path instead of a
-- "uniform vs mixed" branch at the schema level (see
-- lib/repositories/reservationGuestRepository.ts). reservations.service_option_id
-- and reservations.price_per_person keep storing guest 1's pick as a
-- backward-compatible anchor value for old readers; reservation_guests is
-- the source of truth for per-guest detail and for total_amount.
CREATE TABLE reservation_guests (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  guest_index INTEGER NOT NULL CHECK (guest_index BETWEEN 1 AND 4),
  service_option_id TEXT NOT NULL,
  price_per_person INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(reservation_id, guest_index)
);
CREATE INDEX idx_reservation_guests_reservation ON reservation_guests(reservation_id);
