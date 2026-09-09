import { describe, expect, it, vi } from "vitest";
import { sameGuests, setupFreshDb } from "../dbTestUtils";

// Only structural output is asserted below (which guest's name appears
// where), not exact translated prose — see tests/notifications/reminderService.test.ts
// for why this stub is needed under Vitest.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) => (key: string, params?: { n?: number }) =>
    namespace === "common" && key === "guestLabel" ? `Guest ${params?.n}` : key,
}));

setupFreshDb();

import { createHold } from "@/lib/repositories/reservationRepository";
import { describeReservationTreatments } from "@/lib/booking/reservationTreatments";
import type { ReservationHoldRequest } from "@/lib/booking/validation";

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function holdRequest(overrides: Partial<ReservationHoldRequest> = {}): ReservationHoldRequest {
  const guestCount = overrides.guestCount ?? 1;
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

describe("describeReservationTreatments", () => {
  it("returns the plain treatment name (not mixed) when every guest chose the same course", async () => {
    const { reservation } = await createHold(holdRequest({ guestCount: 2 }));

    const result = await describeReservationTreatments(reservation, "en");

    expect(result.isMixed).toBe(false);
    expect(result.summary).toBe("aromaOil.name");
  });

  it("joins each guest's name with a guest label when treatments differ", async () => {
    const { reservation } = await createHold(
      holdRequest({ guestCount: 2, guests: [{ serviceOptionId: "aroma-oil-90" }, { serviceOptionId: "thai-massage-90" }] }),
    );

    const result = await describeReservationTreatments(reservation, "en");

    expect(result.isMixed).toBe(true);
    expect(result.summary).toBe("Guest 1: aromaOil.name · Guest 2: thaiMassage.name");
  });
});
