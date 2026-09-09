import { describe, expect, it } from "vitest";
import { sameGuests, setupFreshDb } from "../dbTestUtils";

setupFreshDb();

import { createHold } from "@/lib/repositories/reservationRepository";
import { describeReservationTreatmentsKo } from "@/lib/admin/reservationTreatments";
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
    locale: "ko",
    source: "DIRECT",
    customer: { name: "홍길동", phone: "+82 10-1234-5678", email: "hong@example.com", preferredLanguage: "ko" },
    ...overrides,
  };
}

describe("describeReservationTreatmentsKo", () => {
  it("returns the plain Korean treatment name when every guest chose the same course", async () => {
    const { reservation } = await createHold(holdRequest({ guestCount: 2 }));

    const result = await describeReservationTreatmentsKo(reservation);

    expect(result.isMixed).toBe(false);
    expect(result.label).toBe("아로마 오일");
  });

  it("joins each guest's Korean name with a 게스트N prefix when treatments differ", async () => {
    const { reservation } = await createHold(
      holdRequest({ guestCount: 2, guests: [{ serviceOptionId: "aroma-oil-90" }, { serviceOptionId: "thai-massage-90" }] }),
    );

    const result = await describeReservationTreatmentsKo(reservation);

    expect(result.isMixed).toBe(true);
    expect(result.label).toBe("게스트1 아로마 오일 · 게스트2 전통 타이 마사지");
  });
});
