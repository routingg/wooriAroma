import { afterEach, describe, expect, it } from "vitest";
import { resolveEmailDeliveryMode, resolveEmailRecipient } from "@/lib/notifications/recipientPolicy";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveEmailDeliveryMode — fail-safe default", () => {
  it("is sandbox when EMAIL_DELIVERY_MODE is unset", () => {
    delete process.env.EMAIL_DELIVERY_MODE;
    expect(resolveEmailDeliveryMode()).toBe("sandbox");
  });

  it("is sandbox for an empty string", () => {
    process.env.EMAIL_DELIVERY_MODE = "";
    expect(resolveEmailDeliveryMode()).toBe("sandbox");
  });

  it("is sandbox for an unrecognized/misspelled value", () => {
    process.env.EMAIL_DELIVERY_MODE = "prod";
    expect(resolveEmailDeliveryMode()).toBe("sandbox");
  });

  it("is production only for the exact string 'production'", () => {
    process.env.EMAIL_DELIVERY_MODE = "production";
    expect(resolveEmailDeliveryMode()).toBe("production");
  });
});

describe("resolveEmailRecipient", () => {
  it("sandbox mode redirects the real customer address to EMAIL_TEST_RECIPIENT", () => {
    delete process.env.EMAIL_DELIVERY_MODE;
    process.env.EMAIL_TEST_RECIPIENT = "test@example.com";

    const result = resolveEmailRecipient("customer@example.com");

    expect(result).toEqual({ recipient: "test@example.com", redirected: true });
  });

  it("sandbox mode with no test recipient configured skips sending entirely (never the real customer)", () => {
    delete process.env.EMAIL_DELIVERY_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;

    const result = resolveEmailRecipient("customer@example.com");

    expect(result.recipient).toBeNull();
    expect(result.skippedReason).toBe("sandbox_mode_no_test_recipient");
  });

  it("production mode sends to the real customer address", () => {
    process.env.EMAIL_DELIVERY_MODE = "production";
    process.env.EMAIL_TEST_RECIPIENT = "test@example.com";

    const result = resolveEmailRecipient("customer@example.com");

    expect(result).toEqual({ recipient: "customer@example.com", redirected: false });
  });

  it("does not report a redirect when the test recipient happens to equal the customer address", () => {
    delete process.env.EMAIL_DELIVERY_MODE;
    process.env.EMAIL_TEST_RECIPIENT = "same@example.com";

    const result = resolveEmailRecipient("same@example.com");

    expect(result).toEqual({ recipient: "same@example.com", redirected: false });
  });
});
