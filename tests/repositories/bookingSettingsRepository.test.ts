import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import { getBookingSettings, updateBookingSettings } from "@/lib/repositories/bookingSettingsRepository";

setupFreshDb();

describe("bookingSettingsRepository", () => {
  it("defaults to the historical 60/60 minute buffer, seeded by the migration", async () => {
    expect(await getBookingSettings()).toEqual({ prepMinutes: 60, cleanupMinutes: 60 });
  });

  it("persists an admin update and returns it on the next read", async () => {
    await updateBookingSettings({ prepMinutes: 15, cleanupMinutes: 30 });
    expect(await getBookingSettings()).toEqual({ prepMinutes: 15, cleanupMinutes: 30 });
  });

  it("allows a zero buffer — back-to-back treatments with no gap", async () => {
    await updateBookingSettings({ prepMinutes: 0, cleanupMinutes: 0 });
    expect(await getBookingSettings()).toEqual({ prepMinutes: 0, cleanupMinutes: 0 });
  });

  it("upserts in place rather than accumulating rows", async () => {
    await updateBookingSettings({ prepMinutes: 10, cleanupMinutes: 10 });
    await updateBookingSettings({ prepMinutes: 20, cleanupMinutes: 20 });
    expect(await getBookingSettings()).toEqual({ prepMinutes: 20, cleanupMinutes: 20 });
  });
});
