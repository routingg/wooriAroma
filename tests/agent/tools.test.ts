import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import * as agentTools from "@/lib/agent/tools";
import { BookingError } from "@/lib/booking/errors";

setupFreshDb();

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const customer = {
  name: "Jane Doe",
  phone: "+82 10-1234-5678",
  email: "jane@example.com",
  preferredLanguage: "en",
};

describe("agent tools", () => {
  it("getServices/getAvailability/calculatePrice mirror the public API", async () => {
    expect(agentTools.getServices().length).toBeGreaterThan(0);

    const date = futureDateKey(5);
    const slots = await agentTools.getAvailability(date, "aroma-oil-90");
    expect(slots.length).toBeGreaterThan(0);

    const price = agentTools.calculatePrice("aroma-oil-90", 2);
    expect(price.totalAmount).toBe(280_000);
    expect(price.depositAmount).toBe(20_000);
  });

  it("T11: getReservation denies access without a matching identity", async () => {
    const date = futureDateKey(5);
    const { reservation } = await agentTools.createReservationHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 2,
      date,
      time: "16:00",
      locale: "en",
      customer,
    });
    await agentTools.confirmReservation(reservation.id, "MOCK-TX-AGENT-1");

    await expect(agentTools.getReservation(reservation.reservationNumber, {})).rejects.toThrowError(BookingError);
    await expect(
      agentTools.getReservation(reservation.reservationNumber, { email: "someone-else@example.com" }),
    ).rejects.toThrowError(BookingError);

    const ok = await agentTools.getReservation(reservation.reservationNumber, { email: customer.email });
    expect(ok.status).toBe("CONFIRMED");
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
