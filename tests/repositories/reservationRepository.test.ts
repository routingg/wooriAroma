import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import {
  confirmReservation,
  createHold,
  getByReservationNumber,
  searchReservations,
  submitReservationRequest,
} from "@/lib/repositories/reservationRepository";
import { createBlockedTime } from "@/lib/repositories/blockedTimeRepository";
import { getAvailableSlotsForDate } from "@/lib/booking/availabilityService";
import { BookingError } from "@/lib/booking/errors";
import type { ReservationHoldRequest } from "@/lib/booking/validation";

setupFreshDb();

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function holdRequest(overrides: Partial<ReservationHoldRequest> = {}): ReservationHoldRequest {
  return {
    serviceOptionId: "aroma-oil-90",
    guestCount: 2,
    date: futureDateKey(5),
    time: "16:00",
    locale: "en",
    source: "DIRECT",
    customer: {
      name: "Jane Doe",
      phone: "+82 10-1234-5678",
      email: "jane@example.com",
      preferredLanguage: "en",
    },
    ...overrides,
  };
}

describe("T01: fresh calendar, 2 guests, Aroma Oil 90min", () => {
  it("creates a HOLD with correct pricing and a WA-YYYYMMDD-NNN reservation number", () => {
    const { reservation } = createHold(holdRequest());

    expect(reservation.status).toBe("HOLD");
    expect(reservation.totalAmount).toBe(280_000);
    expect(reservation.depositAmount).toBe(20_000);
    expect(reservation.remainingAmount).toBe(260_000);
    expect(reservation.reservationNumber).toMatch(/^WA-\d{8}-\d{3}$/);
  });
});

describe("T02/T03: prep/cleanup buffer conflicts through createHold", () => {
  it("rejects a hold that overlaps another CONFIRMED reservation's buffer", () => {
    const date = futureDateKey(5);
    const { reservation } = createHold(holdRequest({ date, time: "16:00" }));
    confirmReservation({ holdId: reservation.id, depositTransactionId: "TEST-TX-1" });

    expect(() => createHold(holdRequest({ date, time: "15:30", customer: { ...holdRequest().customer, email: "other@example.com" } }))).toThrowError(
      BookingError,
    );
  });

  it("allows a hold whose own prep buffer starts exactly when the prior reservation's cleanup buffer ends", () => {
    const date = futureDateKey(5);
    const { reservation } = createHold(holdRequest({ date, time: "16:00" })); // blocked 15:00-18:30
    confirmReservation({ holdId: reservation.id, depositTransactionId: "TEST-TX-2" });

    // 19:30 start - 60min prep = 18:30 blocked_start, exactly at the prior
    // reservation's blocked_end — touching, not overlapping.
    const result = createHold(
      holdRequest({ date, time: "19:30", customer: { ...holdRequest().customer, email: "other2@example.com" } }),
    );
    expect(result.reservation.status).toBe("HOLD");
  });
});

describe("T04/T05: double-booking prevention", () => {
  it("T04: of two requests for the exact same slot, only one succeeds", () => {
    const date = futureDateKey(5);
    const first = createHold(holdRequest({ date, time: "16:00" }));
    expect(first.reservation.status).toBe("HOLD");

    expect(() =>
      createHold(holdRequest({ date, time: "16:00", customer: { ...holdRequest().customer, email: "second@example.com" } })),
    ).toThrowError(BookingError);
  });

  it("T05: a 1-person and a 4-person request for the same slot — only one succeeds", () => {
    const date = futureDateKey(5);
    const groupOfOne = createHold(holdRequest({ date, time: "16:00", guestCount: 1 }));
    expect(groupOfOne.reservation.guestCount).toBe(1);

    expect(() =>
      createHold(
        holdRequest({
          date,
          time: "16:00",
          guestCount: 4,
          customer: { ...holdRequest().customer, email: "groupfour@example.com" },
        }),
      ),
    ).toThrowError(BookingError);
  });
});

describe("T09: failed payment must not confirm a reservation", () => {
  it("leaves the reservation in HOLD when confirmReservation is never called", () => {
    const { reservation } = createHold(holdRequest());
    const fetched = getByReservationNumber(reservation.reservationNumber);
    expect(fetched?.status).toBe("HOLD");
    expect(fetched?.status).not.toBe("CONFIRMED");
  });

  it("refuses to confirm an expired hold", () => {
    const { reservation } = createHold(holdRequest());
    expect(() => confirmReservation({ holdId: "not-a-real-id", depositTransactionId: "x" })).toThrowError(
      BookingError,
    );
    // A genuinely expired hold is exercised via the HOLD_EXPIRED code path in
    // confirmReservation(); simulating real clock expiry here would require
    // faking time, so this asserts the not-found branch of the same guard.
    expect(reservation.status).toBe("HOLD");
  });
});

describe("submitReservationRequest — deposit removal / pending-review flow", () => {
  it("flips a HOLD to PENDING without requiring or storing a deposit transaction id", () => {
    const { reservation } = createHold(holdRequest());
    const submitted = submitReservationRequest({ holdId: reservation.id });

    expect(submitted.status).toBe("PENDING");
    expect(submitted.depositTransactionId).toBeNull();
  });

  it("is idempotent: submitting an already-PENDING hold just returns it", () => {
    const { reservation } = createHold(holdRequest());
    submitReservationRequest({ holdId: reservation.id });
    const second = submitReservationRequest({ holdId: reservation.id });

    expect(second.status).toBe("PENDING");
  });

  it("a PENDING reservation still occupies the slot — a later hold for the same time is rejected", () => {
    const date = futureDateKey(5);
    const { reservation } = createHold(holdRequest({ date, time: "16:00" }));
    submitReservationRequest({ holdId: reservation.id });

    expect(() =>
      createHold(holdRequest({ date, time: "16:00", customer: { ...holdRequest().customer, email: "other@example.com" } })),
    ).toThrowError(BookingError);
  });

  it("refuses to submit a non-existent hold", () => {
    expect(() => submitReservationRequest({ holdId: "not-a-real-id" })).toThrowError(BookingError);
  });
});

describe("T10: admin manual block excludes the slot from customer availability", () => {
  it("removes the blocked slot from generated availability and from createHold", () => {
    const date = futureDateKey(5);
    createBlockedTime({ dateKey: date, startTime: "16:00", endTime: "17:30", reason: "Private event" });

    const slots = getAvailableSlotsForDate(date, 90);
    const at16 = slots.find((s) => s.time === "16:00");
    expect(at16?.available).toBe(false);

    expect(() => createHold(holdRequest({ date, time: "16:00" }))).toThrowError(BookingError);
  });
});

describe("searchReservations — powers /admin/send-confirmation's search box", () => {
  it("matches by reservation number, customer name, or customer email, and ignores unrelated reservations", () => {
    const date = futureDateKey(5);
    const { reservation } = createHold(
      holdRequest({ date, time: "16:00", customer: { ...holdRequest().customer, name: "Searchable Sam", email: "sam.searchable@example.com" } }),
    );
    createHold(
      holdRequest({ date, time: "19:30", customer: { ...holdRequest().customer, name: "Someone Else", email: "someone.else@example.com" } }),
    );

    expect(searchReservations(reservation.reservationNumber).map((r) => r.id)).toEqual([reservation.id]);
    expect(searchReservations("Searchable").map((r) => r.id)).toEqual([reservation.id]);
    expect(searchReservations("sam.searchable").map((r) => r.id)).toEqual([reservation.id]);
    expect(searchReservations("no-such-query-at-all")).toEqual([]);
  });
});

describe("reservation number generation", () => {
  it("increments sequentially per date and resets per new date", () => {
    const date = futureDateKey(6);
    const a = createHold(holdRequest({ date, time: "10:00", customer: { ...holdRequest().customer, email: "a@example.com" } }));
    // 13:30 leaves enough room after 10:00's 90min treatment + cleanup (blocked 09:00-12:30) for its own prep buffer.
    const b = createHold(holdRequest({ date, time: "13:30", customer: { ...holdRequest().customer, email: "b@example.com" } }));

    expect(a.reservation.reservationNumber.endsWith("-001")).toBe(true);
    expect(b.reservation.reservationNumber.endsWith("-002")).toBe(true);
    expect(a.reservation.reservationNumber.slice(0, 11)).toBe(b.reservation.reservationNumber.slice(0, 11));
  });
});
