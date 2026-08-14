import { describe, expect, it, vi } from "vitest";
import { setupFreshDb } from "../dbTestUtils";

setupFreshDb();

// Mirrors tests/notifications/manualPayload.test.ts — only structural output
// is asserted below, not exact translated prose.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import {
  DEFAULT_CLOSING_TEXT,
  DEFAULT_CONFIRM_TEXT,
  DEFAULT_INTRO_TEXT,
  DEFAULT_PRIVACY_TEXT,
  DEFAULT_VISIT_TEXT,
  generateConfirmationEmail,
  resolveConfirmationEmailFields,
} from "@/lib/admin/confirmationEmailTemplate";
import { BUSINESS, confirmationEmailMapsUrl } from "@/lib/config/business";
import { createHold, submitReservationRequest } from "@/lib/repositories/reservationRepository";
import { getCustomerById } from "@/lib/repositories/customerRepository";

function futureDateKey(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function makeReservationFields(overrides: { name?: string } = {}) {
  const { reservation } = createHold({
    serviceOptionId: "aroma-oil-90",
    guestCount: 2,
    date: futureDateKey(7),
    time: "15:00",
    locale: "en",
    source: "DIRECT",
    customer: {
      name: overrides.name ?? "Jane Doe",
      phone: "+82 10-1234-5678",
      email: "jane@example.com",
      preferredLanguage: "en",
    },
  });
  const submitted = submitReservationRequest({ holdId: reservation.id });
  const customer = getCustomerById(submitted.customerId)!;
  return resolveConfirmationEmailFields(submitted, customer);
}

const baseTextFields = {
  introText: DEFAULT_INTRO_TEXT,
  confirmText: DEFAULT_CONFIRM_TEXT,
  privacyText: DEFAULT_PRIVACY_TEXT,
  visitText: DEFAULT_VISIT_TEXT,
  closingText: DEFAULT_CLOSING_TEXT,
};

describe("resolveConfirmationEmailFields", () => {
  it("returns null when the service option can no longer be resolved", async () => {
    const { reservation } = createHold({
      serviceOptionId: "aroma-oil-90",
      guestCount: 1,
      date: futureDateKey(7),
      time: "10:00",
      locale: "en",
      source: "DIRECT",
      customer: { name: "X", phone: "+82 10-1234-5678", email: "x@example.com", preferredLanguage: "en" },
    });
    const submitted = submitReservationRequest({ holdId: reservation.id });
    const customer = getCustomerById(submitted.customerId)!;

    const fields = await resolveConfirmationEmailFields({ ...submitted, serviceOptionId: "nope" }, customer);
    expect(fields).toBeNull();
  });
});

describe("generateConfirmationEmail", () => {
  it("greets by first name only and echoes the given subject", async () => {
    const fields = (await makeReservationFields({ name: "Jane Doe" }))!;
    const result = generateConfirmationEmail({
      subject: "Custom Subject Line",
      ...fields,
      ...baseTextFields,
    });

    expect(result.subject).toBe("Custom Subject Line");
    expect(result.plainText.startsWith("Dear Jane,")).toBe(true);
    expect(result.plainText).not.toContain("Doe,");
    expect(result.html).toContain("Dear Jane,");
  });

  it("falls back to 'Dear Guest,' instead of inventing a name", async () => {
    const fields = (await makeReservationFields({ name: "   " }))!;
    const result = generateConfirmationEmail({ subject: "S", ...fields, ...baseTextFields });

    expect(result.plainText.startsWith("Dear Guest,")).toBe(true);
    expect(result.html).toContain("Dear Guest,");
  });

  it("includes reservation details in both html and plain text, with no undefined/null/NaN", async () => {
    const fields = (await makeReservationFields())!;
    const result = generateConfirmationEmail({ subject: "S", ...fields, ...baseTextFields });

    expect(result.plainText).toContain("Duration: 90 minutes");
    expect(result.plainText).toContain("Guests: 2");
    expect(result.html).toContain("90 minutes");
    expect(result.html).toContain(">2<");

    expect(result.html).not.toMatch(/undefined|null|NaN/i);
    expect(result.plainText).not.toMatch(/undefined|null|NaN/i);
  });

  it("omits a detail row entirely when its value is empty, rather than rendering a blank line", () => {
    const result = generateConfirmationEmail({
      subject: "S",
      customerName: "Jane Doe",
      dateLabel: "",
      timeLabel: "",
      treatmentName: "Aroma Oil Massage",
      durationMinutes: 90,
      guestCount: 2,
      ...baseTextFields,
    });

    expect(result.plainText).not.toContain("Date:");
    expect(result.plainText).not.toContain("Time:");
    expect(result.html).not.toContain(">Date<");
    expect(result.html).not.toContain(">Time<");
  });

  it("omits the 프라이빗 스파 안내 line entirely when cleared, rather than rendering an empty block", async () => {
    const fields = (await makeReservationFields())!;
    const result = generateConfirmationEmail({ subject: "S", ...fields, ...baseTextFields, privacyText: "" });

    expect(result.plainText).not.toContain(DEFAULT_PRIVACY_TEXT);
    expect(result.html).not.toContain(DEFAULT_PRIVACY_TEXT);
  });

  it("produces Gmail-safe, self-contained, table-based HTML with the Woori Aroma brand and contact info", async () => {
    const fields = (await makeReservationFields())!;
    const result = generateConfirmationEmail({ subject: "S", ...fields, ...baseTextFields });

    expect(result.html).toContain("<table");
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("<iframe");
    expect(result.html).not.toContain("class=");
    expect(result.html).toContain("WOORI AROMA");
    expect(result.html).toContain("Instagram");
    expect(result.html).toContain("@aromatogether");
  });

  it("makes Instagram, phone and Google Maps clickable in the HTML version with the real business contact info", async () => {
    const fields = (await makeReservationFields())!;
    const result = generateConfirmationEmail({ subject: "S", ...fields, ...baseTextFields });

    expect(result.html).toContain(`href="${BUSINESS.instagramUrl}"`);
    expect(result.html).toContain(`href="${BUSINESS.phoneHref}"`);
    expect(result.html).toContain(BUSINESS.phone);
    expect(result.html).toContain(`href="${confirmationEmailMapsUrl}"`);
    expect(result.html).toContain("View on Google Maps");
  });

  it("includes Instagram, phone and the exact Google Maps URL in the plain-text version", async () => {
    const fields = (await makeReservationFields())!;
    const result = generateConfirmationEmail({ subject: "S", ...fields, ...baseTextFields });

    expect(result.plainText).toContain(`Instagram: ${BUSINESS.instagramHandle}`);
    expect(result.plainText).toContain(`Phone: ${BUSINESS.phone}`);
    expect(result.plainText).toContain(`Google Maps:\n${confirmationEmailMapsUrl}`);
  });

  it("reflects live edits to all five text blocks in both html and plain text", async () => {
    const fields = (await makeReservationFields())!;
    const result = generateConfirmationEmail({
      subject: "S",
      ...fields,
      introText: "Custom intro line.",
      confirmText: "Custom confirm line.",
      privacyText: "Custom privacy line.",
      visitText: "Custom visit line.",
      closingText: "Custom closing line.",
    });

    for (const line of [
      "Custom intro line.",
      "Custom confirm line.",
      "Custom privacy line.",
      "Custom visit line.",
      "Custom closing line.",
    ]) {
      expect(result.html).toContain(line);
      expect(result.plainText).toContain(line);
    }
  });
});
