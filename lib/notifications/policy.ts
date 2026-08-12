import { isKoreanPhone } from "./phone";
import type { NotificationChannel, NotificationEvent, ReservationNotificationPayload } from "./types";

export type CustomerRegion = "KR" | "INTL";

/**
 * Single source of truth for "who gets messaged on what channel." Centralized
 * here (rather than scattered `if`s through the reservation/notification
 * code) so a future admin can change notification policy — e.g. drop SMS
 * fallback, or add WhatsApp for Korean customers too — without touching
 * provider or reservation code (§25 cost-awareness requirement).
 *
 * Classification deliberately uses the phone's country code, never IP
 * geolocation — see AGENTS.md: nationality was intentionally removed from
 * the booking form, so phone country code is the only reliable signal left.
 */
export function classifyCustomer(phone: string): CustomerRegion {
  return isKoreanPhone(phone) ? "KR" : "INTL";
}

/**
 * Channels to *attempt* for a given event/customer. Actual delivery still
 * depends on provider configuration and per-channel success (see
 * lib/notifications/service.ts) — this only decides eligibility, keeping
 * cost-control rules (no WhatsApp without consent, no email duplication,
 * Kakao-before-SMS handled inside the Korean provider itself) in one place.
 */
export function resolveChannels(
  event: NotificationEvent,
  payload: Pick<ReservationNotificationPayload, "customerPhone" | "customerEmail" | "whatsappOptIn">,
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];

  if (payload.customerEmail) {
    channels.push("EMAIL");
  }

  const region = classifyCustomer(payload.customerPhone);
  if (region === "KR") {
    // KAKAO always attempted first; SMS is only a fallback the Korean
    // provider triggers internally on Kakao failure — see providers/korean.ts.
    channels.push("KAKAO");
  } else if (payload.whatsappOptIn) {
    channels.push("WHATSAPP");
  }

  return channels;
}
