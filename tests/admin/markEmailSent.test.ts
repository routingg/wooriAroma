import { describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

setupFreshDb();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { markConfirmationEmailSentAction, updateReservationStatusAction } from "@/app/admin/actions";
import { createHold, getById, submitReservationRequest } from "@/lib/repositories/reservationRepository";
import { listByReservation } from "@/lib/repositories/notificationRepository";

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

describe("markConfirmationEmailSentAction — manual 발송 여부 tracker", () => {
  it("records a manual SENT marker without changing reservation status", async () => {
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
    await updateReservationStatusAction(pending.id, "CONFIRMED");

    await markConfirmationEmailSentAction(pending.id, "jane@example.com");

    // Reservation status is untouched by the email-status marker (AGENTS.md §20).
    expect(getById(pending.id)?.status).toBe("CONFIRMED");

    const logs = listByReservation(pending.id);
    const emailLog = logs.find((l) => l.channel === "EMAIL" && l.eventType === "RESERVATION_CONFIRMED");
    expect(emailLog?.status).toBe("SENT");
    expect(emailLog?.provider).toBe("manual");
    expect(emailLog?.sentAt).toBeTruthy();
  });

  it("is independent of reservation status — can be marked even while still PENDING", async () => {
    const { reservation } = createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 1,
      date: futureDateKey(6),
      time: "10:00",
      locale: "en",
      source: "DIRECT",
      customer: { name: "Still Pending", phone: "+82 10-1234-5678", email: "pending@example.com", preferredLanguage: "en" },
    });
    const pending = submitReservationRequest({ holdId: reservation.id });

    await markConfirmationEmailSentAction(pending.id, "pending@example.com");

    expect(getById(pending.id)?.status).toBe("PENDING");
    const logs = listByReservation(pending.id);
    expect(logs.find((l) => l.channel === "EMAIL")?.status).toBe("SENT");
  });
});
