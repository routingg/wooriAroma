import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { koreanMessagingProvider } from "@/lib/notifications/providers/korean";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";

const ORIGINAL_ENV = { ...process.env };

function payload(): ReservationNotificationPayload {
  return {
    event: "RESERVATION_CONFIRMED",
    reservationId: "res-1",
    reservationNumber: "WA-20260101-001",
    customerName: "지민",
    customerEmail: "jimin@example.com",
    customerPhone: "010-1234-5678",
    preferredLanguage: "ko",
    whatsappOptIn: false,
    date: "2026-01-01",
    time: "16:00",
    guestCount: 2,
    treatmentName: "아로마 오일",
    durationMinutes: 90,
    totalAmount: 280_000,
    depositAmount: 20_000,
    remainingAmount: 260_000,
    status: "CONFIRMED",
  };
}

beforeEach(() => {
  process.env.SOLAPI_API_KEY = "test-key";
  process.env.SOLAPI_API_SECRET = "test-secret";
  process.env.SOLAPI_SENDER_NUMBER = "0212345678";
  process.env.SOLAPI_KAKAO_PFID = "test-pfid";
  process.env.SOLAPI_KAKAO_TEMPLATE_ID = "test-template";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("koreanMessagingProvider — Kakao fallback to SMS", () => {
  it("falls back to SMS when Kakao AlimTalk fails, and logs both attempts", async () => {
    const fetchMock = vi
      .fn()
      // 1st call: Kakao AlimTalk send — simulate SOLAPI rejecting it.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errorCode: "TemplateNotApproved", errorMessage: "template not approved" }), {
          status: 400,
        }),
      )
      // 2nd call: SMS fallback — succeeds.
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: "sms-123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await koreanMessagingProvider.send(payload());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ status: "FAILED", provider: "solapi-kakao" });
    expect(results[1]).toMatchObject({ status: "SENT", provider: "solapi-sms", providerMessageId: "sms-123" });
  });

  it("does not attempt SMS when Kakao succeeds (no duplicate cost)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ messageId: "kakao-123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await koreanMessagingProvider.send(payload());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0]).toMatchObject({ status: "SENT", provider: "solapi-kakao" });
    expect(results[1]).toMatchObject({ status: "SKIPPED", provider: "solapi-sms", reason: "not_needed" });
  });

  it("skips both channels without crashing when SOLAPI credentials are missing", async () => {
    delete process.env.SOLAPI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const results = await koreanMessagingProvider.send(payload());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({ status: "SKIPPED", reason: "provider_not_configured" });
  });
});
