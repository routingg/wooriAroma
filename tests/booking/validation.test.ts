import { describe, expect, it } from "vitest";
import { validateReservationHoldRequest } from "@/lib/booking/validation";
import { BookingError } from "@/lib/booking/errors";

const validCustomer = {
  name: "Jane Doe",
  phone: "+82 10-1234-5678",
  email: "jane@example.com",
  preferredLanguage: "en",
};

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function guestsOf(serviceOptionId: string, count: number) {
  return Array.from({ length: count }, () => ({ serviceOptionId }));
}

describe("validateReservationHoldRequest", () => {
  it("accepts a well-formed request", () => {
    const result = validateReservationHoldRequest({
      guests: guestsOf("aroma-oil-90", 2),
      guestCount: 2,
      date: futureDateKey(3),
      time: "16:00",
      locale: "en",
      customer: validCustomer,
    });
    expect(result.guests).toEqual([{ serviceOptionId: "aroma-oil-90" }, { serviceOptionId: "aroma-oil-90" }]);
    expect(result.guestCount).toBe(2);
  });

  it("T07: rejects 5 guests instead of silently capping or auto-confirming", () => {
    expect(() =>
      validateReservationHoldRequest({
        guests: guestsOf("aroma-oil-90", 5),
        guestCount: 5,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      }),
    ).toThrowError(BookingError);

    try {
      validateReservationHoldRequest({
        guests: guestsOf("aroma-oil-90", 5),
        guestCount: 5,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BookingError);
      expect((error as BookingError).code).toBe("INVALID_GUEST_COUNT");
    }
  });

  it("T08: rejects an unknown/unpublished service option", () => {
    expect(() =>
      validateReservationHoldRequest({
        guests: guestsOf("facial-999", 1), // does not exist in data/services.ts
        guestCount: 1,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      }),
    ).toThrowError(BookingError);
  });

  it("rejects guests whose treatments don't all share the same duration", () => {
    expect(() =>
      validateReservationHoldRequest({
        guests: [{ serviceOptionId: "aroma-oil-60" }, { serviceOptionId: "aroma-oil-90" }],
        guestCount: 2,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      }),
    ).toThrowError(BookingError);

    try {
      validateReservationHoldRequest({
        guests: [{ serviceOptionId: "aroma-oil-60" }, { serviceOptionId: "aroma-oil-90" }],
        guestCount: 2,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BookingError);
      expect((error as BookingError).code).toBe("MIXED_DURATION_NOT_ALLOWED");
    }
  });

  it("rejects a guests array whose length doesn't match guestCount", () => {
    expect(() =>
      validateReservationHoldRequest({
        guests: guestsOf("aroma-oil-90", 1),
        guestCount: 2,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      }),
    ).toThrowError(BookingError);
  });

  it("rejects an invalid email/phone instead of silently accepting bad contact info", () => {
    expect(() =>
      validateReservationHoldRequest({
        guests: guestsOf("aroma-oil-90", 1),
        guestCount: 1,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: { ...validCustomer, email: "not-an-email" },
      }),
    ).toThrowError(BookingError);
  });

  it("rejects a past date", () => {
    expect(() =>
      validateReservationHoldRequest({
        guests: guestsOf("aroma-oil-90", 1),
        guestCount: 1,
        date: "2020-01-01",
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      }),
    ).toThrowError(BookingError);
  });
});
