import { NextResponse } from "next/server";
import { getServiceOption } from "@/data/services";
import { getAvailableSlotsForDate } from "@/lib/booking/availabilityService";
import { isDateKeyPast } from "@/lib/booking/timezone";
import { bookingErrorResponse } from "@/lib/booking/apiError";
import { BookingError } from "@/lib/booking/errors";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/availability?date=YYYY-MM-DD&serviceOptionId=aroma-oil-90
 *
 * Server-authoritative slot list — see lib/booking/availabilityService.ts.
 * The client must treat this as informational only; the real conflict check
 * happens again inside POST /api/reservation-holds.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? "";
    const serviceOptionId = url.searchParams.get("serviceOptionId") ?? "";

    if (!DATE_KEY_PATTERN.test(date)) {
      throw new BookingError("INVALID_DATE", "date must be formatted YYYY-MM-DD.");
    }

    const option = getServiceOption(serviceOptionId);
    if (!option) {
      throw new BookingError("SERVICE_NOT_BOOKABLE", "Unknown or unpublished service option.");
    }

    if (isDateKeyPast(date)) {
      return NextResponse.json({ slots: [] });
    }

    const slots = await getAvailableSlotsForDate(date, option.durationMinutes);
    return NextResponse.json({ slots });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
