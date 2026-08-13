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

describe("validateReservationHoldRequest", () => {
  it("accepts a well-formed request", () => {
    const result = validateReservationHoldRequest({
      serviceOptionId: "aroma-oil-90",
      guestCount: 2,
      date: futureDateKey(3),
      time: "16:00",
      locale: "en",
      customer: validCustomer,
    });
    expect(result.serviceOptionId).toBe("aroma-oil-90");
    expect(result.guestCount).toBe(2);
  });

  it("T07: rejects 5 guests instead of silently capping or auto-confirming", () => {
    expect(() =>
      validateReservationHoldRequest({
        serviceOptionId: "aroma-oil-90",
        guestCount: 5,
        date: futureDateKey(3),
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      }),
    ).toThrowError(BookingError);

    try {
      validateReservationHoldRequest({
        serviceOptionId: "aroma-oil-90",
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
        serviceOptionId: "facial-999", // does not exist in data/services.ts
        guestCount: 1,
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
        serviceOptionId: "aroma-oil-90",
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
        serviceOptionId: "aroma-oil-90",
        guestCount: 1,
        date: "2020-01-01",
        time: "16:00",
        locale: "en",
        customer: validCustomer,
      }),
    ).toThrowError(BookingError);
  });
});
