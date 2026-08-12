import { formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import type { ReservationNotificationPayload } from "../types";

const SMS_TITLE_BY_EVENT: Record<ReservationNotificationPayload["event"], string> = {
  RESERVATION_CONFIRMED: "[우리같이아로마] 예약이 확정되었습니다.",
  RESERVATION_UPDATED: "[우리같이아로마] 예약이 변경되었습니다.",
  RESERVATION_CANCELLED: "[우리같이아로마] 예약이 취소되었습니다.",
  RESERVATION_REMINDER: "[우리같이아로마] 내일 예약을 안내드립니다.",
};

/**
 * The Kakao AlimTalk message body itself is whatever text was approved for
 * SOLAPI_KAKAO_TEMPLATE_ID in the Kakao/SOLAPI console — this code only
 * supplies the variables that template expects to be filled in. Variable
 * *names* must match exactly what was registered for that template; the
 * names below (#{...}) are a reasonable default and must be confirmed
 * against the actual approved template before going live (see README's
 * Kakao template configuration steps).
 */
export function buildKakaoVariables(payload: ReservationNotificationPayload): Record<string, string> {
  const dateLabel = new Intl.DateTimeFormat("ko", { month: "long", day: "numeric" }).format(
    new Date(`${payload.date}T00:00:00`),
  );
  return {
    "#{고객명}": payload.customerName,
    "#{예약번호}": payload.reservationNumber,
    "#{날짜}": dateLabel,
    "#{시간}": formatTimeLabel(payload.time, "ko"),
    "#{시술}": payload.treatmentName,
    "#{인원}": `${payload.guestCount}명`,
  };
}

/** Plain-text SMS fallback — always Korean, since this channel is KR-only (see policy.ts). */
export function buildSmsText(payload: ReservationNotificationPayload): string {
  const dateLabel = new Intl.DateTimeFormat("ko", { month: "long", day: "numeric" }).format(
    new Date(`${payload.date}T00:00:00`),
  );
  const lines = [
    SMS_TITLE_BY_EVENT[payload.event],
    `${dateLabel} ${formatTimeLabel(payload.time, "ko")}`,
    `${payload.treatmentName} · ${payload.guestCount}명`,
    `예약번호 ${payload.reservationNumber}`,
  ];
  if (payload.event !== "RESERVATION_CANCELLED") {
    lines.push(`잔금 ${formatCurrency(payload.remainingAmount, "ko")} (현장 결제)`);
  }
  return lines.join("\n");
}
