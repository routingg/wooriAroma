"use server";

import { buildManualConfirmationPayload, type ManualConfirmationInput } from "@/lib/notifications/manualPayload";
import {
  sendAdminConfirmationEmail,
  sendAdminTestEmail,
  toSendResultState,
  type SendResultState,
} from "@/lib/notifications/adminDispatch";
import { renderEmailPreview, type EmailPreview } from "@/lib/notifications/preview";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { searchReservations, type ReservationStatus } from "@/lib/repositories/reservationRepository";

export type { SendResultState };

export interface ReservationSearchResult {
  id: string;
  reservationNumber: string;
  customerName: string;
  customerEmail: string;
  dateKey: string;
  serviceStart: string;
  status: ReservationStatus;
}

export async function searchReservationsAction(query: string): Promise<ReservationSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const found = await searchReservations(trimmed);
  return Promise.all(
    found.map(async (r) => {
      const customer = await getCustomerById(r.customerId);
      return {
        id: r.id,
        reservationNumber: r.reservationNumber,
        customerName: customer?.name ?? "-",
        customerEmail: customer?.email ?? "-",
        dateKey: r.dateKey,
        serviceStart: r.serviceStart,
        status: r.status,
      };
    }),
  );
}

export interface ManualPreviewState {
  status: "idle" | "ready" | "error";
  preview?: EmailPreview;
  reason?: string;
}

/**
 * Called directly from the client (not via a <form> action) — the composer
 * keeps every field as controlled React state and invokes these as plain
 * async functions inside useTransition, the same pattern
 * EmailComposer's live preview already uses. All admin-typed
 * fields are still fully re-validated here server-side regardless of how
 * the client packaged them (buildManualConfirmationPayload never trusts
 * the caller).
 */
export async function getManualPreviewAction(
  input: ManualConfirmationInput,
  includeMap: boolean,
): Promise<ManualPreviewState> {
  const result = await buildManualConfirmationPayload(input);
  if ("error" in result) return { status: "error", reason: result.error };

  const preview = await renderEmailPreview(result.payload, { includeMap });
  return { status: "ready", preview };
}

/** Real send for a manual/unlinked entry — goes through the same sandbox/production recipient policy as a reservation-linked send, but is never persisted (no reservation row exists to attach it to). */
export async function sendManualConfirmationAction(
  input: ManualConfirmationInput,
  includeMap: boolean,
): Promise<SendResultState> {
  const result = await buildManualConfirmationPayload(input);
  if ("error" in result) return { status: "failed", reason: result.error };

  const sendResult = await sendAdminConfirmationEmail(result.payload, { includeMap, persist: false });
  return toSendResultState(sendResult);
}

/** Test send for a manual/unlinked entry — always to EMAIL_TEST_RECIPIENT, regardless of delivery mode. */
export async function sendManualTestEmailAction(
  input: ManualConfirmationInput,
  includeMap: boolean,
): Promise<SendResultState> {
  const result = await buildManualConfirmationPayload(input);
  if ("error" in result) return { status: "failed", reason: result.error };

  const sendResult = await sendAdminTestEmail(result.payload, { includeMap });
  return toSendResultState(sendResult);
}
