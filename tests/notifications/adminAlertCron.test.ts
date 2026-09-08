import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/notifications/adminBookingAlerts", () => ({ processAdminBookingAlerts: vi.fn() }));

import { POST } from "@/app/api/cron/notifications/route";
import { processAdminBookingAlerts } from "@/lib/notifications/adminBookingAlerts";

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => { vi.resetAllMocks(); delete process.env.CRON_SECRET; });
afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("admin alert retry cron", () => {
  it("fails closed without a configured secret or valid bearer token", async () => {
    expect((await POST(new Request("https://example.com/api/cron/notifications", { method: "POST" }))).status).toBe(503);
    process.env.CRON_SECRET = "test-secret";
    expect((await POST(new Request("https://example.com/api/cron/notifications", {
      method: "POST", headers: { authorization: "Bearer wrong-secret" },
    }))).status).toBe(401);
    expect(processAdminBookingAlerts).not.toHaveBeenCalled();
  });

  it("runs an authorized batch and exposes only aggregate results", async () => {
    process.env.CRON_SECRET = "test-secret";
    const result = { checked: 1, sent: 1, tested: 0, retrying: 0, needsReview: 0, skipped: 0 };
    vi.mocked(processAdminBookingAlerts).mockResolvedValue(result);
    const response = await POST(new Request("https://example.com/api/cron/notifications", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
