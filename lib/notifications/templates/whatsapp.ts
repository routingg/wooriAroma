import type { AppLocale } from "@/i18n/routing";
import { formatTimeLabel } from "@/lib/booking/time";
import type { ReservationNotificationPayload } from "../types";

const TEMPLATE_ENV_BY_EVENT: Record<ReservationNotificationPayload["event"], string> = {
  RESERVATION_CONFIRMED: "WHATSAPP_TEMPLATE_CONFIRMATION",
  RESERVATION_UPDATED: "WHATSAPP_TEMPLATE_UPDATE",
  RESERVATION_CANCELLED: "WHATSAPP_TEMPLATE_CANCELLATION",
  RESERVATION_REMINDER: "WHATSAPP_TEMPLATE_REMINDER",
};

/** Meta requires a pre-approved template's registered locale code — not every AppLocale has a WhatsApp presence, so this only covers what WhatsApp customers realistically use. */
const META_LANGUAGE_CODE: Record<AppLocale, string> = {
  en: "en_US",
  ko: "ko",
  ja: "ja",
  zh: "zh_CN",
};

export function templateNameForEvent(event: ReservationNotificationPayload["event"]): string | undefined {
  return process.env[TEMPLATE_ENV_BY_EVENT[event]];
}

export function metaLanguageCode(locale: AppLocale): string {
  return META_LANGUAGE_CODE[locale] ?? "en_US";
}

/**
 * Ordered body parameters — WhatsApp template bodies reference these
 * positionally as {{1}}, {{2}}, ... in the exact order below. The template
 * *text* itself lives in Meta Business Manager (pre-approved, cannot be
 * changed per-message); this only supplies the variables it expects. Keep
 * this order in sync with whatever the approved templates actually use —
 * see README's WhatsApp configuration steps.
 */
export function buildWhatsAppBodyParameters(payload: ReservationNotificationPayload): string[] {
  const dateLabel = new Intl.DateTimeFormat(payload.preferredLanguage, {
    month: "long",
    day: "numeric",
  }).format(new Date(`${payload.date}T00:00:00`));

  return [
    payload.customerName,
    payload.reservationNumber,
    dateLabel,
    formatTimeLabel(payload.time, payload.preferredLanguage),
    payload.treatmentName,
    String(payload.guestCount),
  ];
}
