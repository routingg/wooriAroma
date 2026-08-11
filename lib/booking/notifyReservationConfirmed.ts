import { getTranslations } from "next-intl/server";
import { getService, getServiceOption } from "@/data/services";
import { getNotificationService } from "@/lib/notifications";
import type { BookingConfirmationPayload, NotificationResult } from "@/lib/notifications/types";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { recordAttempt, wasAlreadySent, type NotificationChannel } from "@/lib/repositories/notificationRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

const EVENT_TYPE = "BOOKING_CONFIRMED";

/**
 * Builds the notification payload from trusted server data (never the
 * client) and fires the confirmation email/SMS/admin-alert, each guarded by
 * lib/repositories/notificationRepository.ts's idempotency check so a
 * client retry of POST /api/reservations (confirmReservation() is itself
 * idempotent) can never re-send an already-SENT confirmation. Called
 * fire-and-forget right after confirmReservation() succeeds — never awaited
 * by the caller, so a delivery failure can't affect the already-confirmed
 * reservation (see lib/notifications for the never-throws contract each
 * channel honors).
 */
export async function notifyReservationConfirmed(reservation: ReservationRecord): Promise<void> {
  const customer = getCustomerById(reservation.customerId);
  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;

  if (!customer || !option || !service) {
    console.error(
      `[notifyReservationConfirmed] missing customer/service data for ${reservation.reservationNumber}`,
    );
    return;
  }

  const t = await getTranslations({ locale: reservation.locale, namespace: "services" });
  const payload: BookingConfirmationPayload = {
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
  };

  const notificationService = getNotificationService();

  await Promise.all([
    sendOnce(reservation.id, "EMAIL", customer.email, () => notificationService.sendBookingConfirmationEmail(payload)),
    sendOnce(reservation.id, "SMS", customer.phone, () => notificationService.sendBookingSms(payload)),
    sendOnce(reservation.id, "ADMIN", "admin", () => notificationService.sendAdminNotification(payload)),
  ]);
}

async function sendOnce(
  reservationId: string,
  channel: NotificationChannel,
  recipient: string,
  send: () => Promise<NotificationResult>,
): Promise<void> {
  if (wasAlreadySent(reservationId, channel, EVENT_TYPE)) return;

  try {
    const result = await send();
    recordAttempt({
      reservationId,
      channel,
      eventType: EVENT_TYPE,
      recipient,
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    recordAttempt({
      reservationId,
      channel,
      eventType: EVENT_TYPE,
      recipient,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
