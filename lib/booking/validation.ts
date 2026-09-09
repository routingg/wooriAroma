import { getServiceOption } from "@/data/services";
import { routing, type AppLocale } from "@/i18n/routing";
import { isSlotInPast } from "./availability";
import { isDateKeyPast } from "./timezone";
import { BookingError } from "./errors";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^\d{2}:\d{2}$/;
const VALID_SOURCES = [
  "GOOGLE_MAPS",
  "GOOGLE_SEARCH",
  "INSTAGRAM",
  "NAVER",
  "HOTEL",
  "DIRECT",
  "REPEAT",
] as const;

export interface ReservationHoldRequest {
  /** One entry per guest, in guest order. All entries must share the same durationMinutes (see check below) — the whole group occupies one shared time slot. */
  guests: { serviceOptionId: string }[];
  guestCount: number;
  date: string;
  time: string;
  locale: AppLocale;
  source: (typeof VALID_SOURCES)[number];
  customer: {
    name: string;
    phone: string;
    email: string;
    preferredLanguage: AppLocale;
    specialRequest?: string;
  };
}

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}

/**
 * Re-validates a reservation-hold request against server-trusted rules.
 * Never trusts client-submitted prices or availability — this only checks
 * shape/business constraints; the actual conflict check happens in
 * reservationRepository.createHold() inside the same transaction as the
 * insert.
 */
export function validateReservationHoldRequest(body: unknown): ReservationHoldRequest {
  if (typeof body !== "object" || body === null) {
    throw new BookingError("VALIDATION_ERROR", "Request body must be an object.");
  }
  const b = body as Record<string, unknown>;

  const guestCount = Number(b.guestCount);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 4) {
    throw new BookingError("INVALID_GUEST_COUNT", "Guest count must be an integer between 1 and 4.");
  }

  const guestsInput = Array.isArray(b.guests) ? b.guests : [];
  if (guestsInput.length !== guestCount) {
    throw new BookingError("VALIDATION_ERROR", "guests must have exactly one entry per guest.");
  }
  const guestOptions = guestsInput.map((g) => {
    const rawId = typeof g === "object" && g !== null ? (g as Record<string, unknown>).serviceOptionId : undefined;
    return getServiceOption(String(rawId ?? ""));
  });
  if (guestOptions.some((option) => !option)) {
    throw new BookingError("SERVICE_NOT_BOOKABLE", "Unknown or unpublished service option.");
  }
  if (new Set(guestOptions.map((option) => option!.durationMinutes)).size > 1) {
    throw new BookingError("MIXED_DURATION_NOT_ALLOWED", "All guests in a private group must share the same treatment duration.");
  }
  const guests = guestOptions.map((option) => ({ serviceOptionId: option!.id }));

  const date = String(b.date ?? "");
  if (!DATE_KEY_PATTERN.test(date)) {
    throw new BookingError("INVALID_DATE", "Date must be formatted YYYY-MM-DD.");
  }
  if (isDateKeyPast(date)) {
    throw new BookingError("SLOT_IN_PAST", "The selected date has already passed.");
  }

  const time = String(b.time ?? "");
  if (!TIME_PATTERN.test(time)) {
    throw new BookingError("INVALID_DATE", "Time must be formatted HH:mm.");
  }
  if (isSlotInPast(date, time)) {
    throw new BookingError("SLOT_IN_PAST", "The selected time has already passed.");
  }

  const locale = isAppLocale(b.locale) ? b.locale : routing.defaultLocale;

  const customerInput = (b.customer ?? {}) as Record<string, unknown>;
  const name = String(customerInput.name ?? "").trim();
  const phone = String(customerInput.phone ?? "").trim();
  const email = String(customerInput.email ?? "").trim();
  const preferredLanguage = isAppLocale(customerInput.preferredLanguage)
    ? customerInput.preferredLanguage
    : locale;
  const specialRequestRaw = customerInput.specialRequest;
  const specialRequest =
    typeof specialRequestRaw === "string" && specialRequestRaw.trim().length > 0
      ? specialRequestRaw.trim()
      : undefined;

  if (!name || !PHONE_PATTERN.test(phone) || !EMAIL_PATTERN.test(email)) {
    throw new BookingError(
      "INVALID_CUSTOMER_DETAILS",
      "Name, a valid phone number and a valid email are required.",
    );
  }

  const source = VALID_SOURCES.includes(b.source as (typeof VALID_SOURCES)[number])
    ? (b.source as (typeof VALID_SOURCES)[number])
    : "DIRECT";

  return {
    guests,
    guestCount,
    date,
    time,
    locale,
    source,
    customer: { name, phone, email, preferredLanguage, specialRequest },
  };
}
