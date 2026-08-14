import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { submitReservationRequest } from "@/lib/repositories/reservationRepository";
import { toPublicReservation } from "@/lib/booking/publicReservation";
import { notifyReservationRequestReceived } from "@/lib/booking/reservationNotifications";
import { bookingErrorResponse } from "@/lib/booking/apiError";
import { BookingError } from "@/lib/booking/errors";

/**
 * POST /api/reservations
 *
 * Step 2 of the booking flow: submits a HOLD as a PENDING reservation
 * request once the customer confirms their details. No payment/deposit is
 * collected (AGENTS.md deposit removal) — the reservation only becomes
 * CONFIRMED later, when an admin reviews and approves it (see
 * app/admin/reservations/[id]/actions.ts). A customer who never reaches
 * this step simply leaves the HOLD to expire on its own.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { holdId?: unknown } | null;
    const holdId = typeof body?.holdId === "string" ? body.holdId : "";

    if (!holdId) {
      throw new BookingError("VALIDATION_ERROR", "holdId is required.");
    }

    const reservation = await submitReservationRequest({ holdId });

    // Fire-and-forget: never let notification delivery affect the response
    // for a reservation that has already succeeded. Registered with
    // ctx.waitUntil() so Workers doesn't tear it down once this response
    // is sent.
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(
      notifyReservationRequestReceived(reservation).catch((error) => {
        console.error(`[api/reservations] notification trigger failed for ${reservation.reservationNumber}`, error);
      }),
    );

    return NextResponse.json({ reservation: await toPublicReservation(reservation) });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
