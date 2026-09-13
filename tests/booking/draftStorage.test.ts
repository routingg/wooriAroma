import { describe, expect, it } from "vitest";
import {
  BOOKING_DRAFT_TTL_MS,
  BOOKING_SESSION_KEY,
  BOOKING_SESSION_TTL_MS,
  BOOKING_STORAGE_KEY,
  loadBookingDraft,
  saveBookingDraft,
} from "@/lib/booking/draftStorage";
import { emptyBookingDraft, type BookingDraft } from "@/types/bookingState";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

/** Mid-wizard: choices made, contact details entered, not yet submitted. */
const midFlowDraft: BookingDraft = {
  ...emptyBookingDraft,
  step: "details", guestCount: 2, serviceId: "aroma-oil", serviceOptionId: "aroma-oil-90",
  date: "2026-12-12", time: "16:00", reservationNumber: null,
  details: { name: "Private Guest", email: "private@example.com", phone: "+821012345678", messengerApp: "TELEGRAM", messengerHandle: "@privateguest", preferredLanguage: "en", specialRequest: "Private request" },
};

/** Same booking, after the reservation succeeded. */
const completedDraft: BookingDraft = {
  ...midFlowDraft,
  step: "confirmation",
  reservationNumber: "WA-20261212-001",
};

describe("booking draft privacy", () => {
  it("persists only choices durably and restores contact details only within the current tab session", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    saveBookingDraft(midFlowDraft, local, session, 1_000);
    const durable = JSON.parse(local.getItem(BOOKING_STORAGE_KEY)!);
    expect(durable.choices).toMatchObject({ guestCount: 2, serviceOptionId: "aroma-oil-90", date: midFlowDraft.date, time: midFlowDraft.time });
    expect(durable.choices).not.toHaveProperty("details");
    expect(durable.choices).not.toHaveProperty("reservationNumber");
    expect(local.getItem(BOOKING_STORAGE_KEY)).not.toContain("Private");
    expect(loadBookingDraft(local, session, 2_000)).toEqual(midFlowDraft);
    expect(loadBookingDraft(local, memoryStorage(), 2_000)).toMatchObject({ details: null, reservationNumber: null, step: "details" });
  });

  it("removes personal data from a legacy localStorage draft before returning", () => {
    const local = memoryStorage();
    local.setItem(BOOKING_STORAGE_KEY, JSON.stringify({ ...completedDraft, extraPrivateData: "secret" }));
    const restored = loadBookingDraft(local, memoryStorage(), 1_000);
    expect(restored.details).toBeNull();
    expect(restored.reservationNumber).toBeNull();
    const durable = local.getItem(BOOKING_STORAGE_KEY);
    if (durable !== null) {
      for (const value of ["Private", "private@example.com", "+821012345678", "@privateguest", "WA-20261212-001", "secret"]) {
        expect(durable).not.toContain(value);
      }
    }
  });

  it("clears the durable draft the moment a reservation completes, instead of waiting for an explicit reset", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    saveBookingDraft(completedDraft, local, session, 1_000);

    expect(local.getItem(BOOKING_STORAGE_KEY)).toBeNull();
    // A later visit — even within the same tab session's TTL, but with a fresh local store — starts clean.
    expect(loadBookingDraft(local, memoryStorage(), 2_000)).toEqual(emptyBookingDraft);
  });

  it("expires an abandoned draft's choices after 24 hours so a stale visit doesn't get stuck mid-wizard", () => {
    const local = memoryStorage();
    saveBookingDraft(midFlowDraft, local, memoryStorage(), 1_000);

    const justBeforeExpiry = 1_000 + BOOKING_DRAFT_TTL_MS;
    expect(loadBookingDraft(local, memoryStorage(), justBeforeExpiry).serviceOptionId).toBe(midFlowDraft.serviceOptionId);

    const afterExpiry = 1_000 + BOOKING_DRAFT_TTL_MS + 1;
    expect(loadBookingDraft(local, memoryStorage(), afterExpiry)).toEqual(emptyBookingDraft);
    expect(local.getItem(BOOKING_STORAGE_KEY)).toBeNull();
  });

  it("discards expired session contact data and clears it when booking resets", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    saveBookingDraft(completedDraft, local, session, 1_000);
    expect(loadBookingDraft(local, session, 1_000 + BOOKING_SESSION_TTL_MS).details).toBeNull();
    expect(session.getItem(BOOKING_SESSION_KEY)).toBeNull();
    saveBookingDraft(completedDraft, local, session, 2_000);
    saveBookingDraft(emptyBookingDraft, local, session, 3_000);
    expect(session.getItem(BOOKING_SESSION_KEY)).toBeNull();
  });

  it("keeps booking usable when storage is corrupt or blocked", () => {
    const local = memoryStorage();
    local.setItem(BOOKING_STORAGE_KEY, "{broken");
    expect(loadBookingDraft(local, undefined)).toEqual(emptyBookingDraft);
    const blocked = {
      getItem: () => { throw new Error("Blocked"); },
      setItem: () => { throw new Error("Blocked"); },
      removeItem: () => { throw new Error("Blocked"); },
    };
    expect(loadBookingDraft(blocked, blocked)).toEqual(emptyBookingDraft);
    expect(() => saveBookingDraft(midFlowDraft, blocked, blocked)).not.toThrow();
  });
});
