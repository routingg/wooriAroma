import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// See tests/notifications/reminderService.test.ts for why this stub is
// needed under Vitest — real translated text isn't asserted on below, only
// the structural HTML/attachment output the sandbox and map-attachment
// behavior actually produce.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import { resendEmailProvider } from "@/lib/notifications/providers/email";
import { SKETCHMAP_CONTENT_ID } from "@/lib/notifications/mapAttachment";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";

const ORIGINAL_ENV = { ...process.env };

function payload(overrides: Partial<ReservationNotificationPayload> = {}): ReservationNotificationPayload {
  return {
    event: "RESERVATION_CONFIRMED",
    reservationId: "res-1",
    reservationNumber: "WA-20260101-001",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerPhone: "+82 10-1234-5678",
    preferredLanguage: "en",
    date: "2026-01-01",
    time: "16:00",
    guestCount: 2,
    treatmentName: "Aroma Oil",
    durationMinutes: 90,
    totalAmount: 280_000,
    depositAmount: 20_000,
    remainingAmount: 260_000,
    status: "CONFIRMED",
    ...overrides,
  };
}

/** Typed so `.mock.calls[0][1]` (the fetch `init`, carrying the JSON body) is well-typed rather than an empty tuple. */
function createFetchOkMock(id = "email-1") {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify({ id }), { status: 200 }),
  );
}

interface ParsedEmailRequestBody {
  to?: string;
  html?: string;
  attachments?: { filename: string; content_id: string; content: string; content_type: string }[];
}

function requestBody(fetchMock: ReturnType<typeof createFetchOkMock>): ParsedEmailRequestBody {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as ParsedEmailRequestBody;
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("resendEmailProvider — missing configuration", () => {
  it("returns SKIPPED/provider_not_configured instead of throwing when RESEND_API_KEY is unset", async () => {
    const result = await resendEmailProvider.send(payload());
    expect(result.status).toBe("SKIPPED");
    expect(result.provider).toBe("resend");
    expect(result.reason).toBe("provider_not_configured");
  });

  it("never fabricates a successful send when only RESEND_FROM_EMAIL is set", async () => {
    process.env.RESEND_FROM_EMAIL = "reservations@wooriaroma.test";
    const result = await resendEmailProvider.send(payload());
    expect(result.status).toBe("SKIPPED");
  });
});

describe("resendEmailProvider — sandbox/production recipient policy", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "reservations@wooriaroma.test";
  });

  it("sandbox mode (default) redirects delivery to EMAIL_TEST_RECIPIENT, never the real customer", async () => {
    delete process.env.EMAIL_DELIVERY_MODE;
    process.env.EMAIL_TEST_RECIPIENT = "sandbox@example.com";
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resendEmailProvider.send(payload({ customerEmail: "real-customer@example.com" }));

    expect(result).toMatchObject({ status: "SENT", redirected: true });
    const body = requestBody(fetchMock);
    expect(body.to).toBe("sandbox@example.com");
  });

  it("sandbox mode with no EMAIL_TEST_RECIPIENT skips the send entirely instead of falling back to the customer", async () => {
    delete process.env.EMAIL_DELIVERY_MODE;
    delete process.env.EMAIL_TEST_RECIPIENT;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resendEmailProvider.send(payload({ customerEmail: "real-customer@example.com" }));

    expect(result).toMatchObject({ status: "SKIPPED", reason: "sandbox_mode_no_test_recipient" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("production mode delivers to the real customer address", async () => {
    process.env.EMAIL_DELIVERY_MODE = "production";
    process.env.EMAIL_TEST_RECIPIENT = "sandbox@example.com";
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resendEmailProvider.send(payload({ customerEmail: "real-customer@example.com" }));

    expect(result).toMatchObject({ status: "SENT", redirected: false });
    const body = requestBody(fetchMock);
    expect(body.to).toBe("real-customer@example.com");
  });

  it("an unrecognized EMAIL_DELIVERY_MODE value fails safe into sandbox, never sending to the customer", async () => {
    process.env.EMAIL_DELIVERY_MODE = "prod"; // typo — must NOT be treated as production
    process.env.EMAIL_TEST_RECIPIENT = "sandbox@example.com";
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);

    await resendEmailProvider.send(payload({ customerEmail: "real-customer@example.com" }));

    const body = requestBody(fetchMock);
    expect(body.to).toBe("sandbox@example.com");
  });
});

describe("resendEmailProvider — sketchmap.png inline attachment", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "reservations@wooriaroma.test";
    process.env.EMAIL_DELIVERY_MODE = "production";
  });

  it("attaches sketchmap.png with a cid: reference in the HTML for a confirmation email", async () => {
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);

    await resendEmailProvider.send(payload({ event: "RESERVATION_CONFIRMED" }));

    const body = requestBody(fetchMock);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments?.[0]).toMatchObject({ filename: "sketchmap.png", content_id: SKETCHMAP_CONTENT_ID });
    expect(body.html).toContain(`cid:${SKETCHMAP_CONTENT_ID}`);
  });

  it("omits the attachment when includeMap: false is passed explicitly", async () => {
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);

    await resendEmailProvider.send(payload({ event: "RESERVATION_CONFIRMED" }), { includeMap: false });

    const body = requestBody(fetchMock);
    expect(body.attachments).toBeUndefined();
    expect(body.html).not.toContain("cid:");
  });

  it("omits the map by default for a cancellation email", async () => {
    const fetchMock = createFetchOkMock();
    vi.stubGlobal("fetch", fetchMock);

    await resendEmailProvider.send(payload({ event: "RESERVATION_CANCELLED" }));

    const body = requestBody(fetchMock);
    expect(body.attachments).toBeUndefined();
  });
});
