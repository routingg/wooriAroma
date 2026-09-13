import { getDb } from "@/lib/db/client";

const SETTINGS_ID = "default";

/** Historical hardcoded values, used only if the singleton row is somehow missing. */
const FALLBACK_SETTINGS: BookingSettings = { prepMinutes: 60, cleanupMinutes: 60 };

export interface BookingSettings {
  /** Minutes blocked before every treatment's start, for staff setup. */
  prepMinutes: number;
  /** Minutes blocked after every treatment's end, for staff cleanup. */
  cleanupMinutes: number;
}

interface RawRow {
  prep_minutes: number;
  cleanup_minutes: number;
}

/** Admin-configurable prep/cleanup buffer (see migrations/0010_booking_buffer_settings.sql). */
export async function getBookingSettings(): Promise<BookingSettings> {
  const row = await getDb()
    .prepare("SELECT prep_minutes, cleanup_minutes FROM booking_settings WHERE id = ?")
    .bind(SETTINGS_ID)
    .first<RawRow>();
  if (!row) return FALLBACK_SETTINGS;
  return { prepMinutes: row.prep_minutes, cleanupMinutes: row.cleanup_minutes };
}

export async function updateBookingSettings(settings: BookingSettings): Promise<void> {
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `INSERT INTO booking_settings (id, prep_minutes, cleanup_minutes, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         prep_minutes = excluded.prep_minutes,
         cleanup_minutes = excluded.cleanup_minutes,
         updated_at = excluded.updated_at`,
    )
    .bind(SETTINGS_ID, settings.prepMinutes, settings.cleanupMinutes, now)
    .run();
}
