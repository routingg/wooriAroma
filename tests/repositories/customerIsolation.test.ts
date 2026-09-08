import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import { FakeD1Database } from "../fakeD1";
import { getDb } from "@/lib/db/client";
import { createHold } from "@/lib/repositories/reservationRepository";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import type { ReservationHoldRequest } from "@/lib/booking/validation";

setupFreshDb();

function request(name = "Original Guest", time = "10:00"): ReservationHoldRequest {
  return {
    serviceOptionId: "aroma-oil-90", guestCount: 1, date: "2099-10-20", time,
    locale: "en", source: "DIRECT",
    customer: { name, email: "guest@example.com", phone: "+82 10-1234-5678", preferredLanguage: "en" },
  };
}

describe("anonymous booking contact isolation", () => {
  it("keeps earlier contact details intact when another booking uses the same email", async () => {
    const first = await createHold(request());
    const later = request("Different Guest", "16:00");
    later.customer.phone = "+82 10-9999-9999";
    later.customer.email = "GUEST@example.com";
    const second = await createHold(later);
    expect(second.customer.id).not.toBe(first.customer.id);
    expect(second.customer.email).toBe(first.customer.email);
    expect(await getCustomerById(first.customer.id)).toEqual(first.customer);
    expect(await getCustomerById(second.customer.id)).toMatchObject({ name: "Different Guest", phone: later.customer.phone });
  });

  it("does not retain contact details from a rejected slot request", async () => {
    const first = await createHold(request());
    await expect(createHold(request("Rejected Guest"))).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    expect(await getDb().prepare("SELECT count(*) AS n FROM customers").first()).toEqual({ n: 1 });
    expect(await getCustomerById(first.customer.id)).toEqual(first.customer);
  });

  it("rolls back the contact if the reservation write fails", async () => {
    const invalid = { ...request(), source: "INVALID" } as unknown as ReservationHoldRequest;
    await expect(createHold(invalid)).rejects.toThrow();
    expect(await getDb().prepare("SELECT count(*) AS n FROM customers").first()).toEqual({ n: 0 });
    expect(await getDb().prepare("SELECT count(*) AS n FROM reservations").first()).toEqual({ n: 0 });
  });

  it("accepts only one simultaneous slot request, retaining only its contact", async () => {
    const results = await Promise.allSettled([createHold(request("Guest A")), createHold(request("Guest B"))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "SLOT_UNAVAILABLE" } });
    expect(await getDb().prepare("SELECT count(*) AS n FROM customers").first()).toEqual({ n: 1 });
    expect(await getDb().prepare("SELECT count(*) AS n FROM reservations").first()).toEqual({ n: 1 });
  });
});

describe("customer isolation migration with existing records", () => {
  it("preserves customer, reservation and notification rows and enforces foreign keys", async () => {
    const db = new FakeD1Database();
    try {
      const dir = join(process.cwd(), "migrations");
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql") && f < "0007").sort()) {
        db.applyMigrationScript(readFileSync(join(dir, file), "utf8"));
      }
      db.applyMigrationScript(`
        INSERT INTO customers VALUES ('c1', 'Existing Guest', '+821012345678', 'old@example.com', 'en', '2026-01-01', '2026-01-01', 1);
        INSERT INTO reservations (id, reservation_number, customer_id, service_option_id, duration_minutes,
          guest_count, date_key, service_start, service_end, blocked_start, blocked_end, price_per_person,
          total_amount, deposit_amount, remaining_amount, status, locale, created_at, updated_at)
        VALUES ('r1', 'WA-20260101-001', 'c1', 'aroma-oil-90', 90, 1, '2026-01-01', '10:00', '11:30', '09:00', '12:30',
          140000, 140000, 0, 140000, 'PENDING', 'en', '2026-01-01', '2026-01-01');
        INSERT INTO notifications (id, reservation_id, channel, event_type, recipient, status, created_at)
        VALUES ('n1', 'r1', 'EMAIL', 'RESERVATION_REQUEST_RECEIVED', 'old@example.com', 'SENT', '2026-01-01');
      `);
      const customerBefore = await db.prepare("SELECT * FROM customers").first();
      const reservationBefore = await db.prepare("SELECT * FROM reservations").first();
      const notificationBefore = await db.prepare("SELECT * FROM notifications").first();
      db.applyMigrationScript(readFileSync(join(dir, "0007_customer_contact_isolation.sql"), "utf8"));
      expect(await db.prepare("SELECT * FROM customers").first()).toEqual(customerBefore);
      expect(await db.prepare("SELECT * FROM reservations").first()).toEqual(reservationBefore);
      expect(await db.prepare("SELECT * FROM notifications").first()).toEqual(notificationBefore);
      expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
      await expect(db.prepare("DELETE FROM customers WHERE id = 'c1'").run()).rejects.toThrow();
      await expect(db.prepare("INSERT INTO customers SELECT 'c2', name, phone, email, preferred_language, created_at, updated_at, whatsapp_opt_in FROM customers WHERE id = 'c1'").run()).resolves.toMatchObject({ success: true });
    } finally {
      db.close();
    }
  });
});
