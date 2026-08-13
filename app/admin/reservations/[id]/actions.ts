"use server";

import { revalidatePath } from "next/cache";
import { buildReservationNotificationPayload } from "@/lib/booking/reservationNotifications";
import {
  sendAdminConfirmationEmail,
  sendAdminTestEmail,
  toSendResultState,
  type SendResultState,
} from "@/lib/notifications/adminDispatch";
import { renderEmailPreview, type EmailPreview } from "@/lib/notifications/preview";
import type { ReservationNotificationPayload } from "@/lib/notifications/types";
import { getById } from "@/lib/repositories/reservationRepository";

export type { SendResultState };

type LoadedPayload = { error: string } | { payload: ReservationNotificationPayload };

/** Re-derives the payload from trusted server data — never trusts anything the client sent besides the reservation id. */
async function loadConfirmationPayload(reservationId: string): Promise<LoadedPayload> {
  const reservation = getById(reservationId);
  if (!reservation) {
    return { error: "reservation_not_found" };
  }
  const payload = await buildReservationNotificationPayload(reservation, "RESERVATION_CONFIRMED");
  if (!payload) {
    return { error: "reservation_data_incomplete" };
  }
  return { payload };
}

/** Real confirmation send — initial send or resend. Goes through the sandbox/production recipient policy and is logged to the notifications table. */
export async function sendConfirmationEmailAction(
  reservationId: string,
  _prevState: SendResultState,
  formData: FormData,
): Promise<SendResultState> {
  const includeMap = formData.get("includeMap") === "on";

  const loaded = await loadConfirmationPayload(reservationId);
  if ("error" in loaded) {
    return { status: "failed", reason: loaded.error };
  }

  const result = await sendAdminConfirmationEmail(loaded.payload, { includeMap });
  revalidatePath(`/admin/reservations/${reservationId}`);

  return toSendResultState(result);
}

/** Test send — always to EMAIL_TEST_RECIPIENT, never persisted, never affects reservation/confirmation status. */
export async function sendTestConfirmationEmailAction(
  reservationId: string,
  _prevState: SendResultState,
  formData: FormData,
): Promise<SendResultState> {
  const includeMap = formData.get("includeMap") === "on";

  const loaded = await loadConfirmationPayload(reservationId);
  if ("error" in loaded) {
    return { status: "failed", reason: loaded.error };
  }

  const result = await sendAdminTestEmail(loaded.payload, { includeMap });

  return toSendResultState(result);
}

/** Re-renders the preview when the admin toggles "include map" — customer/reservation fields aren't editable in this flow, so no other input affects the preview. */
export async function getEmailPreviewAction(
  reservationId: string,
  includeMap: boolean,
): Promise<EmailPreview | { error: string }> {
  const loaded = await loadConfirmationPayload(reservationId);
  if ("error" in loaded) return { error: loaded.error };
  return renderEmailPreview(loaded.payload, { includeMap });
}
