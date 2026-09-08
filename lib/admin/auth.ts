import { headers } from "next/headers";
import { checkAdminBasicAuth } from "./basicAuth";
import { BookingError } from "@/lib/booking/errors";

/** Every admin entry point must authorize before reading or changing data. */
export async function requireAdmin(): Promise<void> {
  const requestHeaders = await headers();
  if (!checkAdminBasicAuth(requestHeaders.get("authorization"))) {
    throw new BookingError("FORBIDDEN", "Administrator authentication is required.");
  }
}
