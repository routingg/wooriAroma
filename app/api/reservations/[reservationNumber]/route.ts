import { NextResponse } from "next/server";
import { getById } from "@/lib/repositories/reservationRepository";
import { toPublicReservation } from "@/lib/booking/publicReservation";
import { BookingError } from "@/lib/booking/errors";
import { bookingErrorResponse } from "@/lib/booking/apiError";

/**
 * GET /api/reservations/:reservationNumber
 *
 * Requires Authorization: Bearer <holdId>, the random UUID returned only
 * when the reservation hold was created. The sequential display number is
 * never authorization. This capability must not be put in URLs or logs.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reservationNumber: string }> },
) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)?.[1];
    if (!token) {
      throw new BookingError("RESERVATION_NOT_FOUND", "No accessible reservation was found.");
    }
    const { reservationNumber } = await params;
    const reservation = await getById(token);
    if (!reservation || reservation.reservationNumber !== reservationNumber || reservation.deletedAt) {
      throw new BookingError("RESERVATION_NOT_FOUND", "No accessible reservation was found.");
    }
    return NextResponse.json(
      { reservation: await toPublicReservation(reservation) },
      { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } },
    );
  } catch (error) {
    const response = bookingErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Authorization");
    return response;
  }
}
