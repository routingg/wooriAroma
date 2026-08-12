import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resendEmailProvider } from "@/lib/notifications/providers/email";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";

const ORIGINAL_ENV = { ...process.env };

function payload(overrides: Partial<ReservationNotificationPayload> = {}): ReservationNotificationPayload {
  return {
    event: "RESERVATION_CONFIRMED",
    reservationId: "res-1",
    reservationNumber: "WA-20260101-001",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerPhone: "+82 10-1234-5678",
    preferredLanguage: "en",
    whatsappOptIn: false,
    date: "2026-01-01",
    time: "16:00",
    guestCount: 2,
    treatmentName: "Aroma Oil",
    durationMinutes: 90,
    totalAmount: 280_000,
    depositAmount: 20_000,
    remainingAmount: 260_000,
    status: "CONFIRMED",
    ...overrides,
  };
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resendEmailProvider — missing configuration", () => {
  it("returns SKIPPED/provider_not_configured instead of throwing when RESEND_API_KEY is unset", async () => {
    const result = await resendEmailProvider.send(payload());
    expect(result.status).toBe("SKIPPED");
    expect(result.provider).toBe("resend");
    expect(result.reason).toBe("provider_not_configured");
  });

  it("never fabricates a successful send when only RESEND_FROM_EMAIL is set", async () => {
    process.env.RESEND_FROM_EMAIL = "reservations@wooriaroma.test";
    const result = await resendEmailProvider.send(payload());
    expect(result.status).toBe("SKIPPED");
  });
});
