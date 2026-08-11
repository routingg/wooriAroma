import { NextResponse } from "next/server";
import { BookingError } from "./errors";

/** Shared BookingError -> HTTP response mapping for every route under app/api. */
export function bookingErrorResponse(error: unknown): NextResponse {
  if (error instanceof BookingError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.httpStatus });
  }
  console.error("[api] unexpected error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}
