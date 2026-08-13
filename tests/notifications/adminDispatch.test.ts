import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

setupFreshDb();

const sendMock = vi.fn();
vi.mock("@/lib/notifications/providers/email", () => ({
  resendEmailProvider: { send: (...args: unknown[]) => sendMock(...args) },
}));

import { sendAdminConfirmationEmail, sendAdminTestEmail } from "@/lib/notifications/adminDispatch";
import { listByReservation } from "@/lib/repositories/notificationRepository";
import { createHold, confirmReservation, type ReservationRecord } from "@/lib/repositories/reservationRepository";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";

const ORIGINAL_ENV = { ...process.env };

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** recordAttempt() writes reservation_id under a FOREIGN KEY constraint (PRAGMA foreign_keys = ON), so tests that persist need a real reservation row. */
function makeConfirmedReservation(email: string): ReservationRecord {
  const { reservation } = createHold({
    serviceOptionId: "aroma-oil-90",
    guestCount: 2,
    date: futureDateKey(6),
    time: "16:00",
    locale: "en",
    source: "DIRECT",
    customer: { name: "Jane Doe", phone: "+82 10-1234-5678", email, preferredLanguage: "en" },
  });
  return confirmReservation({ holdId: reservation.id, depositTransactionId: "TEST-TX" });
}

function payload(overrides: Partial<ReservationNotificationPayload> = {}): ReservationNotificationPayload {
  return {
    event: "RESERVATION_CONFIRMED",
    reservationId: "res-1",
    reservationNumber: "WA-20260101-001",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerPhone: "+82 10-1234-5678",
    preferredLanguage: "en",
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
  sendMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendAdminConfirmationEmail", () => {
  it("skips without calling the provider when the customer email is malformed", async () => {
    const result = await sendAdminConfirmationEmail(payload({ customerEmail: "not-an-email" }), {
      includeMap: true,
    });

    expect(result).toMatchObject({ status: "SKIPPED", reason: "invalid_customer_email" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("persists a SENT attempt to the notifications table", async () => {
    const reservation = makeConfirmedReservation("persist@example.com");
    sendMock.mockResolvedValueOnce({ status: "SENT", provider: "resend", providerMessageId: "email-1", redirected: false });

    const result = await sendAdminConfirmationEmail(
      payload({ reservationId: reservation.id, customerEmail: "persist@example.com" }),
      { includeMap: true },
    );

    expect(result.status).toBe("SENT");
    const logs = listByReservation(reservation.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ channel: "EMAIL", eventType: "RESERVATION_CONFIRMED", status: "SENT" });
  });

  it("allows an explicit resend even though the confirmation already succeeded once", async () => {
    const reservation = makeConfirmedReservation("resend@example.com");
    sendMock.mockResolvedValue({ status: "SENT", provider: "resend", providerMessageId: "email-1", redirected: false });
    const sendPayload = payload({ reservationId: reservation.id, customerEmail: "resend@example.com" });

    await sendAdminConfirmationEmail(sendPayload, { includeMap: true });
    const second = await sendAdminConfirmationEmail(sendPayload, { includeMap: true });

    expect(second.status).toBe("SENT");
    expect(sendMock).toHaveBeenCalledTimes(2); // no wasAlreadySent guard for an explicit admin resend
    const logs = listByReservation(reservation.id);
    expect(logs).toHaveLength(1); // same (reservation, channel, event) row, upserted
    expect(logs[0].attemptCount).toBe(2);
  });

  it("with persist: false, never writes to the notifications table (manual/unlinked sends — /admin/send-confirmation)", async () => {
    sendMock.mockResolvedValueOnce({ status: "SENT", provider: "resend", providerMessageId: "email-1", redirected: false });

    // No real reservation row exists for this id — recordAttempt() would
    // violate the FOREIGN KEY constraint if it were called, which is
    // exactly the behavior persist: false must prevent.
    const result = await sendAdminConfirmationEmail(payload({ reservationId: "manual-not-a-real-row" }), {
      includeMap: true,
      persist: false,
    });

    expect(result.status).toBe("SENT");
    expect(listByReservation("manual-not-a-real-row")).toHaveLength(0);
  });
});

describe("sendAdminTestEmail", () => {
  it("skips without calling the provider when EMAIL_TEST_RECIPIENT is unset", async () => {
    delete process.env.EMAIL_TEST_RECIPIENT;

    const result = await sendAdminTestEmail(payload(), { includeMap: true });

    expect(result).toMatchObject({ status: "SKIPPED", reason: "sandbox_mode_no_test_recipient" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("always sends to EMAIL_TEST_RECIPIENT, never the reservation's real customer email", async () => {
    process.env.EMAIL_TEST_RECIPIENT = "tester@example.com";
    sendMock.mockResolvedValueOnce({ status: "SENT", provider: "resend", redirected: false });

    await sendAdminTestEmail(payload({ customerEmail: "real-customer@example.com" }), { includeMap: true });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [sentPayload] = sendMock.mock.calls[0] as [ReservationNotificationPayload];
    expect(sentPayload.customerEmail).toBe("tester@example.com");
  });

  it("never writes to the notifications table — a test send must not appear as a real confirmation", async () => {
    const reservation = makeConfirmedReservation("notest@example.com");
    process.env.EMAIL_TEST_RECIPIENT = "tester@example.com";
    sendMock.mockResolvedValueOnce({ status: "SENT", provider: "resend", redirected: false });

    await sendAdminTestEmail(payload({ reservationId: reservation.id }), { includeMap: true });

    expect(listByReservation(reservation.id)).toHaveLength(0);
  });
});
