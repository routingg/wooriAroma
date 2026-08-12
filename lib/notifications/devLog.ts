import type { NotificationEvent, NotificationResult } from "./types";

/** Never print a full email/phone to logs (AGENTS.md/security requirement) — last 4 chars is enough to correlate. */
export function maskRecipient(recipient: string): string {
  if (recipient.length <= 4) return "***";
  return `***${recipient.slice(-4)}`;
}

/**
 * A provider with no credentials configured must say so clearly and skip —
 * never fake a successful send. Every provider's "not configured" branch
 * should return this so dev/test runs are unambiguous in logs.
 */
export function notConfigured(provider: string, event: NotificationEvent, recipient: string): NotificationResult {
  console.info(
    `[notifications] (dev) ${provider} not configured — skipping ${event} → ${maskRecipient(recipient)}`,
  );
  return { status: "SKIPPED", provider, reason: "provider_not_configured" };
}

export function logFailure(provider: string, event: NotificationEvent, recipient: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[notifications] ${provider} failed for ${event} → ${maskRecipient(recipient)}: ${message}`);
}
