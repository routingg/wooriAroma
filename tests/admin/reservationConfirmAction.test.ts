import { describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

setupFreshDb();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const sendMock = vi.fn();
vi.mock("@/lib/notifications/providers/email", () => ({
  resendEmailProvider: { send: (...args: unknown[]) => sendMock(...args) },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import { sendConfirmationEmailAction } from "@/app/admin/reservations/[id]/actions";
import { createHold, getById, submitReservationRequest } from "@/lib/repositories/reservationRepository";

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

describe("sendConfirmationEmailAction — Pending -> Confirmed transition", () => {
  it("confirms a PENDING reservation before sending the confirmation email", async () => {
    const { reservation } = createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 2,
      date: futureDateKey(6),
      time: "16:00",
      locale: "en",
      source: "DIRECT",
      customer: { name: "Jane Doe", phone: "+82 10-1234-5678", email: "jane@example.com", preferredLanguage: "en" },
    });
    const pending = submitReservationRequest({ holdId: reservation.id });
    expect(pending.status).toBe("PENDING");

    sendMock.mockResolvedValueOnce({ status: "SENT", provider: "resend", providerMessageId: "email-1", redirected: false });

    const formData = new FormData();
    formData.set("includeMap", "on");
    const result = await sendConfirmationEmailAction(pending.id, { status: "idle" }, formData);

    expect(result.status).toBe("sent");
    expect(getById(pending.id)?.status).toBe("CONFIRMED");

    // The email payload sent must reflect the new CONFIRMED status, not the
    // stale PENDING status from before the transition.
    const [sentPayload] = sendMock.mock.calls[0] as [{ status: string; event: string }];
    expect(sentPayload.status).toBe("CONFIRMED");
    expect(sentPayload.event).toBe("RESERVATION_CONFIRMED");
  });

  it("leaves an already-CONFIRMED reservation's status untouched on a resend", async () => {
    const { reservation } = createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 1,
      date: futureDateKey(6),
      time: "10:00",
      locale: "en",
      source: "DIRECT",
      customer: { name: "Resend Case", phone: "+82 10-1234-5678", email: "resend@example.com", preferredLanguage: "en" },
    });
    submitReservationRequest({ holdId: reservation.id });
    // Simulate an already-confirmed reservation without going through the
    // email action (a prior confirm already happened).
    const { updateStatus } = await import("@/lib/repositories/reservationRepository");
    updateStatus(reservation.id, "CONFIRMED");

    sendMock.mockResolvedValueOnce({ status: "SENT", provider: "resend", providerMessageId: "email-2", redirected: false });

    const formData = new FormData();
    formData.set("includeMap", "on");
    const result = await sendConfirmationEmailAction(reservation.id, { status: "idle" }, formData);

    expect(result.status).toBe("sent");
    expect(getById(reservation.id)?.status).toBe("CONFIRMED");
  });
});
