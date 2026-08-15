import { describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

// See tests/notifications/reminderService.test.ts — the "executes a
// whitelisted tool" case below calls getServices, which awaits
// getTranslations directly.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import { ALLOWED_AGENT_TOOL_NAMES, runAgentTool } from "@/lib/agent/toolRunner";

setupFreshDb();

const ctx = { locale: "en" as const };

describe("agent tool runner", () => {
  it("exposes exactly the customer-safe tool set — no more, no less", () => {
    expect([...ALLOWED_AGENT_TOOL_NAMES].sort()).toEqual(
      [
        "getServices",
        "getAvailability",
        "calculatePrice",
        "createReservationRequest",
        "getReservationStatus",
        "handoffToAdmin",
      ].sort(),
    );
  });

  it("never registers an admin-only or database-mutating tool name", () => {
    const forbidden = [
      "confirmReservation",
      "forceCreateReservation",
      "changePrice",
      "applyDiscount",
      "refund",
      "deleteReservation",
      "modifyAnotherReservation",
      "openBlockedTime",
      "modifyBusinessHours",
      "adminAction",
      "directDatabaseWrite",
      "sendConfirmationEmail",
      "updateStatus",
    ];
    for (const name of forbidden) {
      expect(ALLOWED_AGENT_TOOL_NAMES).not.toContain(name);
    }
  });

  it("rejects an unknown tool name before running any domain code", async () => {
    const result = await runAgentTool("dropAllReservations", {}, ctx);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("UNKNOWN_TOOL");
  });

  it("rejects a forbidden-by-name call the same way as any other unknown tool", async () => {
    const result = await runAgentTool("confirmReservation", { holdId: "x" }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("UNKNOWN_TOOL");
  });

  it("rejects invalid/missing arguments instead of trusting Gemini's payload", async () => {
    const missingDate = await runAgentTool("getAvailability", { serviceOptionId: "aroma-oil-90", partySize: 2 }, ctx);
    expect(missingDate.ok).toBe(false);
    expect(missingDate.error?.code).toBe("VALIDATION_ERROR");

    const wrongType = await runAgentTool(
      "calculatePrice",
      { serviceOptionId: "aroma-oil-90", partySize: "not-a-number" },
      ctx,
    );
    expect(wrongType.ok).toBe(false);
    expect(wrongType.error?.code).toBe("VALIDATION_ERROR");
  });

  it("executes a whitelisted tool and returns real data, resolved for the request's locale", async () => {
    const result = await runAgentTool("getServices", {}, ctx);
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("surfaces a domain BookingError as a structured, non-throwing result", async () => {
    const result = await runAgentTool("calculatePrice", { serviceOptionId: "does-not-exist", partySize: 2 }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("SERVICE_NOT_BOOKABLE");
  });
});
