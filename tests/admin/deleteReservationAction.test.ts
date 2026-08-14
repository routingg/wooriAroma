import { describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

setupFreshDb();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { deleteReservationAction } from "@/app/admin/actions";
import { createHold, getById, submitReservationRequest, updateStatus } from "@/lib/repositories/reservationRepository";

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function makeCompletedReservationId(): string {
  const { reservation } = createHold({
    serviceOptionId: "aroma-oil-90",
    guestCount: 1,
    date: futureDateKey(5),
    time: "16:00",
    locale: "en",
    source: "DIRECT",
    customer: { name: "Jane Doe", phone: "+82 10-1234-5678", email: "jane@example.com", preferredLanguage: "en" },
  });
  submitReservationRequest({ holdId: reservation.id });
  updateStatus(reservation.id, "CONFIRMED");
  updateStatus(reservation.id, "COMPLETED");
  return reservation.id;
}

describe("deleteReservationAction", () => {
  it("soft-deletes a COMPLETED reservation and returns success", async () => {
    const id = makeCompletedReservationId();

    const result = await deleteReservationAction(id);

    expect(result).toEqual({ success: true });
    expect(getById(id)?.deletedAt).not.toBeNull();
  });

  it("rejects a PENDING reservation with a BookingErrorCode, and does not delete it", async () => {
    const { reservation } = createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 1,
      date: futureDateKey(5),
      time: "10:00",
      locale: "en",
      source: "DIRECT",
      customer: { name: "Still Pending", phone: "+82 10-1234-5678", email: "pending@example.com", preferredLanguage: "en" },
    });
    submitReservationRequest({ holdId: reservation.id });

    const result = await deleteReservationAction(reservation.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe("RESERVATION_NOT_DELETABLE");
    expect(getById(reservation.id)?.deletedAt).toBeNull();
  });

  it("rejects a second delete of the same reservation as already-deleted", async () => {
    const id = makeCompletedReservationId();
    await deleteReservationAction(id);

    const second = await deleteReservationAction(id);

    expect(second.success).toBe(false);
    expect(second.error).toBe("RESERVATION_ALREADY_DELETED");
  });

  it("rejects an unknown reservation id safely", async () => {
    const result = await deleteReservationAction("not-a-real-id");

    expect(result.success).toBe(false);
    expect(result.error).toBe("RESERVATION_NOT_FOUND");
  });
});
