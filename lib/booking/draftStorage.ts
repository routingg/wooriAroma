import { MESSENGER_APPS } from "@/lib/booking/messenger";
import { BOOKING_STEPS, emptyBookingDraft, type BookingDraft, type BookingDetailsDraft } from "@/types/bookingState";

export const BOOKING_STORAGE_KEY = "wa_booking_draft";
export const BOOKING_SESSION_KEY = "wa_booking_session";
export const BOOKING_SESSION_TTL_MS = 30 * 60 * 1000;
/** How long an abandoned (never submitted) draft's choices survive in localStorage before a fresh visit starts clean. */
export const BOOKING_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

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
  // The messenger pair is absent from drafts written before it existed, so it
  // falls back to empty rather than invalidating the whole draft.
  const messengerApp = MESSENGER_APPS.find((app) => app === input.messengerApp) ?? "";
  return {
    name: input.name as string,
    phone: input.phone as string,
    email: input.email as string,
    messengerApp,
    messengerHandle: messengerApp && typeof input.messengerHandle === "string" ? input.messengerHandle : "",
    specialRequest: input.specialRequest as string,
    preferredLanguage: preferredLanguage as BookingDetailsDraft["preferredLanguage"],
  };
}

type Choices = ReturnType<typeof selections>;

/** Reads persisted choices, treating anything older than BOOKING_DRAFT_TTL_MS (or in the legacy unwrapped shape) as expired. */
function readChoices(storage: DraftStorage | undefined, now: number): Choices {
  const raw = record(read(storage, BOOKING_STORAGE_KEY));
  const savedAt = typeof raw.savedAt === "number" ? raw.savedAt : null;
  if (savedAt === null || savedAt > now || now - savedAt > BOOKING_DRAFT_TTL_MS) {
    write(storage, BOOKING_STORAGE_KEY, null);
    return selections(null);
  }
  return selections(raw.choices);
}

/** `choices: null` clears storage outright — used once a reservation completes, so a later visit starts clean. */
function writeChoices(storage: DraftStorage | undefined, choices: Choices | null, now: number): void {
  write(storage, BOOKING_STORAGE_KEY, choices ? { savedAt: now, choices } : null);
}

/** Durable storage contains choices only. Contact details expire within this tab. */
export function loadBookingDraft(
  local: DraftStorage | undefined,
  session: DraftStorage | undefined,
  now = Date.now(),
): BookingDraft {
  const choices = readChoices(local, now);
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
  // A completed booking (reservation number issued, or the confirmation
  // step reached) clears the durable choices right away, rather than
  // waiting for the customer to click "book another" — otherwise the next
  // visit resumes mid-wizard with a stale, already-booked date/time.
  const completed = draft.step === "confirmation" || draft.reservationNumber !== null;
  writeChoices(local, completed ? null : selections(draft), now);
  write(session, BOOKING_SESSION_KEY, draft.details || draft.reservationNumber
    ? { expiresAt: now + BOOKING_SESSION_TTL_MS, draft }
    : null);
}
