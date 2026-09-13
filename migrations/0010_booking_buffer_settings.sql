-- Admin-configurable prep/cleanup buffer around every reservation (see
-- lib/booking/availability.ts). A single row keyed 'default' — the admin
-- settings form (lib/repositories/bookingSettingsRepository.ts) upserts it
-- in place rather than tracking history. Seeded with the historical
-- hardcoded 60/60 minute values so behavior is unchanged until an admin
-- edits it.
CREATE TABLE booking_settings (
  id TEXT PRIMARY KEY,
  prep_minutes INTEGER NOT NULL CHECK (prep_minutes >= 0),
  cleanup_minutes INTEGER NOT NULL CHECK (cleanup_minutes >= 0),
  updated_at TEXT NOT NULL
);

INSERT INTO booking_settings (id, prep_minutes, cleanup_minutes, updated_at)
VALUES ('default', 60, 60, '1970-01-01T00:00:00.000Z');
