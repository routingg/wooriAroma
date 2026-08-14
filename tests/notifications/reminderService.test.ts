import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

// next-intl/server's `getTranslations` resolves to a client-component stub
// that throws when Vitest resolves it outside Next.js's own "react-server"
// bundling condition (the real app runs this fine — see the Route Handler
// this reminder job is called from). This test is the first one in the
// suite to actually *await* the reminder pipeline (unlike the confirm/cancel
// paths, a cron job can't be fire-and-forget), so it's the first to need
// this stub. A minimal passthrough is enough since no test here asserts on
// translated treatment names.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import { createHold, confirmReservation } from "@/lib/repositories/reservationRepository";
import { listByReservation } from "@/lib/repositories/notificationRepository";
import { sendDueReminders } from "@/lib/booking/reminderService";

setupFreshDb();

const ORIGINAL_ENV = { ...process.env };

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "reservations@wooriaroma.test";
  // This suite tests reminder-job idempotency, not the sandbox/production
  // recipient policy (see tests/notifications/recipientPolicy.test.ts and
  // emailProvider.test.ts for that) — opt into production mode so the
  // (mocked) provider is actually invoked.
  process.env.EMAIL_DELIVERY_MODE = "production";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("sendDueReminders — idempotency", () => {
  it("sends exactly one reminder email even if the job runs twice for the same reservation", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const date = futureDateKey(6);
    const { reservation } = await createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 2,
      date,
      time: "16:00",
      locale: "en",
      source: "DIRECT",
      customer: {
        name: "Remi Nder",
        phone: "+82 10-1234-5678",
        email: "remi@example.com",
        preferredLanguage: "en",
      },
    });
    const confirmed = await confirmReservation({ holdId: reservation.id, depositTransactionId: "TEST-TX" });

    const startInstant = new Date(`${confirmed.dateKey}T${confirmed.serviceStart}:00+09:00`);
    const exactly24hBefore = new Date(startInstant.getTime() - 24 * 60 * 60 * 1000);

    const first = await sendDueReminders(exactly24hBefore);
    const second = await sendDueReminders(exactly24hBefore);

    expect(first.sent).toBeGreaterThan(0);
    expect(second.sent).toBeGreaterThan(0); // the job itself runs again — dedup happens one layer down

    // The actual observable guarantee: only one real email request ever went out.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const emailLogs = (await listByReservation(confirmed.id)).filter((l) => l.channel === "EMAIL");
    expect(emailLogs).toHaveLength(1);
    expect(emailLogs[0].status).toBe("SENT");
    expect(emailLogs[0].eventType).toBe("RESERVATION_REMINDER");
  });

  it("does not fire a reminder when the reservation is only a few hours away (outside the 24h window)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const date = futureDateKey(6);
    const { reservation } = await createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 1,
      date,
      time: "16:00",
      locale: "en",
      source: "DIRECT",
      customer: {
        name: "Too Early",
        phone: "+82 10-9999-9999",
        email: "tooearly@example.com",
        preferredLanguage: "en",
      },
    });
    const confirmed = await confirmReservation({ holdId: reservation.id, depositTransactionId: "TEST-TX-2" });

    const startInstant = new Date(`${confirmed.dateKey}T${confirmed.serviceStart}:00+09:00`);
    // Same calendar day, so it's in the candidate date range, but only 5h
    // out — well outside the ~24h reminder window.
    const fiveHoursBefore = new Date(startInstant.getTime() - 5 * 60 * 60 * 1000);

    await sendDueReminders(fiveHoursBefore);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await listByReservation(confirmed.id)).toHaveLength(0);
  });
});
