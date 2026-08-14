import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import { POST as createHoldRoute } from "@/app/api/reservation-holds/route";
import { POST as confirmRoute } from "@/app/api/reservations/route";
import { GET as getByNumberRoute } from "@/app/api/reservations/[reservationNumber]/route";
import { GET as availabilityRoute } from "@/app/api/availability/route";

setupFreshDb();

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Route handlers return plain fetch Responses — read the body as loosely-typed JSON for assertions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJson(res: Response): Promise<any> {
  return res.json();
}

const customer = {
  name: "Jane Doe",
  phone: "+82 10-1234-5678",
  email: "jane@example.com",
  preferredLanguage: "en",
};

describe("reservation-holds + reservations API routes", () => {
  it("creates a hold, rejects a conflicting one, then submits as PENDING and can be looked up", async () => {
    const date = futureDateKey(5);

    const holdRes = await createHoldRoute(
      jsonRequest("http://localhost/api/reservation-holds", {
        serviceOptionId: "aroma-oil-90",
        guestCount: 2,
        date,
        time: "16:00",
        locale: "en",
        customer,
      }),
    );
    expect(holdRes.status).toBe(201);
    const hold = await readJson(holdRes);
    expect(hold.reservationNumber).toMatch(/^WA-\d{8}-\d{3}$/);
    expect(hold.pricing.totalAmount).toBe(280_000);

    // T04/T05 at the HTTP layer: a second, conflicting hold request is rejected.
    const conflictRes = await createHoldRoute(
      jsonRequest("http://localhost/api/reservation-holds", {
        serviceOptionId: "aroma-oil-90",
        guestCount: 4,
        date,
        time: "16:00",
        locale: "en",
        customer: { ...customer, email: "other@example.com" },
      }),
    );
    expect(conflictRes.status).toBe(409);
    const conflictBody = await readJson(conflictRes);
    expect(conflictBody.error.code).toBe("SLOT_UNAVAILABLE");

    // No deposit/payment is collected — submitting only requires the holdId
    // (AGENTS.md deposit removal). The reservation lands as PENDING, not
    // CONFIRMED, until an admin reviews and approves it.
    const submitRes = await confirmRoute(
      jsonRequest("http://localhost/api/reservations", {
        holdId: hold.holdId,
      }),
    );
    expect(submitRes.status).toBe(200);
    const submitted = await readJson(submitRes);
    expect(submitted.reservation.status).toBe("PENDING");
    expect(submitted.reservation.customerName).toBe("Jane Doe");

    const lookupRes = await getByNumberRoute(new Request(`http://localhost/api/reservations/${hold.reservationNumber}`), {
      params: Promise.resolve({ reservationNumber: hold.reservationNumber }),
    });
    expect(lookupRes.status).toBe(200);
    const lookup = await readJson(lookupRes);
    expect(lookup.reservation.status).toBe("PENDING");

    // A PENDING request still occupies the slot until an admin acts on it.
    const availRes = await availabilityRoute(
      new Request(`http://localhost/api/availability?date=${date}&serviceOptionId=aroma-oil-90`),
    );
    const avail = await readJson(availRes);
    const at1600 = avail.slots.find((s: { time: string }) => s.time === "16:00");
    expect(at1600.available).toBe(false);
  });

  it("T09-adjacent: never returns a PENDING/CONFIRMED reservation for a holdId that was never submitted", async () => {
    const date = futureDateKey(5);
    const holdRes = await createHoldRoute(
      jsonRequest("http://localhost/api/reservation-holds", {
        serviceOptionId: "aroma-oil-90",
        guestCount: 1,
        date,
        time: "10:00",
        locale: "en",
        customer,
      }),
    );
    const hold = await readJson(holdRes);

    const lookupRes = await getByNumberRoute(new Request(`http://localhost/api/reservations/${hold.reservationNumber}`), {
      params: Promise.resolve({ reservationNumber: hold.reservationNumber }),
    });
    const lookup = await readJson(lookupRes);
    expect(lookup.reservation.status).toBe("HOLD");
    expect(lookup.reservation.status).not.toBe("PENDING");
    expect(lookup.reservation.status).not.toBe("CONFIRMED");
  });

  it("returns RESERVATION_NOT_FOUND for an unknown reservation number", async () => {
    const res = await getByNumberRoute(new Request("http://localhost/api/reservations/WA-00000000-999"), {
      params: Promise.resolve({ reservationNumber: "WA-00000000-999" }),
    });
    expect(res.status).toBe(404);
  });
});
