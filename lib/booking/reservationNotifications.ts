import { getTranslations } from "next-intl/server";
import { getService, getServiceOption } from "@/data/services";
import { notificationService } from "@/lib/notifications";
import type { NotificationEvent, ReservationNotificationPayload } from "@/lib/notifications/types";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

/**
 * Builds the notification payload from trusted server data (never the
 * client) and dispatches through lib/notifications/service.ts — every
 * channel's idempotency guard lives one layer down in
 * notificationRepository, so calling this twice for the same reservation
 * (e.g. a client retry) can never re-send an already-SENT message.
 *
 * Every export here is fire-and-forget by contract: call it, don't await it,
 * right after the reservation write that triggered it has already
 * committed. A notification failure must never be able to affect a
 * reservation that already succeeded (see lib/notifications/types.ts's
 * "never throws" contract on every provider).
 */
/**
 * Exported (not just used internally) so the admin's manual "Send/Resend
 * Confirmation" and "Send Test Email" actions build the exact same
 * trusted, server-derived payload as the automatic on-booking flow below —
 * no second implementation of the customer/service lookup to drift out of
 * sync.
 */
export async function buildReservationNotificationPayload(
  reservation: ReservationRecord,
  event: NotificationEvent,
): Promise<ReservationNotificationPayload | null> {
  const customer = getCustomerById(reservation.customerId);
  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;

  if (!customer || !option || !service) {
    console.error(`[reservationNotifications] missing customer/service data for ${reservation.reservationNumber}`);
    return null;
  }

  const t = await getTranslations({ locale: reservation.locale, namespace: "services" });

  return {
    event,
    reservationId: reservation.id,
    reservationNumber: reservation.reservationNumber,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    preferredLanguage: customer.preferredLanguage,
    date: reservation.dateKey,
    time: reservation.serviceStart,
    guestCount: reservation.guestCount,
    treatmentName: t(service.nameKey.replace("services.", "")),
    durationMinutes: reservation.durationMinutes,
    totalAmount: reservation.totalAmount,
    depositAmount: reservation.depositAmount,
    remainingAmount: reservation.remainingAmount,
    status: reservation.status,
  };
}

export async function notifyReservationRequestReceived(reservation: ReservationRecord): Promise<void> {
  const payload = await buildReservationNotificationPayload(reservation, "RESERVATION_REQUEST_RECEIVED");
  if (payload) await notificationService.sendReservationRequestReceived(payload);
}

export async function notifyReservationConfirmed(reservation: ReservationRecord): Promise<void> {
  const payload = await buildReservationNotificationPayload(reservation, "RESERVATION_CONFIRMED");
  if (payload) await notificationService.sendReservationConfirmation(payload);
}

export async function notifyReservationUpdated(reservation: ReservationRecord): Promise<void> {
  const payload = await buildReservationNotificationPayload(reservation, "RESERVATION_UPDATED");
  if (payload) await notificationService.sendReservationUpdated(payload);
}

export async function notifyReservationCancelled(reservation: ReservationRecord): Promise<void> {
  const payload = await buildReservationNotificationPayload(reservation, "RESERVATION_CANCELLED");
  if (payload) await notificationService.sendReservationCancelled(payload);
}

export async function notifyReservationReminder(reservation: ReservationRecord): Promise<void> {
  const payload = await buildReservationNotificationPayload(reservation, "RESERVATION_REMINDER");
  if (payload) await notificationService.sendReservationReminder(payload);
}
