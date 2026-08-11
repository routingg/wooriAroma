import { describe, expect, it } from "vitest";
import {
  calculateDepositAmount,
  calculateRemainingAmount,
  calculateTotalAmount,
} from "@/lib/booking/pricing";

describe("T01 pricing — Aroma Oil 90min x 2 guests", () => {
  it("computes total, deposit and remaining balance per AGENTS.md §3", () => {
    const total = calculateTotalAmount(140_000, 2);
    const deposit = calculateDepositAmount(2);
    const remaining = calculateRemainingAmount(total, deposit);

    expect(total).toBe(280_000);
    expect(deposit).toBe(20_000);
    expect(remaining).toBe(260_000);
  });
});

describe("deposit policy", () => {
  it("is ₩10,000 per guest for every group size 1-4", () => {
    expect(calculateDepositAmount(1)).toBe(10_000);
    expect(calculateDepositAmount(4)).toBe(40_000);
  });
});
