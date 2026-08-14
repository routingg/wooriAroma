import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import {
  createHold,
  getById,
  listAll,
  searchReservations,
  softDeleteReservation,
  submitReservationRequest,
  updateStatus,
  type ReservationRecord,
} from "@/lib/repositories/reservationRepository";
import { BookingError } from "@/lib/booking/errors";
import type { ReservationHoldRequest } from "@/lib/booking/validation";

setupFreshDb();

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function holdRequest(overrides: Partial<ReservationHoldRequest> = {}): ReservationHoldRequest {
  return {
    serviceOptionId: "aroma-oil-90",
    guestCount: 2,
    date: futureDateKey(5),
    time: "16:00",
    locale: "en",
    source: "DIRECT",
    customer: {
      name: "Jane Doe",
      phone: "+82 10-1234-5678",
      email: "jane@example.com",
      preferredLanguage: "en",
    },
    ...overrides,
  };
}

/** Drives a fresh HOLD all the way to COMPLETED. */
function makeCompletedReservation(overrides: Partial<ReservationHoldRequest> = {}): ReservationRecord {
  const { reservation } = createHold(holdRequest(overrides));
  submitReservationRequest({ holdId: reservation.id });
  updateStatus(reservation.id, "CONFIRMED");
  return updateStatus(reservation.id, "COMPLETED");
}

/** Drives a fresh HOLD to CONFIRMED, then CANCELLED. */
function makeCancelledReservation(overrides: Partial<ReservationHoldRequest> = {}): ReservationRecord {
  const { reservation } = createHold(holdRequest(overrides));
  submitReservationRequest({ holdId: reservation.id });
  updateStatus(reservation.id, "CONFIRMED");
  return updateStatus(reservation.id, "CANCELLED");
}

/** Drives a fresh HOLD to CONFIRMED, then NO_SHOW. */
function makeNoShowReservation(overrides: Partial<ReservationHoldRequest> = {}): ReservationRecord {
  const { reservation } = createHold(holdRequest(overrides));
  submitReservationRequest({ holdId: reservation.id });
  updateStatus(reservation.id, "CONFIRMED");
  return updateStatus(reservation.id, "NO_SHOW");
}

describe("softDeleteReservation — admin 삭제 (soft delete, 완료/취소/노쇼 only)", () => {
  it("sets deletedAt on a COMPLETED reservation without touching its status", () => {
    const completed = makeCompletedReservation();
    const deleted = softDeleteReservation(completed.id);

    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe("COMPLETED");
  });

  it("sets deletedAt on a CANCELLED reservation without touching its status", () => {
    const cancelled = makeCancelledReservation();
    const deleted = softDeleteReservation(cancelled.id);

    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe("CANCELLED");
  });

  it("sets deletedAt on a NO_SHOW reservation without touching its status", () => {
    const noShow = makeNoShowReservation();
    const deleted = softDeleteReservation(noShow.id);

    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe("NO_SHOW");
  });

  it("refuses to delete a PENDING reservation", () => {
    const { reservation } = createHold(holdRequest());
    const pending = submitReservationRequest({ holdId: reservation.id });

    expect(() => softDeleteReservation(pending.id)).toThrowError(BookingError);
    try {
      softDeleteReservation(pending.id);
    } catch (error) {
      expect(error).toBeInstanceOf(BookingError);
      expect((error as BookingError).code).toBe("RESERVATION_NOT_DELETABLE");
    }
  });

  it("refuses to delete a CONFIRMED reservation", () => {
    const { reservation } = createHold(holdRequest());
    submitReservationRequest({ holdId: reservation.id });
    const confirmed = updateStatus(reservation.id, "CONFIRMED");

    expect(() => softDeleteReservation(confirmed.id)).toThrowError(BookingError);
  });

  it("refuses to delete an already-deleted reservation", () => {
    const completed = makeCompletedReservation();
    softDeleteReservation(completed.id);

    try {
      softDeleteReservation(completed.id);
      throw new Error("expected softDeleteReservation to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BookingError);
      expect((error as BookingError).code).toBe("RESERVATION_ALREADY_DELETED");
    }
  });

  it("refuses to delete a reservation that doesn't exist", () => {
    expect(() => softDeleteReservation("not-a-real-id")).toThrowError(BookingError);
  });

  it("never physically removes the row — getById still returns it after deletion", () => {
    const completed = makeCompletedReservation();
    softDeleteReservation(completed.id);

    const fetched = getById(completed.id);
    expect(fetched).toBeDefined();
    expect(fetched?.deletedAt).not.toBeNull();
  });

  it("excludes a deleted reservation from listAll(), with or without a status filter", () => {
    const completed = makeCompletedReservation();
    softDeleteReservation(completed.id);

    expect(listAll().map((r) => r.id)).not.toContain(completed.id);
    expect(listAll(["COMPLETED"]).map((r) => r.id)).not.toContain(completed.id);
  });

  it("excludes a deleted reservation from searchReservations()", () => {
    const completed = makeCompletedReservation({
      customer: { name: "Deletable Dana", phone: "+82 10-1234-5678", email: "dana.deletable@example.com", preferredLanguage: "en" },
    });
    softDeleteReservation(completed.id);

    expect(searchReservations("Deletable").map((r) => r.id)).not.toContain(completed.id);
    expect(searchReservations(completed.reservationNumber).map((r) => r.id)).not.toContain(completed.id);
  });

  it("does not change status to CANCELLED — deletion and cancellation are unrelated", () => {
    const completed = makeCompletedReservation();
    const deleted = softDeleteReservation(completed.id);

    expect(deleted.status).not.toBe("CANCELLED");
    expect(deleted.status).toBe("COMPLETED");
  });
});
