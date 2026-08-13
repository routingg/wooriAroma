import { maskRecipient } from "./devLog";

export type EmailDeliveryMode = "sandbox" | "production";

/**
 * Fail-safe by construction: only the exact string "production" enables real
 * customer delivery. Unset, empty, or misspelled values (e.g. "prod") all
 * fall through to "sandbox" — never assume an unrecognized value means
 * production (customer-safety requirement).
 */
export function resolveEmailDeliveryMode(): EmailDeliveryMode {
  return process.env.EMAIL_DELIVERY_MODE === "production" ? "production" : "sandbox";
}

export interface EmailRecipientResolution {
  /** Address to actually send to, or null if sending must be skipped entirely. */
  recipient: string | null;
  redirected: boolean;
  /** Present only when recipient is null. */
  skippedReason?: string;
}

/**
 * Single server-side choke point deciding who actually receives a customer
 * email — every EMAIL send (automatic on booking confirmation, or an admin's
 * manual "Send Confirmation") funnels through here via
 * lib/notifications/providers/email.ts. In sandbox mode (the default unless
 * EMAIL_DELIVERY_MODE=production), the real customer address is never used:
 * the message is redirected to EMAIL_TEST_RECIPIENT, or skipped entirely if
 * that isn't configured — it is never silently sent to the customer.
 */
export function resolveEmailRecipient(customerEmail: string): EmailRecipientResolution {
  const mode = resolveEmailDeliveryMode();

  if (mode === "production") {
    return { recipient: customerEmail, redirected: false };
  }

  const testRecipient = process.env.EMAIL_TEST_RECIPIENT;
  if (!testRecipient) {
    return { recipient: null, redirected: false, skippedReason: "sandbox_mode_no_test_recipient" };
  }

  const redirected = testRecipient !== customerEmail;
  if (redirected) {
    console.info(
      `[EMAIL SANDBOX] Original recipient: ${maskRecipient(customerEmail)} — Delivered to: ${maskRecipient(testRecipient)}`,
    );
  }

  return { recipient: testRecipient, redirected };
}
