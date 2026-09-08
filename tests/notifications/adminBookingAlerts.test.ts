import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

setupFreshDb();

import { getDb } from "@/lib/db/client";
import { createHold, getById, submitReservationRequest } from "@/lib/repositories/reservationRepository";
import {
  claimAdminBookingAlert, listAdminBookingAlerts, settleAdminBookingAlert,
} from "@/lib/repositories/adminBookingAlertRepository";
import { processAdminBookingAlerts } from "@/lib/notifications/adminBookingAlerts";
import { buildAdminAlertRequest, getAdminAlertConfiguration } from "@/lib/notifications/providers/adminBookingEmail";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "Bookings <bookings@example.com>";
  process.env.ADMIN_NOTIFICATION_EMAIL = "owner@example.com";
  process.env.ADMIN_NOTIFICATION_ORIGIN = "https://booking.example.com";
  process.env.EMAIL_DELIVERY_MODE = "production";
  delete process.env.EMAIL_TEST_RECIPIENT;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

async function hold() {
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 10);
  return createHold({
    serviceOptionId: "aroma-oil-90", guestCount: 1,
    date: future.toISOString().slice(0, 10), time: "16:00", locale: "ko", source: "DIRECT",
    customer: {
      name: "Private Customer", phone: "+82 10-1234-5678", email: "customer@example.com",
      preferredLanguage: "ko", specialRequest: "Private health information",
    },
  });
}

async function pending() {
  const { reservation } = await hold();
  return submitReservationRequest({ holdId: reservation.id });
}

function fetchOk() {
  const mock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
    new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

function claimInput(now: Date) {
  return { now, mode: "production" as const, requestJson: "{}", idempotencyKey: "key" };
}

describe("admin booking alert outbox", () => {
  it("queues exactly one alert atomically when a HOLD becomes PENDING", async () => {
    const { reservation } = await hold();
    expect(await listAdminBookingAlerts()).toEqual([]);
    await submitReservationRequest({ holdId: reservation.id });
    await submitReservationRequest({ holdId: reservation.id });
    const alerts = await listAdminBookingAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ reservation_id: reservation.id, status: "PENDING", attempt_count: 0, request_json: null });
  });

  it("does not commit the booking transition if its durable enqueue fails", async () => {
    const { reservation } = await hold();
    await getDb().prepare("DROP TABLE admin_booking_alerts").run();
    await expect(submitReservationRequest({ holdId: reservation.id })).rejects.toThrow();
    expect((await getById(reservation.id))?.status).toBe("HOLD");
  });

  it("grants one concurrent lease and ignores stale worker results after recovery", async () => {
    const reservation = await pending();
    const now = new Date();
    const claims = await Promise.all([
      claimAdminBookingAlert(reservation.id, claimInput(now)),
      claimAdminBookingAlert(reservation.id, claimInput(now)),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const original = claims.find(Boolean)!;
    const later = new Date(now.getTime() + 61_000);
    const recovered = await claimAdminBookingAlert(reservation.id, claimInput(later));
    expect(recovered?.lease_token).not.toBe(original.lease_token);
    await settleAdminBookingAlert(original, { status: "SENT", now: later });
    expect((await listAdminBookingAlerts())[0].status).toBe("PROCESSING");
    await settleAdminBookingAlert(recovered!, { status: "SENT", now: later });
    expect((await listAdminBookingAlerts())[0].status).toBe("SENT");
  });
});

describe("admin alert delivery and recovery", () => {
  it("sends only a generic notice and protected link, and skips an accepted production alert", async () => {
    const reservation = await pending();
    const fetchMock = fetchOk();
    expect(await processAdminBookingAlerts()).toMatchObject({ sent: 1 });
    expect(await processAdminBookingAlerts()).toMatchObject({ checked: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const bodyText = fetchMock.mock.calls[0][1].body as string;
    const body = JSON.parse(bodyText);
    expect(body.to).toBe("owner@example.com");
    expect(body.text).toContain(`https://booking.example.com/admin/reservations/${reservation.id}`);
    for (const secret of ["Private Customer", "customer@example.com", "+82 10-1234-5678", "Private health", reservation.reservationNumber]) {
      expect(bodyText).not.toContain(secret);
    }
    expect(fetchMock.mock.calls[0][1].headers).toHaveProperty("Idempotency-Key");
  });

  it("records sandbox success separately and can later deliver once to the production owner", async () => {
    await pending();
    process.env.EMAIL_DELIVERY_MODE = "sandbox";
    process.env.EMAIL_TEST_RECIPIENT = "sandbox@example.com";
    const fetchMock = fetchOk();
    expect(await processAdminBookingAlerts()).toMatchObject({ tested: 1, sent: 0 });
    expect((await listAdminBookingAlerts())[0].status).toBe("TESTED");
    await processAdminBookingAlerts();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    process.env.EMAIL_DELIVERY_MODE = "production";
    expect(await processAdminBookingAlerts()).toMatchObject({ sent: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).to).toBe("sandbox@example.com");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).to).toBe("owner@example.com");
    const firstHeaders = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    const secondHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(firstHeaders["Idempotency-Key"]).not.toBe(secondHeaders["Idempotency-Key"]);
    expect((await listAdminBookingAlerts())[0]).toMatchObject({ status: "SENT", attempt_count: 1 });
  });

  it("keeps an event pending without making requests when required configuration is missing", async () => {
    await pending();
    delete process.env.EMAIL_DELIVERY_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
    const fetchMock = fetchOk();
    expect(await processAdminBookingAlerts()).toMatchObject({ configurationError: "sandbox_recipient_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await listAdminBookingAlerts())[0]).toMatchObject({ status: "PENDING", attempt_count: 0 });
  });

  it("retries an ambiguous network failure with exactly the same body and idempotency key", async () => {
    await pending();
    const now = new Date();
    const fetchMock = fetchOk();
    fetchMock.mockRejectedValueOnce(new Error("customer@example.com private provider failure"));
    expect(await processAdminBookingAlerts({ now })).toMatchObject({ retrying: 1 });
    expect((await listAdminBookingAlerts())[0]).toMatchObject({ status: "PENDING", last_error: "provider_request_failed" });
    expect(await processAdminBookingAlerts({ now })).toMatchObject({ checked: 0 });
    expect(await processAdminBookingAlerts({ now: new Date(now.getTime() + 61_000) })).toMatchObject({ sent: 1 });
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
    const initialHeaders = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    const retryHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(initialHeaders["Idempotency-Key"]).toBe(retryHeaders["Idempotency-Key"]);
  });

  it("stops for review before the provider's 24-hour deduplication window expires", async () => {
    await pending();
    const now = new Date();
    const fetchMock = fetchOk();
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    await processAdminBookingAlerts({ now });
    expect(await processAdminBookingAlerts({ now: new Date(now.getTime() + 23 * 3_600_000) })).toMatchObject({ needsReview: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await listAdminBookingAlerts())[0]).toMatchObject({ status: "DEAD", last_error: "retry_window_expired" });
  });

  it("does not deliver a retry to an old or newly substituted recipient after configuration changes", async () => {
    await pending();
    const now = new Date();
    const fetchMock = fetchOk();
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    await processAdminBookingAlerts({ now });
    process.env.ADMIN_NOTIFICATION_EMAIL = "different@example.com";
    expect(await processAdminBookingAlerts({ now: new Date(now.getTime() + 61_000) })).toMatchObject({ needsReview: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await listAdminBookingAlerts())[0].last_error).toBe("delivery_configuration_changed");
  });

  it("records safe error codes and stops retrying permanent provider errors", async () => {
    await pending();
    const fetchMock = fetchOk();
    fetchMock.mockResolvedValueOnce(new Response("secret@example.com validation error", { status: 422 }));
    expect(await processAdminBookingAlerts()).toMatchObject({ needsReview: 1 });
    expect((await listAdminBookingAlerts())[0]).toMatchObject({ status: "DEAD", last_error: "provider_http_422" });
  });

  it("limits persistent transient failures to six provider attempts", async () => {
    await pending();
    const now = new Date();
    const fetchMock = fetchOk();
    fetchMock.mockRejectedValue(new Error("temporary outage"));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await processAdminBookingAlerts({ now: new Date(now.getTime() + attempt * 4 * 3_600_000) });
    }
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect((await listAdminBookingAlerts())[0]).toMatchObject({ status: "DEAD", attempt_count: 6 });
    expect(await processAdminBookingAlerts({ now: new Date(now.getTime() + 21 * 3_600_000) })).toMatchObject({ checked: 0 });
  });
});

describe("admin alert configuration", () => {
  it("requires an HTTPS origin in production and disallows embedded credentials", () => {
    for (const origin of ["http://booking.example.com", "https://user:password@booking.example.com", "https://booking.example.com/admin"]) {
      process.env.ADMIN_NOTIFICATION_ORIGIN = origin;
      expect(getAdminAlertConfiguration()).toEqual({ configured: false, reason: "admin_origin_not_configured" });
    }
  });

  it("separates idempotency keys by actual recipient and delivery mode", () => {
    const resolved = getAdminAlertConfiguration();
    expect(resolved.configured).toBe(true);
    if (!resolved.configured) return;
    const original = buildAdminAlertRequest("reservation", resolved.value);
    const otherRecipient = buildAdminAlertRequest("reservation", { ...resolved.value, recipient: "other@example.com" });
    const sandbox = buildAdminAlertRequest("reservation", { ...resolved.value, mode: "sandbox" });
    expect(original.idempotencyKey).not.toBe(otherRecipient.idempotencyKey);
    expect(original.idempotencyKey).not.toBe(sandbox.idempotencyKey);
    expect(original.idempotencyKey).not.toContain("owner@example.com");
  });
});
