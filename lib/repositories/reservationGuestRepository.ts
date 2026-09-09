import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";

export interface ReservationGuestRow {
  guestIndex: number;
  serviceOptionId: string;
  pricePerPerson: number;
}

interface RawReservationGuestRow {
  guest_index: number;
  service_option_id: string;
  price_per_person: number;
}

/**
 * Builds one INSERT statement per guest for `reservation_guests`, meant to
 * ride in the same `db.batch()` as the `reservations` INSERT that may or
 * may not actually happen (createHold's conditional insert no-ops on a
 * slot conflict). Each statement is itself conditional on the reservation
 * row existing — a plain unconditional INSERT here would violate the
 * `reservation_id` FOREIGN KEY (and, since D1 batches are transactional,
 * roll back the whole batch including the customer insert) whenever the
 * reservation insert no-oped.
 */
export function buildReservationGuestStatements(
  reservationId: string,
  guests: { serviceOptionId: string; pricePerPerson: number }[],
  nowIso: string,
): D1PreparedStatement[] {
  const db = getDb();
  return guests.map((guest, index) =>
    db
      .prepare(
        `INSERT INTO reservation_guests (id, reservation_id, guest_index, service_option_id, price_per_person, created_at)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM reservations WHERE id = ?)`,
      )
      .bind(randomUUID(), reservationId, index + 1, guest.serviceOptionId, guest.pricePerPerson, nowIso, reservationId),
  );
}

/** Per-guest treatment breakdown for a reservation, in guest order. Empty for reservations created before this table existed — callers fall back to the reservation's own service_option_id/price_per_person in that case. */
export async function listReservationGuests(reservationId: string): Promise<ReservationGuestRow[]> {
  const { results } = await getDb()
    .prepare(`SELECT guest_index, service_option_id, price_per_person FROM reservation_guests WHERE reservation_id = ? ORDER BY guest_index`)
    .bind(reservationId)
    .all<RawReservationGuestRow>();

  return results.map((row) => ({
    guestIndex: row.guest_index,
    serviceOptionId: row.service_option_id,
    pricePerPerson: row.price_per_person,
  }));
}
