import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAdminBasicAuth } from "@/lib/admin/basicAuth";
import { requireAdmin } from "@/lib/admin/auth";

const { requestHeaders } = vi.hoisted(() => ({ requestHeaders: vi.fn() }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));

beforeEach(() => {
  vi.stubEnv("ADMIN_BASIC_AUTH_USER", "operator");
  vi.stubEnv("ADMIN_BASIC_AUTH_PASSWORD", "test-password:with-colon");
  requestHeaders.mockResolvedValue(new Headers());
});
afterEach(() => vi.unstubAllEnvs());

describe("administrator authentication", () => {
  it("rejects missing, malformed and incorrect credentials", async () => {
    for (const value of [null, "Bearer anything", "Basic %%%", `Basic ${btoa("operator:wrong")}`, `Basic ${btoa("wrong:test-password:with-colon")}`]) {
      expect(checkAdminBasicAuth(value)).toBe(false);
      requestHeaders.mockResolvedValue(new Headers(value ? { authorization: value } : {}));
      await expect(requireAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("fails closed when either server credential is not configured", async () => {
    const header = `Basic ${btoa("operator:test-password:with-colon")}`;
    vi.stubEnv("ADMIN_BASIC_AUTH_PASSWORD", "");
    expect(checkAdminBasicAuth(header)).toBe(false);
    requestHeaders.mockResolvedValue(new Headers({ authorization: header }));
    await expect(requireAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("authorizes valid credentials after reading the request headers", async () => {
    const header = `Basic ${btoa("operator:test-password:with-colon")}`;
    expect(checkAdminBasicAuth(header)).toBe(true);
    requestHeaders.mockResolvedValue(new Headers({ authorization: header }));
    await expect(requireAdmin()).resolves.toBeUndefined();
  });
});
