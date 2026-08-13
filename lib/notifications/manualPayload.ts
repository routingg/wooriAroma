import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { getService, getServiceOption } from "@/data/services";
import { calculateDepositAmount, calculateRemainingAmount, calculateTotalAmount } from "@/lib/booking/pricing";
import { DATE_KEY_PATTERN, EMAIL_PATTERN, TIME_PATTERN } from "@/lib/booking/validation";
import { routing, type AppLocale } from "@/i18n/routing";
import type { ReservationNotificationPayload } from "./types";

export interface ManualConfirmationInput {
  customerName: string;
  customerEmail: string;
  date: string;
  time: string;
  serviceOptionId: string;
  guestCount: number;
  preferredLanguage: string;
  /** Optional — falls back to a generated "WA-MANUAL-YYYYMMDD" reference when blank. */
  reservationNumber: string;
}

export type ManualPayloadResult = { error: string } | { payload: ReservationNotificationPayload };

function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}

/**
 * Builds a confirmation-email payload from admin-typed fields — for the
 * "직접 입력" (manual entry) path on /admin/send-confirmation, used when
 * there's no reservation record to load from (a walk-in, an offline
 * booking, or any case outside the online booking system). Unlike
 * lib/booking/reservationNotifications.ts's buildReservationNotificationPayload,
 * nothing here is trusted DB data — every field is validated server-side
 * the same way the public booking API validates a fresh reservation
 * request (lib/booking/validation.ts).
 *
 * The returned payload's reservationId is a synthetic, non-persisted
 * placeholder — callers MUST send it through sendAdminConfirmationEmail
 * with `persist: false` (see adminDispatch.ts), since no row exists in
 * `reservations` for the notifications table's FOREIGN KEY to reference.
 */
export async function buildManualConfirmationPayload(input: ManualConfirmationInput): Promise<ManualPayloadResult> {
  const customerName = input.customerName.trim();
  if (!customerName) return { error: "missing_customer_name" };
  if (!EMAIL_PATTERN.test(input.customerEmail.trim())) return { error: "invalid_customer_email" };
  if (!DATE_KEY_PATTERN.test(input.date)) return { error: "invalid_date" };
  if (!TIME_PATTERN.test(input.time)) return { error: "invalid_time" };
  if (!Number.isInteger(input.guestCount) || input.guestCount < 1 || input.guestCount > 4) {
    return { error: "invalid_guest_count" };
  }
  if (!isAppLocale(input.preferredLanguage)) return { error: "invalid_language" };

  const option = getServiceOption(input.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;
  if (!option || !service) return { error: "invalid_service" };

  const preferredLanguage = input.preferredLanguage;
  const t = await getTranslations({ locale: preferredLanguage, namespace: "services" });
  const totalAmount = calculateTotalAmount(option.pricePerPerson, input.guestCount);
  const depositAmount = calculateDepositAmount(input.guestCount);
  const remainingAmount = calculateRemainingAmount(totalAmount, depositAmount);

  const reservationNumber = input.reservationNumber.trim() || `WA-MANUAL-${input.date.replaceAll("-", "")}`;

  return {
    payload: {
      event: "RESERVATION_CONFIRMED",
      reservationId: `manual-${randomUUID()}`,
      reservationNumber,
      customerName,
      customerEmail: input.customerEmail.trim(),
      customerPhone: "",
      preferredLanguage,
      date: input.date,
      time: input.time,
      guestCount: input.guestCount,
      treatmentName: t(service.nameKey.replace("services.", "")),
      durationMinutes: option.durationMinutes,
      totalAmount,
      depositAmount,
      remainingAmount,
      status: "CONFIRMED",
    },
  };
}
