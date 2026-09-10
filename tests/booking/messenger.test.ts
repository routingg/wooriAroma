import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import { FakeD1Database } from "../fakeD1";
import { messengerLink } from "@/lib/booking/messenger";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { createHold } from "@/lib/repositories/reservationRepository";
import type { ReservationHoldRequest } from "@/lib/booking/validation";

setupFreshDb();

function request(messenger?: ReservationHoldRequest["customer"]["messenger"]): ReservationHoldRequest {
  return {
    serviceOptionId: "aroma-oil-90", guestCount: 1, date: "2099-11-04", time: "10:00",
    locale: "en", source: "DIRECT",
    customer: { name: "Overseas Guest", email: "guest@example.com", phone: "+1 415-555-0100", messenger, preferredLanguage: "en" },
  };
}

describe("messenger deep links", () => {
  it("links WhatsApp numbers and Telegram usernames", () => {
    expect(messengerLink({ app: "WHATSAPP", handle: "+82 10-1234-5678" })).toBe("https://wa.me/821012345678");
    expect(messengerLink({ app: "TELEGRAM", handle: "@janedoe" })).toBe("https://t.me/janedoe");
  });

  it("returns null instead of inventing a link that would not open a conversation", () => {
    // WeChat has no public web scheme, t.me cannot resolve a phone number,
    // and too few digits would send staff to somebody else's WhatsApp.
    expect(messengerLink({ app: "WECHAT", handle: "wechat_id" })).toBeNull();
    expect(messengerLink({ app: "TELEGRAM", handle: "+82 10-1234-5678" })).toBeNull();
    expect(messengerLink({ app: "WHATSAPP", handle: "12345" })).toBeNull();
  });
});

describe("messenger persistence", () => {
  it("stores the messenger contact with the booking and reads it back", async () => {
    const { customer } = await createHold(request({ app: "WECHAT", handle: "guest_wx_01" }));
    expect(customer.messenger).toEqual({ app: "WECHAT", handle: "guest_wx_01" });
    expect(await getCustomerById(customer.id)).toEqual(customer);
  });

  it("leaves the messenger null when the guest skipped the optional field", async () => {
    const { customer } = await createHold(request());
    expect(customer.messenger).toBeNull();
    expect(await getCustomerById(customer.id)).toEqual(customer);
  });
});

/**
 * Production sat at 0006 with real rows while 0007/0008/0009 were pending, so
 * a fresh-database run proves nothing about that upgrade. This rehearses the
 * exact backlog against the exact pre-0007 schema production reported.
 */
describe("upgrading a 0006-era database that already holds bookings", () => {
  const PENDING = [
    "0007_customer_contact_isolation.sql",
    "0008_admin_booking_alerts.sql",
    "0009_customer_messenger.sql",
  ];

  function seededDb(): FakeD1Database {
    const db = new FakeD1Database();
    const dir = join(process.cwd(), "migrations");
    for (const file of ["0001_init.sql", "0002_notifications.sql", "0003_agent_handoffs.sql",
      "0004_notifications_v2.sql", "0005_pending_reservation_status.sql", "0006_reservation_soft_delete.sql"]) {
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
    return db;
  }

  function applyPending(db: FakeD1Database): void {
    const dir = join(process.cwd(), "migrations");
    for (const file of PENDING) db.applyMigrationScript(readFileSync(join(dir, file), "utf8"));
  }

  it("starts from the schema production reported, without the messenger columns", async () => {
    const db = seededDb();
    try {
      const { sql } = (await db
        .prepare("SELECT sql FROM sqlite_master WHERE name = 'customers'")
        .first<{ sql: string }>())!;
      expect(sql).toContain("email TEXT NOT NULL UNIQUE");
      expect(sql).not.toContain("messenger_app");
    } finally {
      db.close();
    }
  });

  it("keeps every existing row and foreign key through the whole backlog", async () => {
    const db = seededDb();
    try {
      const before = {
        customer: await db.prepare("SELECT * FROM customers").first<Record<string, unknown>>(),
        reservation: await db.prepare("SELECT * FROM reservations").first(),
        notification: await db.prepare("SELECT * FROM notifications").first(),
      };
      applyPending(db);
      // The messenger columns are the only difference on the customer row.
      expect(await db.prepare("SELECT * FROM customers").first()).toEqual({
        ...before.customer,
        messenger_app: null,
        messenger_handle: null,
      });
      expect(await db.prepare("SELECT * FROM reservations").first()).toEqual(before.reservation);
      expect(await db.prepare("SELECT * FROM notifications").first()).toEqual(before.notification);
      expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("accepts a messenger booking and rejects an unsupported app afterwards", async () => {
    const db = seededDb();
    try {
      applyPending(db);
      await expect(
        db.prepare(
          `INSERT INTO customers (id, name, phone, email, preferred_language, messenger_app, messenger_handle, created_at, updated_at)
           VALUES ('c2', 'New Guest', '+14155550100', 'new@example.com', 'en', 'WHATSAPP', '+14155550100', '2026-02-01', '2026-02-01')`,
        ).run(),
      ).resolves.toMatchObject({ success: true });
      await expect(
        db.prepare(
          `INSERT INTO customers (id, name, phone, email, preferred_language, messenger_app, messenger_handle, created_at, updated_at)
           VALUES ('c3', 'Bad Guest', '+14155550101', 'bad@example.com', 'en', 'LINE', 'bad', '2026-02-01', '2026-02-01')`,
        ).run(),
      ).rejects.toThrow();
    } finally {
      db.close();
    }
  });

  it("stops rejecting a repeat guest who reuses an email, which 0006 still blocked", async () => {
    const db = seededDb();
    const repeat = `INSERT INTO customers (id, name, phone, email, preferred_language, created_at, updated_at)
       VALUES ('c9', 'Existing Guest', '+821012345678', 'old@example.com', 'en', '2026-03-01', '2026-03-01')`;
    try {
      await expect(db.prepare(repeat).run()).rejects.toThrow();
      applyPending(db);
      await expect(db.prepare(repeat).run()).resolves.toMatchObject({ success: true });
    } finally {
      db.close();
    }
  });

  it("creates the admin alert trigger so a HOLD becoming PENDING enqueues one alert", async () => {
    const db = seededDb();
    try {
      applyPending(db);
      await db.prepare("UPDATE reservations SET status = 'HOLD' WHERE id = 'r1'").run();
      await db.prepare("UPDATE reservations SET status = 'PENDING', updated_at = '2026-04-01' WHERE id = 'r1'").run();
      expect(await db.prepare("SELECT reservation_id, status FROM admin_booking_alerts").first()).toEqual({
        reservation_id: "r1",
        status: "PENDING",
      });
    } finally {
      db.close();
    }
  });
});
