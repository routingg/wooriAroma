import { NextResponse } from "next/server";
import { confirmReservation } from "@/lib/repositories/reservationRepository";
import { toPublicReservation } from "@/lib/booking/publicReservation";
import { notifyReservationConfirmed } from "@/lib/booking/notifyReservationConfirmed";
import { bookingErrorResponse } from "@/lib/booking/apiError";
import { BookingError } from "@/lib/booking/errors";

/**
 * POST /api/reservations
 *
 * Step 2 of the booking flow: confirms a HOLD into CONFIRMED once the
 * (currently mock) deposit payment has succeeded. Never called if payment
 * fails, so a failed payment can never produce a CONFIRMED reservation
 * (AGENTS.md §2, T09) — the HOLD simply expires on its own.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const holdId = typeof body?.holdId === "string" ? body.holdId : "";
    const depositTransactionId = typeof body?.depositTransactionId === "string" ? body.depositTransactionId : "";

    if (!holdId || !depositTransactionId) {
      throw new BookingError("VALIDATION_ERROR", "holdId and depositTransactionId are required.");
    }

    const reservation = confirmReservation({ holdId, depositTransactionId });

    // Fire-and-forget: never let notification delivery affect the response
    // for a reservation that has already succeeded.
    void notifyReservationConfirmed(reservation).catch((error) => {
      console.error(`[api/reservations] notification trigger failed for ${reservation.reservationNumber}`, error);
    });

    return NextResponse.json({ reservation: toPublicReservation(reservation) });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
