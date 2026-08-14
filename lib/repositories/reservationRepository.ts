import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { withTransaction } from "@/lib/db/transaction";
import { getServiceOption } from "@/data/services";
import type { AppLocale } from "@/i18n/routing";
import { calculateBlockedTime, checkBookingConflict, type BlockedWindow } from "@/lib/booking/availability";
import { fromMinutes, toMinutes } from "@/lib/booking/time";
import { calculateDepositAmount, calculateRemainingAmount, calculateTotalAmount } from "@/lib/booking/pricing";
import { BookingError } from "@/lib/booking/errors";
import { nextReservationNumber } from "@/lib/booking/reservationNumber";
import type { ReservationHoldRequest } from "@/lib/booking/validation";
import { upsertCustomer, type CustomerRecord } from "./customerRepository";
import { getAdminBlockedWindows } from "./blockedTimeRepository";
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
 * `excludeReservationId` lets submitReservationRequest()/confirmReservation()
 * re-check without conflicting with their own hold.
 */
export function getActiveBlockedWindows(dateKey: string, excludeReservationId?: string): BlockedWindow[] {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const rows = excludeReservationId
    ? (db
        .prepare(
          `SELECT blocked_start, blocked_end FROM reservations
           WHERE date_key = ? AND id != ? AND (status IN ('CONFIRMED','PENDING') OR (status = 'HOLD' AND hold_expires_at > ?))`,
        )
        .all(dateKey, excludeReservationId, nowIso) as { blocked_start: string; blocked_end: string }[])
    : (db
        .prepare(
          `SELECT blocked_start, blocked_end FROM reservations
           WHERE date_key = ? AND (status IN ('CONFIRMED','PENDING') OR (status = 'HOLD' AND hold_expires_at > ?))`,
        )
        .all(dateKey, nowIso) as { blocked_start: string; blocked_end: string }[]);

  return rows.map((r) => ({ start: r.blocked_start, end: r.blocked_end }));
}

export interface CreateHoldResult {
  reservation: ReservationRecord;
  customer: CustomerRecord;
}

/**
 * Server-authoritative slot lock. Re-derives price and the blocked window
 * from trusted server data (never from the client), re-checks conflicts
 * against every active reservation and admin block for the date, and only
 * then inserts — all inside one transaction, so two near-simultaneous
 * requests for the same slot can never both succeed (see
 * lib/db/transaction.ts). Throws BookingError("SLOT_UNAVAILABLE", ...) if
 * the slot is already taken.
 */
export function createHold(request: ReservationHoldRequest): CreateHoldResult {
  const db = getDb();
  const option = getServiceOption(request.serviceOptionId);
  if (!option) {
    throw new BookingError("SERVICE_NOT_BOOKABLE", "Unknown or unpublished service option.");
  }

  return withTransaction(db, () => {
    const now = new Date();
    const nowIso = now.toISOString();

    const serviceEnd = fromMinutes(toMinutes(request.time) + option.durationMinutes);
    const blocked = calculateBlockedTime(request.time, serviceEnd);

    const existingWindows = [...getActiveBlockedWindows(request.date), ...getAdminBlockedWindows(request.date)];

    if (checkBookingConflict(blocked, existingWindows)) {
      throw new BookingError("SLOT_UNAVAILABLE", "This time is no longer available. Please choose another slot.");
    }

    const customer = upsertCustomer({
      name: request.customer.name,
      phone: request.customer.phone,
      email: request.customer.email,
      preferredLanguage: request.customer.preferredLanguage,
    });

    const totalAmount = calculateTotalAmount(option.pricePerPerson, request.guestCount);
    const depositAmount = calculateDepositAmount(request.guestCount);
    const remainingAmount = calculateRemainingAmount(totalAmount, depositAmount);

    const reservationNumber = nextReservationNumber(db, request.date);
    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
    const id = randomUUID();

    db.prepare(
      `INSERT INTO reservations (
        id, reservation_number, customer_id, service_option_id, duration_minutes, guest_count,
        date_key, service_start, service_end, blocked_start, blocked_end,
        price_per_person, total_amount, deposit_amount, remaining_amount,
        status, hold_expires_at, special_requests, source, locale, deposit_transaction_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HOLD', ?, ?, ?, ?, NULL, ?, ?)`,
    ).run(
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
    );

    return { reservation: getById(id)!, customer };
  });
}

export interface SubmitReservationInput {
  holdId: string;
}

/**
 * Flips a HOLD to PENDING once the customer submits their reservation
 * request — no deposit/payment is collected (AGENTS.md deposit removal).
 * This is what the customer booking flow calls; the reservation only
 * becomes CONFIRMED later, when an admin reviews and approves it (see
 * app/admin/reservations/[id]/actions.ts). Mirrors confirmReservation()'s
 * hold-expiry/conflict re-check (an admin block could have been added after
 * the hold was created) inside the same transaction as the update.
 * Idempotent: submitting an already-PENDING or already-CONFIRMED hold just
 * returns it, so a client retry after a dropped response can't error.
 */
export function submitReservationRequest(input: SubmitReservationInput): ReservationRecord {
  const db = getDb();

  return withTransaction(db, () => {
    const row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(input.holdId) as
      | RawReservationRow
      | undefined;
    if (!row) {
      throw new BookingError("HOLD_NOT_FOUND", "Reservation hold not found.");
    }
    if (row.status === "PENDING" || row.status === "CONFIRMED") {
      return mapRow(row);
    }
    if (row.status !== "HOLD") {
      throw new BookingError("HOLD_EXPIRED", `Reservation is ${row.status.toLowerCase()}, not submittable.`);
    }

    const nowIso = new Date().toISOString();
    if (!row.hold_expires_at || row.hold_expires_at <= nowIso) {
      throw new BookingError("HOLD_EXPIRED", "This hold has expired. Please choose a time again.");
    }

    const candidate: BlockedWindow = { start: row.blocked_start, end: row.blocked_end };
    const otherWindows = [
      ...getActiveBlockedWindows(row.date_key, row.id),
      ...getAdminBlockedWindows(row.date_key),
    ];
    if (checkBookingConflict(candidate, otherWindows)) {
      throw new BookingError("SLOT_UNAVAILABLE", "This time is no longer available.");
    }

    db.prepare(`UPDATE reservations SET status = 'PENDING', hold_expires_at = NULL, updated_at = ? WHERE id = ?`).run(
      nowIso,
      input.holdId,
    );

    return getById(input.holdId)!;
  });
}

export interface ConfirmReservationInput {
  holdId: string;
  depositTransactionId: string;
}

/**
 * Flips a HOLD to CONFIRMED after the deposit payment succeeds. Re-checks
 * expiry and conflicts one more time (an admin block could have been added
 * after the hold was created) inside the same transaction as the update.
 * Idempotent: confirming an already-CONFIRMED hold just returns it, so a
 * client retry after a dropped response can't double-charge or error.
 */
export function confirmReservation(input: ConfirmReservationInput): ReservationRecord {
  const db = getDb();

  return withTransaction(db, () => {
    const row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(input.holdId) as
      | RawReservationRow
      | undefined;
    if (!row) {
      throw new BookingError("HOLD_NOT_FOUND", "Reservation hold not found.");
    }
    if (row.status === "CONFIRMED") {
      return mapRow(row);
    }
    if (row.status !== "HOLD") {
      throw new BookingError("HOLD_EXPIRED", `Reservation is ${row.status.toLowerCase()}, not confirmable.`);
    }

    const nowIso = new Date().toISOString();
    if (!row.hold_expires_at || row.hold_expires_at <= nowIso) {
      throw new BookingError("HOLD_EXPIRED", "This hold has expired. Please choose a time again.");
    }

    const candidate: BlockedWindow = { start: row.blocked_start, end: row.blocked_end };
    const otherWindows = [
      ...getActiveBlockedWindows(row.date_key, row.id),
      ...getAdminBlockedWindows(row.date_key),
    ];
    if (checkBookingConflict(candidate, otherWindows)) {
      throw new BookingError("SLOT_UNAVAILABLE", "This time is no longer available.");
    }

    db.prepare(
      `UPDATE reservations SET status = 'CONFIRMED', hold_expires_at = NULL, deposit_transaction_id = ?, updated_at = ?
       WHERE id = ?`,
    ).run(input.depositTransactionId, nowIso, input.holdId);

    return getById(input.holdId)!;
  });
}

export function getById(id: string): ReservationRecord | undefined {
  const row = getDb().prepare("SELECT * FROM reservations WHERE id = ?").get(id) as RawReservationRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function getByReservationNumber(reservationNumber: string): ReservationRecord | undefined {
  const row = getDb()
    .prepare("SELECT * FROM reservations WHERE reservation_number = ?")
    .get(reservationNumber) as RawReservationRow | undefined;
  return row ? mapRow(row) : undefined;
}

/** Excludes soft-deleted rows — every reservation-list function below is an admin-facing "working list" (AGENTS.md §15), never the record store itself. */
export function listByDate(dateKey: string): ReservationRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM reservations WHERE date_key = ? AND deleted_at IS NULL ORDER BY blocked_start")
    .all(dateKey) as unknown as RawReservationRow[];
  return rows.map(mapRow);
}

/** Every non-deleted reservation regardless of date — powers the admin's all-reservations list (split into upcoming/past there). */
export function listAll(statusFilter?: ReservationStatus[]): ReservationRecord[] {
  const db = getDb();
  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT * FROM reservations WHERE status IN (${placeholders}) AND deleted_at IS NULL ORDER BY date_key, blocked_start`,
      )
      .all(...statusFilter) as unknown as RawReservationRow[];
    return rows.map(mapRow);
  }
  const rows = db
    .prepare("SELECT * FROM reservations WHERE deleted_at IS NULL ORDER BY date_key, blocked_start")
    .all() as unknown as RawReservationRow[];
  return rows.map(mapRow);
}

export function listByDateRange(
  fromDateKey: string,
  toDateKey: string,
  statusFilter?: ReservationStatus[],
): ReservationRecord[] {
  const db = getDb();
  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT * FROM reservations WHERE date_key BETWEEN ? AND ? AND status IN (${placeholders}) AND deleted_at IS NULL
         ORDER BY date_key, blocked_start`,
      )
      .all(fromDateKey, toDateKey, ...statusFilter) as unknown as RawReservationRow[];
    return rows.map(mapRow);
  }
  const rows = db
    .prepare(
      "SELECT * FROM reservations WHERE date_key BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY date_key, blocked_start",
    )
    .all(fromDateKey, toDateKey) as unknown as RawReservationRow[];
  return rows.map(mapRow);
}

/**
 * CONFIRMED reservations across a small set of dateKeys — used by the 24h
 * reminder job (lib/booking/reminderService.ts), which only ever needs
 * "today" and "tomorrow" since service_start is stored as a plain "HH:mm"
 * string, not a timestamp the DB can range-filter against "now + 24h"
 * directly. Filtering down to the exact reminder window happens in JS.
 */
export function listConfirmedReservationsForDates(dateKeys: string[]): ReservationRecord[] {
  if (dateKeys.length === 0) return [];
  const db = getDb();
  const placeholders = dateKeys.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM reservations WHERE status = 'CONFIRMED' AND deleted_at IS NULL AND date_key IN (${placeholders})`,
    )
    .all(...dateKeys) as unknown as RawReservationRow[];
  return rows.map(mapRow);
}

/**
 * Powers the admin's "예약 검색" box on /admin/send-confirmation — matches
 * the reservation number or the linked customer's name/email, most recent
 * first. A plain LIKE scan is fine at this data volume (single-location
 * private spa); revisit with an index only if this ever becomes a
 * measured bottleneck.
 */
export function searchReservations(query: string, limit = 20): ReservationRecord[] {
  const needle = `%${query}%`;
  const rows = getDb()
    .prepare(
      `SELECT r.* FROM reservations r
       JOIN customers c ON c.id = r.customer_id
       WHERE (r.reservation_number LIKE ? OR c.name LIKE ? OR c.email LIKE ?) AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC
       LIMIT ?`,
    )
    .all(needle, needle, needle, limit) as unknown as RawReservationRow[];
  return rows.map(mapRow);
}

/** Admin status transitions: cancel, no-show, complete. Never physically deletes reservation history. */
export function updateStatus(id: string, status: ReservationStatus): ReservationRecord {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const result = db.prepare("UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso, id);
  if (result.changes === 0) {
    throw new BookingError("RESERVATION_NOT_FOUND", "Reservation not found.");
  }
  return getById(id)!;
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
export function softDeleteReservation(id: string): ReservationRecord {
  const db = getDb();
  const row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as RawReservationRow | undefined;
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
  db.prepare("UPDATE reservations SET deleted_at = ?, updated_at = ? WHERE id = ?").run(nowIso, nowIso, id);
  return getById(id)!;
}
