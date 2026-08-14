import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { BlockedWindow } from "@/lib/booking/availability";

export interface BlockedTimeInput {
  dateKey: string;
  /** "HH:mm" — ignored when fullDay is true. */
  startTime: string;
  endTime: string;
  fullDay?: boolean;
  reason?: string;
}

export interface BlockedTimeRecord {
  id: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  fullDay: boolean;
  reason?: string;
  createdAt: string;
}

interface RawRow {
  id: string;
  date_key: string;
  start_time: string;
  end_time: string;
  full_day: number;
  reason: string | null;
  created_at: string;
}

function mapRow(row: RawRow): BlockedTimeRecord {
  return {
    id: row.id,
    dateKey: row.date_key,
    startTime: row.start_time,
    endTime: row.end_time,
    fullDay: row.full_day === 1,
    reason: row.reason ?? undefined,
    createdAt: row.created_at,
  };
}

/** Admin-created manual block: a closed day, maintenance window, or private event. */
export async function createBlockedTime(input: BlockedTimeInput): Promise<BlockedTimeRecord> {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const fullDay = input.fullDay ?? false;
  const startTime = fullDay ? "00:00" : input.startTime;
  const endTime = fullDay ? "24:00" : input.endTime;

  await db
    .prepare(
      `INSERT INTO blocked_times (id, date_key, start_time, end_time, full_day, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.dateKey, startTime, endTime, fullDay ? 1 : 0, input.reason ?? null, now)
    .run();

  return { id, dateKey: input.dateKey, startTime, endTime, fullDay, reason: input.reason, createdAt: now };
}

export async function removeBlockedTime(id: string): Promise<boolean> {
  const result = await getDb().prepare("DELETE FROM blocked_times WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

export async function listBlockedTimesByDate(dateKey: string): Promise<BlockedTimeRecord[]> {
  const { results } = await getDb()
    .prepare("SELECT * FROM blocked_times WHERE date_key = ? ORDER BY start_time")
    .bind(dateKey)
    .all<RawRow>();
  return results.map(mapRow);
}

export async function listUpcomingBlockedTimes(fromDateKey: string): Promise<BlockedTimeRecord[]> {
  const { results } = await getDb()
    .prepare("SELECT * FROM blocked_times WHERE date_key >= ? ORDER BY date_key, start_time")
    .bind(fromDateKey)
    .all<RawRow>();
  return results.map(mapRow);
}

/** Admin manual blocks for `dateKey`, as blocked windows the availability engine understands. */
export async function getAdminBlockedWindows(dateKey: string): Promise<BlockedWindow[]> {
  return (await listBlockedTimesByDate(dateKey)).map((b) => ({ start: b.startTime, end: b.endTime }));
}
