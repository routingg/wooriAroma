import { describe, expect, it } from "vitest";
import { classifyCustomer, resolveChannels } from "@/lib/notifications/policy";

describe("classifyCustomer", () => {
  it("classifies a +82 number as KR", () => {
    expect(classifyCustomer("+82 10-1234-5678")).toBe("KR");
  });

  it("classifies a bare domestic Korean number as KR", () => {
    expect(classifyCustomer("010-1234-5678")).toBe("KR");
  });

  it("classifies a US number as INTL", () => {
    expect(classifyCustomer("+1 415-555-0132")).toBe("INTL");
  });

  it("falls back to INTL for an unparseable number", () => {
    expect(classifyCustomer("not-a-phone")).toBe("INTL");
  });
});

describe("resolveChannels", () => {
  it("routes a +82 customer to email + kakao (never whatsapp)", () => {
    const channels = resolveChannels("RESERVATION_CONFIRMED", {
      customerPhone: "+82 10-1234-5678",
      customerEmail: "jane@example.com",
      whatsappOptIn: true, // even if somehow set, KR customers go through Kakao/SMS, not WhatsApp
    });
    expect(channels).toEqual(["EMAIL", "KAKAO"]);
  });

  it("routes an opted-in international customer to email + whatsapp", () => {
    const channels = resolveChannels("RESERVATION_CONFIRMED", {
      customerPhone: "+1 415-555-0132",
      customerEmail: "john@example.com",
      whatsappOptIn: true,
    });
    expect(channels).toEqual(["EMAIL", "WHATSAPP"]);
  });

  it("never sends whatsapp to an international customer without opt-in (cost control)", () => {
    const channels = resolveChannels("RESERVATION_CONFIRMED", {
      customerPhone: "+1 415-555-0132",
      customerEmail: "john@example.com",
      whatsappOptIn: false,
    });
    expect(channels).toEqual(["EMAIL"]);
  });

  it("omits email entirely when no address is present", () => {
    const channels = resolveChannels("RESERVATION_CONFIRMED", {
      customerPhone: "+82 10-1234-5678",
      customerEmail: "",
      whatsappOptIn: false,
    });
    expect(channels).toEqual(["KAKAO"]);
  });
});
