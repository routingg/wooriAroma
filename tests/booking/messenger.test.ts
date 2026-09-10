import { describe, expect, it } from "vitest";
import { setupFreshDb } from "../dbTestUtils";
import { messengerLink } from "@/lib/booking/messenger";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { createHold } from "@/lib/repositories/reservationRepository";
import type { ReservationHoldRequest } from "@/lib/booking/validation";

setupFreshDb();

function request(messenger?: ReservationHoldRequest["customer"]["messenger"]): ReservationHoldRequest {
  return {
    serviceOptionId: "aroma-oil-90", guestCount: 1, date: "2099-11-04", time: "10:00",
    locale: "en", source: "DIRECT",
    customer: { name: "Overseas Guest", email: "guest@example.com", phone: "+1 415-555-0100", messenger, preferredLanguage: "en" },
  };
}

describe("messenger deep links", () => {
  it("links WhatsApp numbers and Telegram usernames", () => {
    expect(messengerLink({ app: "WHATSAPP", handle: "+82 10-1234-5678" })).toBe("https://wa.me/821012345678");
    expect(messengerLink({ app: "TELEGRAM", handle: "@janedoe" })).toBe("https://t.me/janedoe");
  });

  it("returns null instead of inventing a link that would not open a conversation", () => {
    // WeChat has no public web scheme, t.me cannot resolve a phone number,
    // and too few digits would send staff to somebody else's WhatsApp.
    expect(messengerLink({ app: "WECHAT", handle: "wechat_id" })).toBeNull();
    expect(messengerLink({ app: "TELEGRAM", handle: "+82 10-1234-5678" })).toBeNull();
    expect(messengerLink({ app: "WHATSAPP", handle: "12345" })).toBeNull();
  });
});

describe("messenger persistence", () => {
  it("stores the messenger contact with the booking and reads it back", async () => {
    const { customer } = await createHold(request({ app: "WECHAT", handle: "guest_wx_01" }));
    expect(customer.messenger).toEqual({ app: "WECHAT", handle: "guest_wx_01" });
    expect(await getCustomerById(customer.id)).toEqual(customer);
  });

  it("leaves the messenger null when the guest skipped the optional field", async () => {
    const { customer } = await createHold(request());
    expect(customer.messenger).toBeNull();
    expect(await getCustomerById(customer.id)).toEqual(customer);
  });
});
