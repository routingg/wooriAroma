import { describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

// See tests/notifications/reminderService.test.ts — getTranslations needs
// this stub to resolve outside Next.js's "react-server" bundling
// condition. getServices() below awaits it directly (unlike the
// notification paths, which are fire-and-forget), so it's required here.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import * as agentTools from "@/lib/agent/tools";
import { BookingError } from "@/lib/booking/errors";

setupFreshDb();

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const customerInput = {
  customerName: "Jane Doe",
  phoneOrWhatsapp: "+82 10-1234-5678",
  email: "jane@example.com",
};

describe("agent tools", () => {
  it("getServices returns the real catalog, not invented values", async () => {
    const services = await agentTools.getServices("en");
    expect(services.length).toBeGreaterThan(0);

    const aromaOil90 = services.find((s) => s.serviceOptionId === "aroma-oil-90");
    expect(aromaOil90).toBeDefined();
    expect(aromaOil90!.pricePerPerson).toBe(140_000);
    expect(aromaOil90!.durationMinutes).toBe(90);
    // Name/description resolve through next-intl (see the getTranslations
    // stub above) — this asserts the real key is looked up, not that the
    // stub's passthrough text is meaningful.
    expect(aromaOil90!.name).toBe("aromaOil.name");
  });

  it("getAvailability mirrors the real availability API and reuses existing booking rules", async () => {
    const date = futureDateKey(5);
    const slots = await agentTools.getAvailability({ date, serviceOptionId: "aroma-oil-90", partySize: 2 });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.some((s) => s.available)).toBe(true);
  });

  it("getAvailability rejects an unknown service option instead of guessing availability", async () => {
    await expect(
      agentTools.getAvailability({ date: futureDateKey(5), serviceOptionId: "does-not-exist", partySize: 2 }),
    ).rejects.toThrowError(BookingError);
  });

  it("calculatePrice reuses the real pricing logic and never mentions a deposit", () => {
    const price = agentTools.calculatePrice({ serviceOptionId: "aroma-oil-90", partySize: 2 });
    expect(price.totalAmount).toBe(280_000);
    expect(price.pricePerPerson).toBe(140_000);
    expect(price).not.toHaveProperty("depositAmount");
    expect(price).not.toHaveProperty("remainingAmount");
  });

  it("rejects a party size outside 1-4 for availability, price, and reservation creation", async () => {
    await expect(
      agentTools.getAvailability({ date: futureDateKey(5), serviceOptionId: "aroma-oil-90", partySize: 5 }),
    ).rejects.toThrowError(BookingError);

    expect(() => agentTools.calculatePrice({ serviceOptionId: "aroma-oil-90", partySize: 0 })).toThrowError(
      BookingError,
    );

    // 5+ guests must never auto-book — this is the deterministic backend
    // guarantee behind the system prompt's "hand off 5+ guest requests"
    // instruction, enforced even if Gemini ever called the tool anyway.
    await expect(
      agentTools.createReservationRequest({
        serviceOptionId: "aroma-oil-90",
        partySize: 6,
        date: futureDateKey(5),
        time: "16:00",
        ...customerInput,
        locale: "en",
      }),
    ).rejects.toThrowError(BookingError);
  });

  it("createReservationRequest always lands as PENDING, never CONFIRMED, and never mentions a deposit", async () => {
    const date = futureDateKey(5);
    const result = await agentTools.createReservationRequest({
      serviceOptionId: "aroma-oil-90",
      partySize: 2,
      date,
      time: "16:00",
      ...customerInput,
      locale: "en",
    });

    expect(result.status).toBe("PENDING");
    expect(result.totalAmount).toBe(280_000);
    expect(result).not.toHaveProperty("depositAmount");
    expect(result.reservationNumber).toMatch(/^WA-\d{8}-\d{3}$/);
  });

  it("createReservationRequest re-validates availability: a conflicting slot is never double-booked", async () => {
    const date = futureDateKey(6);
    await agentTools.createReservationRequest({
      serviceOptionId: "aroma-oil-90",
      partySize: 2,
      date,
      time: "16:00",
      ...customerInput,
      locale: "en",
    });

    await expect(
      agentTools.createReservationRequest({
        serviceOptionId: "aroma-oil-90",
        partySize: 4,
        date,
        time: "16:00",
        customerName: "Other Guest",
        phoneOrWhatsapp: "+82 10-9999-0000",
        email: "other@example.com",
        locale: "en",
      }),
    ).rejects.toThrowError(BookingError);
  });

  it("getReservationStatus denies access without a matching identity and never exposes another customer's reservation", async () => {
    const date = futureDateKey(5);
    const created = await agentTools.createReservationRequest({
      serviceOptionId: "aroma-oil-90",
      partySize: 2,
      date,
      time: "10:00",
      ...customerInput,
      locale: "en",
    });

    await expect(
      agentTools.getReservationStatus({ reservationNumber: created.reservationNumber }),
    ).rejects.toThrowError(BookingError);
    await expect(
      agentTools.getReservationStatus({
        reservationNumber: created.reservationNumber,
        email: "someone-else@example.com",
      }),
    ).rejects.toThrowError(BookingError);

    const ok = await agentTools.getReservationStatus({
      reservationNumber: created.reservationNumber,
      email: customerInput.email,
    });
    expect(ok.status).toBe("PENDING");
  });

  it("the customer-agent tool layer exposes no confirmReservation/sendConfirmation path", () => {
    const surface = agentTools as unknown as Record<string, unknown>;
    expect(surface.confirmReservation).toBeUndefined();
    expect(surface.sendConfirmation).toBeUndefined();
    expect(surface.updateStatus).toBeUndefined();
    expect(surface.deleteReservation).toBeUndefined();
  });

  it("handoffToAdmin records an open case", async () => {
    const handoff = await agentTools.handoffToAdmin({
      reason: "5+ guests",
      summary: "Customer asked about a 6-person booking",
      customerContact: "jane@example.com",
    });
    expect(handoff.status).toBe("OPEN");
  });
});
