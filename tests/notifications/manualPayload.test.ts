import { describe, expect, it, vi } from "vitest";

// See tests/notifications/reminderService.test.ts — getTranslations needs this
// stub under Vitest. Only the payload's structural fields are asserted below.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import { buildManualConfirmationPayload, type ManualConfirmationInput } from "@/lib/notifications/manualPayload";

function input(overrides: Partial<ManualConfirmationInput> = {}): ManualConfirmationInput {
  return {
    customerName: "yujeonglim",
    customerEmail: "wlrndladbwjd2023@gmail.com",
    date: "2026-08-13",
    time: "21:00",
    serviceOptionId: "aroma-oil-90",
    guestCount: 2,
    preferredLanguage: "en",
    reservationNumber: "",
    ...overrides,
  };
}

describe("buildManualConfirmationPayload — validation", () => {
  it("rejects a blank customer name", async () => {
    const result = await buildManualConfirmationPayload(input({ customerName: "   " }));
    expect(result).toEqual({ error: "missing_customer_name" });
  });

  it("rejects a malformed email", async () => {
    const result = await buildManualConfirmationPayload(input({ customerEmail: "not-an-email" }));
    expect(result).toEqual({ error: "invalid_customer_email" });
  });

  it("rejects a malformed date", async () => {
    const result = await buildManualConfirmationPayload(input({ date: "08/13/2026" }));
    expect(result).toEqual({ error: "invalid_date" });
  });

  it("rejects a malformed time", async () => {
    const result = await buildManualConfirmationPayload(input({ time: "9:00 PM" }));
    expect(result).toEqual({ error: "invalid_time" });
  });

  it("rejects a guest count outside 1-4", async () => {
    expect(await buildManualConfirmationPayload(input({ guestCount: 0 }))).toEqual({ error: "invalid_guest_count" });
    expect(await buildManualConfirmationPayload(input({ guestCount: 5 }))).toEqual({ error: "invalid_guest_count" });
  });

  it("rejects an unsupported language", async () => {
    const result = await buildManualConfirmationPayload(input({ preferredLanguage: "fr" }));
    expect(result).toEqual({ error: "invalid_language" });
  });

  it("rejects an unknown service option", async () => {
    const result = await buildManualConfirmationPayload(input({ serviceOptionId: "does-not-exist" }));
    expect(result).toEqual({ error: "invalid_service" });
  });
});

describe("buildManualConfirmationPayload — valid input", () => {
  it("computes pricing the same way the real booking flow does", async () => {
    const result = await buildManualConfirmationPayload(input({ guestCount: 2, serviceOptionId: "aroma-oil-90" }));
    if ("error" in result) throw new Error("expected a payload");

    expect(result.payload.totalAmount).toBe(280_000);
    expect(result.payload.depositAmount).toBe(20_000);
    expect(result.payload.remainingAmount).toBe(260_000);
    expect(result.payload.durationMinutes).toBe(90);
    expect(result.payload.customerName).toBe("yujeonglim");
    expect(result.payload.customerEmail).toBe("wlrndladbwjd2023@gmail.com");
    expect(result.payload.event).toBe("RESERVATION_CONFIRMED");
  });

  it("auto-generates a reservation number when left blank", async () => {
    const result = await buildManualConfirmationPayload(input({ reservationNumber: "" }));
    if ("error" in result) throw new Error("expected a payload");
    expect(result.payload.reservationNumber).toBe("WA-MANUAL-20260813");
  });

  it("preserves an admin-provided reservation number", async () => {
    const result = await buildManualConfirmationPayload(input({ reservationNumber: "PHONE-BOOKING-42" }));
    if ("error" in result) throw new Error("expected a payload");
    expect(result.payload.reservationNumber).toBe("PHONE-BOOKING-42");
  });

  it("produces a synthetic, non-DB reservationId", async () => {
    const result = await buildManualConfirmationPayload(input());
    if ("error" in result) throw new Error("expected a payload");
    expect(result.payload.reservationId).toMatch(/^manual-/);
  });
});
