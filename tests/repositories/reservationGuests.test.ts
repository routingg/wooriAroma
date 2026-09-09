import { describe, expect, it } from "vitest";
import { sameGuests, setupFreshDb } from "../dbTestUtils";
import { createHold } from "@/lib/repositories/reservationRepository";
import { listReservationGuests } from "@/lib/repositories/reservationGuestRepository";
import { BookingError } from "@/lib/booking/errors";
import type { ReservationHoldRequest } from "@/lib/booking/validation";

setupFreshDb();

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function holdRequest(overrides: Partial<ReservationHoldRequest> = {}): ReservationHoldRequest {
  const guestCount = overrides.guestCount ?? 2;
  return {
    guests: sameGuests("aroma-oil-90", guestCount),
    guestCount,
    date: futureDateKey(5),
    time: "16:00",
    locale: "en",
    source: "DIRECT",
    customer: { name: "Jane Doe", phone: "+82 10-1234-5678", email: "jane@example.com", preferredLanguage: "en" },
    ...overrides,
  };
}

describe("createHold — per-guest treatments", () => {
  it("persists one reservation_guests row per guest, even when every guest chose the same course", async () => {
    const { reservation } = await createHold(holdRequest({ guestCount: 2 }));

    const guests = await listReservationGuests(reservation.id);
    expect(guests).toEqual([
      { guestIndex: 1, serviceOptionId: "aroma-oil-90", pricePerPerson: 140_000 },
      { guestIndex: 2, serviceOptionId: "aroma-oil-90", pricePerPerson: 140_000 },
    ]);
    expect(reservation.totalAmount).toBe(280_000);
  });

  it("sums each guest's own price when guests choose different treatments of the same duration", async () => {
    const { reservation } = await createHold(
      holdRequest({
        guestCount: 2,
        guests: [{ serviceOptionId: "aroma-oil-90" }, { serviceOptionId: "thai-massage-90" }],
      }),
    );

    const guests = await listReservationGuests(reservation.id);
    expect(guests).toEqual([
      { guestIndex: 1, serviceOptionId: "aroma-oil-90", pricePerPerson: 140_000 },
      { guestIndex: 2, serviceOptionId: "thai-massage-90", pricePerPerson: 110_000 },
    ]);
    // 140,000 + 110,000 — not 140,000 * 2, confirming pricing is per-guest, not the anchor option times guestCount.
    expect(reservation.totalAmount).toBe(250_000);
    expect(reservation.durationMinutes).toBe(90);
    expect(reservation.serviceOptionId).toBe("aroma-oil-90"); // guest 1 anchors the shared columns
  });

  it("rejects guests whose treatments don't share the same duration, without writing anything", async () => {
    await expect(
      createHold(
        holdRequest({
          guestCount: 2,
          guests: [{ serviceOptionId: "aroma-oil-60" }, { serviceOptionId: "aroma-oil-90" }],
        }),
      ),
    ).rejects.toThrowError(BookingError);
  });

  it("never writes reservation_guests rows when the slot conflict causes the reservation insert to no-op", async () => {
    const date = futureDateKey(6);
    const first = await createHold(holdRequest({ date, time: "12:00" }));

    await expect(
      createHold(
        holdRequest({ date, time: "12:00", customer: { ...holdRequest().customer, email: "conflict@example.com" } }),
      ),
    ).rejects.toThrowError(BookingError);

    // The conflicting attempt's guest rows must never appear under the first reservation's id either.
    const guests = await listReservationGuests(first.reservation.id);
    expect(guests).toHaveLength(2);
  });
});
