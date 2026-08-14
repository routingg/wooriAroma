import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { getServiceOption } from "@/data/services";
import type { AppLocale } from "@/i18n/routing";
import { calculateBlockedTime, type BlockedWindow } from "@/lib/booking/availability";
import { fromMinutes, toMinutes } from "@/lib/booking/time";
import { calculateDepositAmount, calculateRemainingAmount, calculateTotalAmount } from "@/lib/booking/pricing";
import { BookingError } from "@/lib/booking/errors";
import { nextReservationNumber } from "@/lib/booking/reservationNumber";
import type { ReservationHoldRequest } from "@/lib/booking/validation";
import { upsertCustomer, type CustomerRecord } from "./customerRepository";
import { DELETABLE_RESERVATION_STATUSES } from "@/lib/admin/labels";

const HOLD_MINUTES = Number(process.env.BOOKING_HOLD_MINUTES ?? 10);

export type ReservationStatus = "DRAFT" | "HOLD" | "PENDING" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";

export interface ReservationRecord {
  id: string;
  reservationNumber: string;
  customerId: string;
  serviceOptionId: string;
  durationMinutes: number;
  guestCount: number;
  dateKey: string;
  serviceStart: string;
  serviceEnd: string;
  blockedStart: string;
  blockedEnd: string;
  pricePerPerson: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  status: ReservationStatus;
  holdExpiresAt: string | null;
  specialRequests: string | null;
  source: string;
  locale: AppLocale;
  depositTransactionId: string | null;
  /** Soft-delete marker (admin "삭제" of a COMPLETED reservation) — null unless the admin removed it from the working dashboard. See softDeleteReservation(). */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawReservationRow {
  id: string;
  reservation_number: string;
  customer_id: string;
  service_option_id: string;
  duration_minutes: number;
  guest_count: number;
  date_key: string;
  service_start: string;
  service_end: string;
  blocked_start: string;
  blocked_end: string;
  price_per_person: number;
  total_amount: number;
  deposit_amount: number;
  remaining_amount: number;
  status: ReservationStatus;
  hold_expires_at: string | null;
  special_requests: string | null;
  source: string;
  locale: string;
  deposit_transaction_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawReservationRow): ReservationRecord {
  return {
    id: row.id,
    reservationNumber: row.reservation_number,
    customerId: row.customer_id,
    serviceOptionId: row.service_option_id,
    durationMinutes: row.duration_minutes,
    guestCount: row.guest_count,
    dateKey: row.date_key,
    serviceStart: row.service_start,
    serviceEnd: row.service_end,
    blockedStart: row.blocked_start,
    blockedEnd: row.blocked_end,
    pricePerPerson: row.price_per_person,
    totalAmount: row.total_amount,
    depositAmount: row.deposit_amount,
    remainingAmount: row.remaining_amount,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
    specialRequests: row.special_requests,
    source: row.source,
    locale: row.locale as AppLocale,
    depositTransactionId: row.deposit_transaction_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Blocked windows from reservations that currently occupy the calendar:
 * CONFIRMED, PENDING (a submitted request awaiting admin review still holds
 * its slot — AGENTS.md deposit removal), or a HOLD that hasn't expired yet.
 * `excludeReservationId` lets callers re-check without conflicting with
 * their own hold. Read-only — used by availabilityService.ts for the
 * customer-facing slot grid. The write paths below (createHold /
 * submitReservationRequest / confirmReservation) do NOT use this: D1 has
 * no interactive transactions, so a JS-side read-then-branch here would be
 * racy for a write decision. They instead push the equivalent conflict
 * check into a single conditional SQL statement.
 */
export async function getActiveBlockedWindows(dateKey: string, excludeReservationId?: string): Promise<BlockedWindow[]> {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const { results } = excludeReservationId
    ? await db
        .prepare(
          `SELECT blocked_start, blocked_end FROM reservations
           WHERE date_key = ? AND id != ? AND (status IN ('CONFIRMED','PENDING') OR (status = 'HOLD' AND hold_expires_at > ?))`,
        )
        .bind(dateKey, excludeReservationId, nowIso)
        .all<{ blocked_start: string; blocked_end: string }>()
    : await db
        .prepare(
          `SELECT blocked_start, blocked_end FROM reservations
           WHERE date_key = ? AND (status IN ('CONFIRMED','PENDING') OR (status = 'HOLD' AND hold_expires_at > ?))`,
        )
        .bind(dateKey, nowIso)
        .all<{ blocked_start: string; blocked_end: string }>();

  return results.map((r) => ({ start: r.blocked_start, end: r.blocked_end }));
}

export interface CreateHoldResult {
  reservation: ReservationRecord;
  customer: CustomerRecord;
}

/**
 * Server-authoritative slot lock. Re-derives price and the blocked window
 * from trusted server data (never from the client) and inserts in a single
 * conditional SQL statement that only succeeds if no other active
 * reservation or admin block overlaps the candidate window — this INSERT
 * ... WHERE NOT EXISTS (...) is what makes two near-simultaneous requests
 * for the same slot unable to both succeed, since D1 has no interactive
 * transactions to wrap a separate read+write in (see lib/db/client.ts).
 * Throws BookingError("SLOT_UNAVAILABLE", ...) if the slot is already taken.
 */
export async function createHold(request: ReservationHoldRequest): Promise<CreateHoldResult> {
  const db = getDb();
  const option = getServiceOption(request.serviceOptionId);
  if (!option) {
    throw new BookingError("SERVICE_NOT_BOOKABLE", "Unknown or unpublished service option.");
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const serviceEnd = fromMinutes(toMinutes(request.time) + option.durationMinutes);
  const blocked = calculateBlockedTime(request.time, serviceEnd);

  const customer = await upsertCustomer({
    name: request.customer.name,
    phone: request.customer.phone,
    email: request.customer.email,
    preferredLanguage: request.customer.preferredLanguage,
  });

  const totalAmount = calculateTotalAmount(option.pricePerPerson, request.guestCount);
  const depositAmount = calculateDepositAmount(request.guestCount);
  const remainingAmount = calculateRemainingAmount(totalAmount, depositAmount);

  const reservationNumber = await nextReservationNumber(db, request.date);
  const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
  const id = randomUUID();

  const result = await db
    .prepare(
      `INSERT INTO reservations (
        id, reservation_number, customer_id, service_option_id, duration_minutes, guest_count,
        date_key, service_start, service_end, blocked_start, blocked_end,
        price_per_person, total_amount, deposit_amount, remaining_amount,
        status, hold_expires_at, special_requests, source, locale, deposit_transaction_id,
        created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HOLD', ?, ?, ?, ?, NULL, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.date_key = ?
          AND (r.status IN ('CONFIRMED','PENDING') OR (r.status = 'HOLD' AND r.hold_expires_at > ?))
          AND ? < r.blocked_end AND r.blocked_start < ?
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocked_times bt
        WHERE bt.date_key = ?
          AND ? < bt.end_time AND bt.start_time < ?
      )`,
    )
    .bind(
      id,
      reservationNumber,
      customer.id,
      option.id,
      option.durationMinutes,
      request.guestCount,
      request.date,
      request.time,
      serviceEnd,
      blocked.start,
      blocked.end,
      option.pricePerPerson,
      totalAmount,
      depositAmount,
      remainingAmount,
      holdExpiresAt,
      request.customer.specialRequest ?? null,
      request.source,
      request.locale,
      nowIso,
      nowIso,
      // NOT EXISTS #1 — overlapping reservations
      request.date,
      nowIso,
      blocked.start,
      blocked.end,
      // NOT EXISTS #2 — overlapping admin blocked_times
      request.date,
      blocked.start,
      blocked.end,
    )
    .run();

  if (result.meta.changes === 0) {
    throw new BookingError("SLOT_UNAVAILABLE", "This time is no longer available. Please choose another slot.");
  }

  return { reservation: (await getById(id))!, customer };
}

export interface SubmitReservationInput {
  holdId: string;
}

/**
 * Flips a HOLD to PENDING once the customer submits their reservation
 * request — no deposit/payment is collected (AGENTS.md deposit removal).
 * This is what the customer booking flow calls; the reservation only
 * becomes CONFIRMED later, when an admin reviews and approves it (see
 * app/admin/reservations/[id]/actions.ts). Re-checks hold-expiry/conflict
 * (an admin block could have been added after the hold was created) inside
 * the same conditional UPDATE as the status change — see createHold's doc
 * comment for why this can't be a separate read+write transaction on D1.
 * Idempotent: submitting an already-PENDING or already-CONFIRMED hold just
 * returns it, so a client retry after a dropped response can't error.
 */
export async function submitReservationRequest(input: SubmitReservationInput): Promise<ReservationRecord> {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const result = await db
    .prepare(
      `UPDATE reservations
       SET status = 'PENDING', hold_expires_at = NULL, updated_at = ?
       WHERE id = ?
         AND status = 'HOLD'
         AND hold_expires_at > ?
         AND NOT EXISTS (
           SELECT 1 FROM reservations r2
           WHERE r2.date_key = reservations.date_key
             AND r2.id != reservations.id
             AND (r2.status IN ('CONFIRMED','PENDING') OR (r2.status = 'HOLD' AND r2.hold_expires_at > ?))
             AND reservations.blocked_start < r2.blocked_end AND r2.blocked_start < reservations.blocked_end
         )
         AND NOT EXISTS (
           SELECT 1 FROM blocked_times bt
           WHERE bt.date_key = reservations.date_key
             AND reservations.blocked_start < bt.end_time AND bt.start_time < reservations.blocked_end
         )`,
    )
    .bind(nowIso, input.holdId, nowIso, nowIso)
    .run();

  if (result.meta.changes > 0) {
    return (await getById(input.holdId))!;
  }
  return resolveWriteFailure(input.holdId, nowIso, "submit");
}

export interface ConfirmReservationInput {
  holdId: string;
  depositTransactionId: string;
}

/**
 * Flips a HOLD to CONFIRMED after the deposit payment succeeds. Same
 * conditional-UPDATE shape as submitReservationRequest — see its doc
 * comment. Idempotent: confirming an already-CONFIRMED hold just returns
 * it, so a client retry after a dropped response can't double-charge or
 * error.
 */
export async function confirmReservation(input: ConfirmReservationInput): Promise<ReservationRecord> {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const result = await db
    .prepare(
      `UPDATE reservations
       SET status = 'CONFIRMED', hold_expires_at = NULL, deposit_transaction_id = ?, updated_at = ?
       WHERE id = ?
         AND status = 'HOLD'
         AND hold_expires_at > ?
         AND NOT EXISTS (
           SELECT 1 FROM reservations r2
           WHERE r2.date_key = reservations.date_key
             AND r2.id != reservations.id
             AND (r2.status IN ('CONFIRMED','PENDING') OR (r2.status = 'HOLD' AND r2.hold_expires_at > ?))
             AND reservations.blocked_start < r2.blocked_end AND r2.blocked_start < reservations.blocked_end
         )
         AND NOT EXISTS (
           SELECT 1 FROM blocked_times bt
           WHERE bt.date_key = reservations.date_key
             AND reservations.blocked_start < bt.end_time AND bt.start_time < reservations.blocked_end
         )`,
    )
    .bind(input.depositTransactionId, nowIso, input.holdId, nowIso, nowIso)
    .run();

  if (result.meta.changes > 0) {
    return (await getById(input.holdId))!;
  }
  return resolveWriteFailure(input.holdId, nowIso, "confirm");
}

/**
 * Diagnoses why a conditional UPDATE in submitReservationRequest/
 * confirmReservation affected 0 rows, so the right BookingError code can
 * still be thrown. This re-read doesn't need to be atomic with anything —
 * the mutation's safety already came from the single conditional UPDATE
 * above; this is purely for producing an accurate error message.
 */
async function resolveWriteFailure(
  holdId: string,
  nowIso: string,
  action: "submit" | "confirm",
): Promise<ReservationRecord> {
  const current = await getById(holdId);
  if (!current) {
    throw new BookingError("HOLD_NOT_FOUND", "Reservation hold not found.");
  }
  if (current.status === "PENDING" || current.status === "CONFIRMED") {
    return current;
  }
  if (current.status !== "HOLD") {
    const verb = action === "submit" ? "submittable" : "confirmable";
    throw new BookingError("HOLD_EXPIRED", `Reservation is ${current.status.toLowerCase()}, not ${verb}.`);
  }
  if (!current.holdExpiresAt || current.holdExpiresAt <= nowIso) {
    throw new BookingError("HOLD_EXPIRED", "This hold has expired. Please choose a time again.");
  }
  throw new BookingError("SLOT_UNAVAILABLE", "This time is no longer available.");
}

export async function getById(id: string): Promise<ReservationRecord | undefined> {
  const row = await getDb().prepare("SELECT * FROM reservations WHERE id = ?").bind(id).first<RawReservationRow>();
  return row ? mapRow(row) : undefined;
}

export async function getByReservationNumber(reservationNumber: string): Promise<ReservationRecord | undefined> {
  const row = await getDb()
    .prepare("SELECT * FROM reservations WHERE reservation_number = ?")
    .bind(reservationNumber)
    .first<RawReservationRow>();
  return row ? mapRow(row) : undefined;
}

/** Excludes soft-deleted rows — every reservation-list function below is an admin-facing "working list" (AGENTS.md §15), never the record store itself. */
export async function listByDate(dateKey: string): Promise<ReservationRecord[]> {
  const { results } = await getDb()
    .prepare("SELECT * FROM reservations WHERE date_key = ? AND deleted_at IS NULL ORDER BY blocked_start")
    .bind(dateKey)
    .all<RawReservationRow>();
  return results.map(mapRow);
}

/** Every non-deleted reservation regardless of date — powers the admin's all-reservations list (split into upcoming/past there). */
export async function listAll(statusFilter?: ReservationStatus[]): Promise<ReservationRecord[]> {
  const db = getDb();
  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => "?").join(",");
    const { results } = await db
      .prepare(
        `SELECT * FROM reservations WHERE status IN (${placeholders}) AND deleted_at IS NULL ORDER BY date_key, blocked_start`,
      )
      .bind(...statusFilter)
      .all<RawReservationRow>();
    return results.map(mapRow);
  }
  const { results } = await db
    .prepare("SELECT * FROM reservations WHERE deleted_at IS NULL ORDER BY date_key, blocked_start")
    .all<RawReservationRow>();
  return results.map(mapRow);
}

export async function listByDateRange(
  fromDateKey: string,
  toDateKey: string,
  statusFilter?: ReservationStatus[],
): Promise<ReservationRecord[]> {
  const db = getDb();
  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => "?").join(",");
    const { results } = await db
      .prepare(
        `SELECT * FROM reservations WHERE date_key BETWEEN ? AND ? AND status IN (${placeholders}) AND deleted_at IS NULL
         ORDER BY date_key, blocked_start`,
      )
      .bind(fromDateKey, toDateKey, ...statusFilter)
      .all<RawReservationRow>();
    return results.map(mapRow);
  }
  const { results } = await db
    .prepare(
      "SELECT * FROM reservations WHERE date_key BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY date_key, blocked_start",
    )
    .bind(fromDateKey, toDateKey)
    .all<RawReservationRow>();
  return results.map(mapRow);
}

/**
 * CONFIRMED reservations across a small set of dateKeys — used by the 24h
 * reminder job (lib/booking/reminderService.ts), which only ever needs
 * "today" and "tomorrow" since service_start is stored as a plain "HH:mm"
 * string, not a timestamp the DB can range-filter against "now + 24h"
 * directly. Filtering down to the exact reminder window happens in JS.
 */
export async function listConfirmedReservationsForDates(dateKeys: string[]): Promise<ReservationRecord[]> {
  if (dateKeys.length === 0) return [];
  const db = getDb();
  const placeholders = dateKeys.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT * FROM reservations WHERE status = 'CONFIRMED' AND deleted_at IS NULL AND date_key IN (${placeholders})`,
    )
    .bind(...dateKeys)
    .all<RawReservationRow>();
  return results.map(mapRow);
}

/**
 * Powers the admin's "예약 검색" box on /admin/send-confirmation — matches
 * the reservation number or the linked customer's name/email, most recent
 * first. A plain LIKE scan is fine at this data volume (single-location
 * private spa); revisit with an index only if this ever becomes a
 * measured bottleneck.
 */
export async function searchReservations(query: string, limit = 20): Promise<ReservationRecord[]> {
  const needle = `%${query}%`;
  const { results } = await getDb()
    .prepare(
      `SELECT r.* FROM reservations r
       JOIN customers c ON c.id = r.customer_id
       WHERE (r.reservation_number LIKE ? OR c.name LIKE ? OR c.email LIKE ?) AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC
       LIMIT ?`,
    )
    .bind(needle, needle, needle, limit)
    .all<RawReservationRow>();
  return results.map(mapRow);
}

/** Admin status transitions: cancel, no-show, complete. Never physically deletes reservation history. */
export async function updateStatus(id: string, status: ReservationStatus): Promise<ReservationRecord> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const result = await db.prepare("UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?").bind(status, nowIso, id).run();
  if (result.meta.changes === 0) {
    throw new BookingError("RESERVATION_NOT_FOUND", "Reservation not found.");
  }
  return (await getById(id))!;
}

/**
 * Soft-deletes a finished reservation (COMPLETED, CANCELLED, or NO_SHOW) —
 * sets deleted_at so it drops out of every admin working list
 * (listAll/listByDate/searchReservations/etc.) without physically removing
 * the row, preserving reservation history (AGENTS.md §7/§9). The server
 * re-verifies eligibility itself — existence, deletable status, not
 * already deleted — rather than trusting the caller (AGENTS.md §17); this
 * is distinct from, and never triggered by, cancellation itself (§21) —
 * deleting a CANCELLED reservation removes it from the dashboard, it does
 * not un-cancel or re-cancel it.
 */
export async function softDeleteReservation(id: string): Promise<ReservationRecord> {
  const db = getDb();
  const row = await db.prepare("SELECT * FROM reservations WHERE id = ?").bind(id).first<RawReservationRow>();
  if (!row) {
    throw new BookingError("RESERVATION_NOT_FOUND", "Reservation not found.");
  }
  if (row.deleted_at) {
    throw new BookingError("RESERVATION_ALREADY_DELETED", "This reservation has already been deleted.");
  }
  if (!DELETABLE_RESERVATION_STATUSES.includes(row.status)) {
    throw new BookingError("RESERVATION_NOT_DELETABLE", "Only completed, cancelled, or no-show reservations can be deleted.");
  }

  const nowIso = new Date().toISOString();
  await db.prepare("UPDATE reservations SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(nowIso, nowIso, id).run();
  return (await getById(id))!;
}
