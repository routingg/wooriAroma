import { NextResponse } from "next/server";
import { validateReservationHoldRequest } from "@/lib/booking/validation";
import { createHold } from "@/lib/repositories/reservationRepository";
import { bookingErrorResponse } from "@/lib/booking/apiError";

/**
 * POST /api/reservation-holds
 *
 * Step 1 of the double-booking-safe flow (AGENTS.md §10): re-validates and
 * re-checks availability against the database, then atomically inserts a
 * time-limited HOLD. The customer's deposit payment happens against this
 * hold's reservationNumber; POST /api/reservations then confirms it once
 * payment succeeds. See createHold() for the transactional guarantee.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateReservationHoldRequest(body);
    const { reservation } = await createHold(validated);

    return NextResponse.json(
      {
        holdId: reservation.id,
        reservationNumber: reservation.reservationNumber,
        status: reservation.status,
        holdExpiresAt: reservation.holdExpiresAt,
        dateKey: reservation.dateKey,
        serviceStart: reservation.serviceStart,
        serviceEnd: reservation.serviceEnd,
        pricing: {
          pricePerPerson: reservation.pricePerPerson,
          totalAmount: reservation.totalAmount,
          depositAmount: reservation.depositAmount,
          remainingAmount: reservation.remainingAmount,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
