import { describe, expect, it } from "vitest";
import {
  calculateBlockedTime,
  checkBookingConflict,
  generateAvailableSlots,
  isSlotInPast,
} from "@/lib/booking/availability";

describe("calculateBlockedTime", () => {
  it("adds the default 60-minute prep and cleanup buffer around the treatment window", () => {
    // AGENTS.md example: Aroma Oil 90 min, 16:00-17:30 -> blocked 15:00-18:30.
    expect(calculateBlockedTime("16:00", "17:30")).toEqual({ start: "15:00", end: "18:30" });
  });

  it("uses an admin-configured buffer instead of the default when given one", () => {
    expect(calculateBlockedTime("16:00", "17:30", 15, 30)).toEqual({ start: "15:45", end: "18:00" });
  });

  it("supports a zero buffer — back-to-back treatments with no gap", () => {
    expect(calculateBlockedTime("16:00", "17:30", 0, 0)).toEqual({ start: "16:00", end: "17:30" });
  });
});

describe("checkBookingConflict / T02 & T03 buffer conflicts", () => {
  const existing = [calculateBlockedTime("16:00", "17:30")]; // blocked 15:00-18:30

  it("T02: a request at 15:30 conflicts with the pre-treatment buffer", () => {
    const candidate = calculateBlockedTime("15:30", "16:30");
    expect(checkBookingConflict(candidate, existing)).toBe(true);
  });

  it("T03: a service starting exactly when the prior cleanup ends (18:30) still conflicts, because its own prep buffer starts an hour earlier", () => {
    const candidate = calculateBlockedTime("18:30", "19:30");
    expect(checkBookingConflict(candidate, existing)).toBe(true);
  });

  it("T03: a service starting late enough that its prep buffer starts at the prior cleanup boundary (19:30) does not conflict", () => {
    const candidate = calculateBlockedTime("19:30", "20:30");
    expect(checkBookingConflict(candidate, existing)).toBe(false);
  });

  it("T03: a request that would start during cleanup (18:00) conflicts", () => {
    const candidate = calculateBlockedTime("18:00", "19:00");
    expect(checkBookingConflict(candidate, existing)).toBe(true);
  });

  it("does not conflict with a window on a different day (caller is responsible for same-day scoping)", () => {
    expect(checkBookingConflict(calculateBlockedTime("16:00", "17:30"), [])).toBe(false);
  });
});

describe("isSlotInPast — Asia/Seoul, today-only restriction", () => {
  // Regression guard for AGENTS.md §5.2: selecting a future date must not
  // inherit today's current-time restriction.
  const now = { dateKey: "2026-08-10", minutes: 18 * 60 + 20 }; // 18:20 KST

  it("marks a past time on today as past", () => {
    expect(isSlotInPast("2026-08-10", "18:00", now)).toBe(true);
  });

  it("marks a not-yet-reached time on today as not past", () => {
    expect(isSlotInPast("2026-08-10", "18:30", now)).toBe(false);
  });

  it("never marks a future date's early-morning slot as past, even though it's before today's clock time", () => {
    expect(isSlotInPast("2026-08-11", "10:00", now)).toBe(false);
  });

  it("marks every slot on a past date as past regardless of the requested time", () => {
    expect(isSlotInPast("2026-08-09", "23:30", now)).toBe(true);
  });
});

describe("generateAvailableSlots", () => {
  it("marks slots unavailable only when past or conflicting, leaving everything else available", () => {
    const now = { dateKey: "2026-08-10", minutes: 9 * 60 }; // 09:00, before the 10:00 grid opens
    const slots = generateAvailableSlots("2026-08-10", 90, [{ start: "13:00", end: "15:30" }], [], now);

    const at12 = slots.find((s) => s.time === "12:00"); // 90min -> blocked 11:00-14:30
    const at13 = slots.find((s) => s.time === "13:00"); // 90min -> blocked 12:00-15:30
    const at16 = slots.find((s) => s.time === "16:00"); // 90min -> blocked 15:00-18:30
    const at1630 = slots.find((s) => s.time === "16:30"); // 90min -> blocked 15:30-19:00

    expect(at12?.available).toBe(false); // overlaps existing 13:00-15:30
    expect(at13?.available).toBe(false); // overlaps existing 13:00-15:30
    expect(at16?.available).toBe(false); // overlaps existing 13:00-15:30
    expect(at1630?.available).toBe(true); // starts exactly when the existing window's buffer ends
  });

  it("admin blocks only exclude their exact clock-time window, without a prep/cleanup spillover", () => {
    const now = { dateKey: "2026-08-10", minutes: 9 * 60 };
    // Admin block 15:00-17:00 — a raw closure window, distinct from a reservation's buffered one.
    const slots = generateAvailableSlots("2026-08-10", 90, [], [{ start: "15:00", end: "17:00" }], now);

    const at1230 = slots.find((s) => s.time === "12:30"); // 90min -> 12:30-14:00, before the block
    const at1330 = slots.find((s) => s.time === "13:30"); // 90min -> 13:30-15:00, touches the block boundary only
    const at1400 = slots.find((s) => s.time === "14:00"); // 90min -> 14:00-15:30, overlaps the block
    const at1600 = slots.find((s) => s.time === "16:00"); // 90min -> 16:00-17:30, overlaps the block
    const at1700 = slots.find((s) => s.time === "17:00"); // 90min -> 17:00-18:30, starts exactly when the block ends

    expect(at1230?.available).toBe(true);
    expect(at1330?.available).toBe(true);
    expect(at1400?.available).toBe(false);
    expect(at1600?.available).toBe(false);
    expect(at1700?.available).toBe(true);
  });

  it("respects an admin-configured zero buffer: back-to-back reservations with no gap are both available", () => {
    const now = { dateKey: "2026-08-10", minutes: 9 * 60 };
    // A confirmed 16:00-17:30 treatment, stored with the zero buffer in effect when it was booked.
    const slots = generateAvailableSlots("2026-08-10", 90, [{ start: "16:00", end: "17:30" }], [], now, {
      prepMinutes: 0,
      cleanupMinutes: 0,
    });

    const at1430 = slots.find((s) => s.time === "14:30"); // 90min -> 14:30-16:00, ends exactly when the existing one starts
    const at1600 = slots.find((s) => s.time === "16:00"); // starts exactly when the existing one starts — real conflict
    const at1730 = slots.find((s) => s.time === "17:30"); // starts exactly when the existing one ends — no buffer to wait out

    expect(at1430?.available).toBe(true);
    expect(at1600?.available).toBe(false);
    expect(at1730?.available).toBe(true);
  });
});
