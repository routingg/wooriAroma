import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import { createBlockedTimeAction, deleteReservationAction, markConfirmationEmailSentAction, removeBlockedTimeAction, resolveHandoffAction, updateReservationStatusAction } from "@/app/admin/actions";
import { getManualPreviewAction, searchReservationsAction, sendManualConfirmationAction, sendManualTestEmailAction } from "@/app/admin/send-confirmation/actions";
import { revalidatePath } from "next/cache";
import { listUpcomingBlockedTimes } from "@/lib/repositories/blockedTimeRepository";
import type { ManualConfirmationInput } from "@/lib/notifications/manualPayload";

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
setupFreshDb();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_BASIC_AUTH_USER", "operator");
  vi.stubEnv("ADMIN_BASIC_AUTH_PASSWORD", "test-password");
});
afterEach(() => vi.unstubAllEnvs());

describe("admin action entry point authorization", () => {
  it("denies every exported admin action before it can access data or send email", async () => {
    const form = new FormData();
    form.set("dateKey", "2026-12-12");
    form.set("fullDay", "on");
    const input = {} as ManualConfirmationInput;
    const calls = [
      () => updateReservationStatusAction("unknown", "CANCELLED"),
      () => markConfirmationEmailSentAction("unknown", "private@example.com"),
      () => deleteReservationAction("unknown"),
      () => createBlockedTimeAction(form),
      () => removeBlockedTimeAction("unknown"),
      () => resolveHandoffAction("unknown", form),
      () => searchReservationsAction("guest"),
      () => getManualPreviewAction(input, false),
      () => sendManualConfirmationAction(input, false),
      () => sendManualTestEmailAction(input, false),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await listUpcomingBlockedTimes("2026-01-01")).toEqual([]);
  });
});
