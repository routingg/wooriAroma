import { BOOKING_STEPS, emptyBookingDraft, type BookingDraft, type BookingDetailsDraft } from "@/types/bookingState";

export const BOOKING_STORAGE_KEY = "wa_booking_draft";
export const BOOKING_SESSION_KEY = "wa_booking_session";
export const BOOKING_SESSION_TTL_MS = 30 * 60 * 1000;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function read(storage: DraftStorage | undefined, key: string): unknown {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function write(storage: DraftStorage | undefined, key: string, value: unknown): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Browsers may block storage; booking can continue in memory.
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function selections(value: unknown) {
  const input = record(value);
  const step = BOOKING_STEPS.find((candidate) => candidate === input.step) ?? "guests";
  return {
    step: step === "review" || step === "submit" || step === "confirmation" ? "details" as const : step,
    guestCount: typeof input.guestCount === "number" && Number.isInteger(input.guestCount) && input.guestCount >= 1 && input.guestCount <= 4
      ? input.guestCount : null,
    serviceId: typeof input.serviceId === "string" ? input.serviceId : null,
    serviceOptionId: typeof input.serviceOptionId === "string" ? input.serviceOptionId : null,
    date: typeof input.date === "string" ? input.date : null,
    time: typeof input.time === "string" ? input.time : null,
  };
}

function details(value: unknown): BookingDetailsDraft | null {
  const input = record(value);
  if (!["name", "phone", "email", "specialRequest"].every((key) => typeof input[key] === "string")) return null;
  const preferredLanguage = ["ko", "en", "ja", "zh"].find((locale) => locale === input.preferredLanguage);
  if (!preferredLanguage) return null;
  return {
    name: input.name as string,
    phone: input.phone as string,
    email: input.email as string,
    specialRequest: input.specialRequest as string,
    preferredLanguage: preferredLanguage as BookingDetailsDraft["preferredLanguage"],
  };
}

/** Durable storage contains choices only. Contact details expire within this tab. */
export function loadBookingDraft(
  local: DraftStorage | undefined,
  session: DraftStorage | undefined,
  now = Date.now(),
): BookingDraft {
  const choices = selections(read(local, BOOKING_STORAGE_KEY));
  // Rewrite legacy full drafts immediately, removing contact data and booking numbers.
  write(local, BOOKING_STORAGE_KEY, choices);
  const saved = record(read(session, BOOKING_SESSION_KEY));
  if (typeof saved.expiresAt !== "number" || saved.expiresAt <= now || saved.expiresAt > now + BOOKING_SESSION_TTL_MS) {
    write(session, BOOKING_SESSION_KEY, null);
    return { ...emptyBookingDraft, ...choices };
  }
  const draft = record(saved.draft);
  return {
    ...emptyBookingDraft,
    ...selections(draft),
    step: BOOKING_STEPS.find((step) => step === draft.step) ?? "guests",
    details: details(draft.details),
    reservationNumber: typeof draft.reservationNumber === "string" ? draft.reservationNumber : null,
  };
}

export function saveBookingDraft(
  draft: BookingDraft,
  local: DraftStorage | undefined,
  session: DraftStorage | undefined,
  now = Date.now(),
): void {
  write(local, BOOKING_STORAGE_KEY, selections(draft));
  write(session, BOOKING_SESSION_KEY, draft.details || draft.reservationNumber
    ? { expiresAt: now + BOOKING_SESSION_TTL_MS, draft }
    : null);
}
