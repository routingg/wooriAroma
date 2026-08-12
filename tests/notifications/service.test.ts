import { describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

setupFreshDb();

vi.mock("@/lib/notifications/providers/email", () => ({
  resendEmailProvider: {
    send: vi.fn(async () => {
      throw new Error("simulated Resend outage");
    }),
  },
}));

import { createHold, confirmReservation } from "@/lib/repositories/reservationRepository";
import { listByReservation } from "@/lib/repositories/notificationRepository";
import { notificationService } from "@/lib/notifications";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

describe("notificationService — failure isolation", () => {
  it("never throws when a provider throws, and logs the failure instead", async () => {
    const date = futureDateKey(6);
    const { reservation } = createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 1,
      date,
      time: "16:00",
      locale: "en",
      source: "DIRECT",
      customer: {
        name: "Failure Case",
        phone: "+82 10-1234-5678",
        email: "failure@example.com",
        preferredLanguage: "en",
      },
    });
    const confirmed = confirmReservation({ holdId: reservation.id, depositTransactionId: "TEST-TX" });

    const payload: ReservationNotificationPayload = {
      event: "RESERVATION_CONFIRMED",
      reservationId: confirmed.id,
      reservationNumber: confirmed.reservationNumber,
      customerName: "Failure Case",
      customerEmail: "failure@example.com",
      customerPhone: "+82 10-1234-5678",
      preferredLanguage: "en",
      whatsappOptIn: false,
      date: confirmed.dateKey,
      time: confirmed.serviceStart,
      guestCount: 1,
      treatmentName: "Aroma Oil",
      durationMinutes: 90,
      totalAmount: confirmed.totalAmount,
      depositAmount: confirmed.depositAmount,
      remainingAmount: confirmed.remainingAmount,
      status: confirmed.status,
    };

    // The reservation write already committed above — this must never throw,
    // no matter how badly the email provider misbehaves.
    await expect(notificationService.sendReservationConfirmation(payload)).resolves.toBeUndefined();

    const logs = listByReservation(confirmed.id);
    const emailLog = logs.find((l) => l.channel === "EMAIL");
    expect(emailLog?.status).toBe("FAILED");
    expect(emailLog?.lastError).toContain("simulated Resend outage");

    // Confirming the reservation itself was entirely unaffected.
    expect(confirmed.status).toBe("CONFIRMED");
  });
});
