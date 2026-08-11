import { describe, expect, it } from "vitest";
import {
  calculateBlockedTime,
  checkBookingConflict,
  generateAvailableSlots,
  isSlotInPast,
} from "@/lib/booking/availability";

describe("calculateBlockedTime", () => {
  it("adds the 60-minute prep and cleanup buffer around the treatment window", () => {
    // AGENTS.md example: Aroma Oil 90 min, 16:00-17:30 -> blocked 15:00-18:30.
    expect(calculateBlockedTime("16:00", "17:30")).toEqual({ start: "15:00", end: "18:30" });
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
    const slots = generateAvailableSlots("2026-08-10", 90, [{ start: "13:00", end: "15:30" }], now);

    const at12 = slots.find((s) => s.time === "12:00"); // 90min -> blocked 11:00-14:30
    const at13 = slots.find((s) => s.time === "13:00"); // 90min -> blocked 12:00-15:30
    const at16 = slots.find((s) => s.time === "16:00"); // 90min -> blocked 15:00-18:30
    const at1630 = slots.find((s) => s.time === "16:30"); // 90min -> blocked 15:30-19:00

    expect(at12?.available).toBe(false); // overlaps existing 13:00-15:30
    expect(at13?.available).toBe(false); // overlaps existing 13:00-15:30
    expect(at16?.available).toBe(false); // overlaps existing 13:00-15:30
    expect(at1630?.available).toBe(true); // starts exactly when the existing window's buffer ends
  });
});
