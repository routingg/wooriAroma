import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "./dbTestUtils";

setupFreshDb();

import { createHold, submitReservationRequest } from "@/lib/repositories/reservationRepository";
import { listByReservation } from "@/lib/repositories/notificationRepository";
import { normalizeKoreanPhone, sendAdminReservationSms } from "@/lib/solapi";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";

const ORIGINAL_ENV = { ...process.env };

async function createPendingReservationId(): Promise<string> {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  const date = d.toISOString().slice(0, 10);
  const { reservation } = await createHold({
    serviceOptionId: "aroma-oil-90",
    guestCount: 2,
    date,
    time: "18:00",
    locale: "en",
    source: "DIRECT",
    customer: {
      name: "James Smith",
      phone: "+82 10-1234-5678",
      email: "james@example.com",
      preferredLanguage: "en",
    },
  });
  const submitted = await submitReservationRequest({ holdId: reservation.id });
  return submitted.id;
}

function payload(reservationId: string, overrides: Partial<ReservationNotificationPayload> = {}): ReservationNotificationPayload {
  return {
    event: "RESERVATION_REQUEST_RECEIVED",
    reservationId,
    reservationNumber: "WA-20260101-001",
    customerName: "James Smith",
    customerEmail: "james@example.com",
    customerPhone: "+82 10-1234-5678",
    preferredLanguage: "en",
    date: "2026-09-12",
    time: "18:00",
    guestCount: 2,
    treatmentName: "Aroma 90min",
    durationMinutes: 90,
    totalAmount: 280_000,
    depositAmount: 0,
    remainingAmount: 280_000,
    status: "PENDING",
    ...overrides,
  };
}

function createFetchOkMock(messageId = "sms-1") {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify({ messageId }), { status: 200 }),
  );
}

beforeEach(() => {
  delete process.env.SOLAPI_API_KEY;
  delete process.env.SOLAPI_API_SECRET;
  delete process.env.SOLAPI_SENDER_PHONE;
  delete process.env.ADMIN_NOTIFICATION_PHONE;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("normalizeKoreanPhone", () => {
  it("strips hyphens/spaces", () => {
    expect(normalizeKoreanPhone("010-1234-5678")).toBe("01012345678");
  });

  it("converts a leading +82/82 international prefix to a domestic 0", () => {
    expect(normalizeKoreanPhone("+82 10-1234-5678")).toBe("01012345678");
  });
});

describe("sendAdminReservationSms — missing configuration", () => {
  it("skips sending, never crashes, and logs SKIPPED instead of a fabricated send", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const reservationId = await createPendingReservationId();

    await expect(sendAdminReservationSms(payload(reservationId))).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    const logs = await listByReservation(reservationId);
    const smsLog = logs.find((l) => l.channel === "SMS");
    expect(smsLog).toMatchObject({ status: "SKIPPED", lastError: "provider_not_configured" });
  });
});

describe("sendAdminReservationSms — invalid phone numbers", () => {
  beforeEach(() => {
    process.env.SOLAPI_API_KEY = "test-key";
    process.env.SOLAPI_API_SECRET = "test-secret";
    process.env.SOLAPI_SENDER_PHONE = "0101234";
    process.env.ADMIN_NOTIFICATION_PHONE = "not-a-phone";
  });

  it("fails safely without ever calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const reservationId = await createPendingReservationId();

    await sendAdminReservationSms(payload(reservationId));

    expect(fetchMock).not.toHaveBeenCalled();
    const logs = await listByReservation(reservationId);
    const smsLog = logs.find((l) => l.channel === "SMS");
    expect(smsLog).toMatchObject({ status: "FAILED", lastError: "invalid_phone_number" });
  });
});

describe("sendAdminReservationSms — successful send", () => {
  beforeEach(() => {
    process.env.SOLAPI_API_KEY = "test-key";
    process.env.SOLAPI_API_SECRET = "test-secret";
    process.env.SOLAPI_SENDER_PHONE = "010-1111-2222";
    process.env.ADMIN_NOTIFICATION_PHONE = "010-9876-5432";
  });

  it("normalizes phone numbers, signs the request, and records SENT with the provider message id", async () => {
    const fetchMock = createFetchOkMock("sms-abc");
    vi.stubGlobal("fetch", fetchMock);
    const reservationId = await createPendingReservationId();

    await sendAdminReservationSms(payload(reservationId));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.solapi.com/messages/v4/send");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toMatch(/^HMAC-SHA256 apiKey=test-key, date=.+, salt=.+, signature=[0-9a-f]{64}$/);

    const body = JSON.parse(init.body as string) as { message: { to: string; from: string; text: string; type: string } };
    expect(body.message.to).toBe("01098765432");
    expect(body.message.from).toBe("01011112222");
    // The label-light template keeps a typical name/menu combination under
    // the 90-byte SMS threshold, so this should NOT fall back to LMS.
    expect(body.message.type).toBe("SMS");
    expect(body.message.text).toContain("James Smith");
    expect(body.message.text).toContain("Aroma 90min");

    const logs = await listByReservation(reservationId);
    const smsLog = logs.find((l) => l.channel === "SMS");
    expect(smsLog).toMatchObject({ status: "SENT", provider: "solapi", providerMessageId: "sms-abc" });
  });

  it("still falls back to LMS when an unusually long name/menu pushes past the SMS byte limit", async () => {
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);
    const reservationId = await createPendingReservationId();

    await sendAdminReservationSms(payload(reservationId, { treatmentName: "아".repeat(80) }));

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as { message: { type: string } };
    expect(body.message.type).toBe("LMS");
  });

  it("sends at most once for the same reservation even if invoked twice (duplicate-submit protection)", async () => {
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);
    const reservationId = await createPendingReservationId();
    const p = payload(reservationId);

    await sendAdminReservationSms(p);
    await sendAdminReservationSms(p);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws on a provider HTTP error, and still records FAILED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 500 })));
    const reservationId = await createPendingReservationId();

    await expect(sendAdminReservationSms(payload(reservationId))).resolves.toBeUndefined();

    const logs = await listByReservation(reservationId);
    const smsLog = logs.find((l) => l.channel === "SMS");
    expect(smsLog).toMatchObject({ status: "FAILED", lastError: "solapi_http_500" });
  });

  it("never throws and never leaks the API secret when the network request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const reservationId = await createPendingReservationId();

    try {
      await expect(sendAdminReservationSms(payload(reservationId))).resolves.toBeUndefined();
      expect(JSON.stringify(log.mock.calls)).not.toContain("test-secret");
    } finally {
      log.mockRestore();
    }

    const logs = await listByReservation(reservationId);
    const smsLog = logs.find((l) => l.channel === "SMS");
    expect(smsLog).toMatchObject({ status: "FAILED", lastError: "network down" });
  });
});
