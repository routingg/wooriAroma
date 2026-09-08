import { describe, expect, it } from "vitest";
import { BOOKING_SESSION_KEY, BOOKING_SESSION_TTL_MS, BOOKING_STORAGE_KEY, loadBookingDraft, saveBookingDraft } from "@/lib/booking/draftStorage";
import { emptyBookingDraft, type BookingDraft } from "@/types/bookingState";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

const draft: BookingDraft = {
  ...emptyBookingDraft,
  step: "confirmation", guestCount: 2, serviceId: "aroma-oil", serviceOptionId: "aroma-oil-90",
  date: "2026-12-12", time: "16:00", reservationNumber: "WA-20261212-001",
  details: { name: "Private Guest", email: "private@example.com", phone: "+821012345678", preferredLanguage: "en", specialRequest: "Private request" },
};

describe("booking draft privacy", () => {
  it("persists only choices durably and restores contact details only within the current tab session", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    saveBookingDraft(draft, local, session, 1_000);
    const durable = JSON.parse(local.getItem(BOOKING_STORAGE_KEY)!);
    expect(durable).toMatchObject({ guestCount: 2, serviceOptionId: "aroma-oil-90", date: draft.date, time: draft.time });
    expect(durable).not.toHaveProperty("details");
    expect(durable).not.toHaveProperty("reservationNumber");
    expect(local.getItem(BOOKING_STORAGE_KEY)).not.toContain("Private");
    expect(loadBookingDraft(local, session, 2_000)).toEqual(draft);
    expect(loadBookingDraft(local, memoryStorage(), 2_000)).toMatchObject({ details: null, reservationNumber: null, step: "details" });
  });

  it("removes personal data from a legacy localStorage draft before returning", () => {
    const local = memoryStorage();
    local.setItem(BOOKING_STORAGE_KEY, JSON.stringify({ ...draft, extraPrivateData: "secret" }));
    const restored = loadBookingDraft(local, memoryStorage(), 1_000);
    expect(restored.details).toBeNull();
    expect(restored.reservationNumber).toBeNull();
    expect(restored.serviceOptionId).toBe(draft.serviceOptionId);
    const durable = local.getItem(BOOKING_STORAGE_KEY)!;
    for (const value of ["Private", "private@example.com", "+821012345678", "WA-20261212-001", "secret"]) {
      expect(durable).not.toContain(value);
    }
  });

  it("discards expired session contact data and clears it when booking resets", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    saveBookingDraft(draft, local, session, 1_000);
    expect(loadBookingDraft(local, session, 1_000 + BOOKING_SESSION_TTL_MS).details).toBeNull();
    expect(session.getItem(BOOKING_SESSION_KEY)).toBeNull();
    saveBookingDraft(draft, local, session, 2_000);
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
    expect(() => saveBookingDraft(draft, blocked, blocked)).not.toThrow();
  });
});
