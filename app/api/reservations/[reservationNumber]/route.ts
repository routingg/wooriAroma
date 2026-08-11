import { NextResponse } from "next/server";
import { getByReservationNumber } from "@/lib/repositories/reservationRepository";
import { toPublicReservation } from "@/lib/booking/publicReservation";
import { BookingError } from "@/lib/booking/errors";
import { bookingErrorResponse } from "@/lib/booking/apiError";

/**
 * GET /api/reservations/:reservationNumber
 *
 * Returns a privacy-trimmed view (see toPublicReservation) — no phone/email.
 * An unauthenticated lookup by number is acceptable for "show my own
 * confirmation again" since only the customer who just booked sees the
 * number; it is NOT sufficient authorization for the future Gemini agent to
 * read someone else's reservation — see lib/agent/tools.ts's getReservation
 * for the additional identity check that enforces that (AGENTS.md §16.2, T11).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reservationNumber: string }> },
) {
  try {
    const { reservationNumber } = await params;
    const reservation = getByReservationNumber(reservationNumber);
    if (!reservation) {
      throw new BookingError("RESERVATION_NOT_FOUND", "No reservation with that number was found.");
    }
    return NextResponse.json({ reservation: toPublicReservation(reservation) });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
