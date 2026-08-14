"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getById, softDeleteReservation, updateStatus, type ReservationStatus } from "@/lib/repositories/reservationRepository";
import { createBlockedTime, removeBlockedTime } from "@/lib/repositories/blockedTimeRepository";
import { resolveHandoff } from "@/lib/repositories/agentHandoffRepository";
import { notifyReservationCancelled } from "@/lib/booking/reservationNotifications";
import { recordAttempt } from "@/lib/repositories/notificationRepository";
import { BookingError } from "@/lib/booking/errors";

/** Status changes only — never physically deletes reservation history (AGENTS.md §12.2). */
export async function updateReservationStatusAction(id: string, status: ReservationStatus) {
  const before = await getById(id);
  const updated = await updateStatus(id, status);
  revalidatePath("/admin");
  revalidatePath("/admin/reservations");

  // Only a CONFIRMED reservation being cancelled is a customer-facing
  // cancellation — a HOLD lapsing or an already-CANCELLED reservation being
  // touched again isn't a new event worth notifying about.
  if (status === "CANCELLED" && before?.status === "CONFIRMED") {
    // Fire-and-forget, but registered with ctx.waitUntil() so Workers
    // doesn't tear down this notification mid-flight once the action's
    // own response is done — see notifyReservationCancelled's contract.
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(
      notifyReservationCancelled(updated).catch((error) => {
        console.error(`[admin/actions] cancellation notification trigger failed for ${updated.reservationNumber}`, error);
      }),
    );
  }
}

/**
 * Admin-only "I sent this from Gmail" tracking marker — never sends
 * anything itself. Reuses the existing notifications table (same
 * (reservation, EMAIL, RESERVATION_CONFIRMED) row the old automatic-send
 * path used to write) instead of adding a new column, so 발송 여부 stays a
 * simple lookup shared with any future real-send path. Deliberately
 * separate from reservation status — confirming a reservation never
 * implies the email was sent (AGENTS.md §20).
 */
export async function markConfirmationEmailSentAction(reservationId: string, customerEmail: string) {
  await recordAttempt({
    reservationId,
    channel: "EMAIL",
    event: "RESERVATION_CONFIRMED",
    provider: "manual",
    recipient: customerEmail,
    status: "SENT",
  });
  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/reservations");
}

export interface DeleteReservationResult {
  success: boolean;
  /** BookingErrorCode when success is false — see lib/booking/errors.ts. */
  error?: string;
}

/**
 * Soft-deletes a finished reservation (완료/취소/노쇼 — see
 * DELETABLE_RESERVATION_STATUSES) from the admin's working dashboard
 * (AGENTS.md §7/§9) — never a permanent DELETE, and never triggered by or
 * confused with 예약 취소 itself (§21). The server independently
 * re-verifies eligibility inside softDeleteReservation() rather than
 * trusting that the client only showed the 삭제 button for an eligible
 * reservation (§17).
 */
export async function deleteReservationAction(id: string): Promise<DeleteReservationResult> {
  try {
    await softDeleteReservation(id);
  } catch (error) {
    if (error instanceof BookingError) {
      return { success: false, error: error.code };
    }
    console.error(`[admin/actions] delete reservation failed for ${id}`, error);
    return { success: false, error: "UNKNOWN" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${id}`);
  return { success: true };
}

export async function createBlockedTimeAction(formData: FormData) {
  const dateKey = String(formData.get("dateKey") ?? "");
  if (!dateKey) return;

  const fullDay = formData.get("fullDay") === "on";
  const startTime = String(formData.get("startTime") ?? "10:00");
  const endTime = String(formData.get("endTime") ?? "21:00");
  const reasonRaw = String(formData.get("reason") ?? "").trim();

  await createBlockedTime({ dateKey, startTime, endTime, fullDay, reason: reasonRaw || undefined });
  revalidatePath("/admin/blocked-times");
  revalidatePath("/admin");
}

export async function removeBlockedTimeAction(id: string) {
  await removeBlockedTime(id);
  revalidatePath("/admin/blocked-times");
  revalidatePath("/admin");
}

export async function resolveHandoffAction(id: string, formData: FormData) {
  const adminNotes = String(formData.get("adminNotes") ?? "").trim() || undefined;
  await resolveHandoff(id, adminNotes);
  revalidatePath("/admin/agent-handoffs");
}
