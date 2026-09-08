import {
  claimAdminBookingAlert, listDueAdminBookingAlertIds, settleAdminBookingAlert,
} from "@/lib/repositories/adminBookingAlertRepository";
import {
  buildAdminAlertRequest, getAdminAlertConfiguration, sendAdminBookingEmail, type AdminAlertConfiguration,
} from "./providers/adminBookingEmail";

const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000, 10_800_000];
// Resend retains idempotency keys for 24 hours. Leave an hour of margin;
// after this window, surface manual review instead of risking a duplicate.
const RETRY_WINDOW_MS = 23 * 3_600_000;

export interface AdminAlertRunResult {
  checked: number;
  sent: number;
  tested: number;
  retrying: number;
  needsReview: number;
  skipped: number;
  configurationError?: string;
}

type AttemptOutcome = "sent" | "tested" | "retrying" | "needsReview" | "skipped";

async function processAlert(reservationId: string, config: AdminAlertConfiguration, now: Date): Promise<AttemptOutcome> {
  const request = buildAdminAlertRequest(reservationId, config);
  const alert = await claimAdminBookingAlert(reservationId, { now, mode: config.mode, ...request });
  if (!alert) return "skipped";

  const expired = !alert.first_attempt_at || now.getTime() - Date.parse(alert.first_attempt_at) >= RETRY_WINDOW_MS;
  const changed = alert.request_json !== request.requestJson || alert.idempotency_key !== request.idempotencyKey;
  if (expired || changed || alert.attempt_count > RETRY_DELAYS_MS.length + 1) {
    await settleAdminBookingAlert(alert, {
      status: "DEAD", now,
      error: changed ? "delivery_configuration_changed" : expired ? "retry_window_expired" : "retry_limit_reached",
    });
    return "needsReview";
  }

  const result = await sendAdminBookingEmail(alert.request_json!, alert.idempotency_key!, config.apiKey);
  if (result.sent) {
    const tested = config.mode === "sandbox";
    await settleAdminBookingAlert(alert, { status: tested ? "TESTED" : "SENT", now, providerMessageId: result.providerMessageId });
    return tested ? "tested" : "sent";
  }
  const delay = RETRY_DELAYS_MS[alert.attempt_count - 1];
  const retry = result.retryable && delay !== undefined;
  await settleAdminBookingAlert(alert, {
    status: retry ? "PENDING" : "DEAD", now,
    nextAttemptAt: retry ? new Date(now.getTime() + delay) : undefined,
    error: result.reason,
  });
  return retry ? "retrying" : "needsReview";
}

/** Run immediately for one new booking, or poll a bounded batch from the protected cron endpoint. */
export async function processAdminBookingAlerts(
  options: { reservationId?: string; now?: Date } = {},
): Promise<AdminAlertRunResult> {
  const result: AdminAlertRunResult = { checked: 0, sent: 0, tested: 0, retrying: 0, needsReview: 0, skipped: 0 };
  const configuration = getAdminAlertConfiguration();
  if (!configuration.configured) return { ...result, configurationError: configuration.reason };
  const now = options.now ?? new Date();
  const ids = await listDueAdminBookingAlertIds(now, configuration.value.mode, options.reservationId);
  result.checked = ids.length;
  // Small batches bound execution time and avoid a large burst at the email provider.
  for (let offset = 0; offset < ids.length; offset += 2) {
    const outcomes = await Promise.allSettled(
      ids.slice(offset, offset + 2).map((id) => processAlert(id, configuration.value, now)),
    );
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") result[outcome.value] += 1;
      else {
        // The durable lease expires, allowing the next cron to recover the attempt.
        // Never log a raw exception that could include provider or database data.
        console.error("[adminBookingAlerts] attempt interrupted; queued for recovery");
        result.retrying += 1;
      }
    }
  }
  return result;
}
