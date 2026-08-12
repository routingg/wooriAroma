import { formatTimeLabel } from "@/lib/booking/time";
import type { ReservationNotificationPayload } from "../types";

/**
 * Admin alerts are always Korean, regardless of the customer's preferred
 * language — the admin dashboard itself is Korean-only (see README.md), so
 * there's no locale to branch on here.
 */
const TITLE_BY_EVENT: Record<ReservationNotificationPayload["event"], string> = {
  RESERVATION_CONFIRMED: "🔔 신규 예약",
  RESERVATION_UPDATED: "✏️ 예약 변경",
  RESERVATION_CANCELLED: "❌ 예약 취소",
  RESERVATION_REMINDER: "⏰ 리마인더 발송",
};

export function renderTelegramAdminMessage(payload: ReservationNotificationPayload): string {
  const dateLabel = new Intl.DateTimeFormat("ko", { month: "long", day: "numeric" }).format(
    new Date(`${payload.date}T00:00:00`),
  );
  const timeLabel = formatTimeLabel(payload.time, "ko");

  const lines = [
    TITLE_BY_EVENT[payload.event],
    "",
    `날짜: ${dateLabel}`,
    `시간: ${timeLabel}`,
    `고객: ${payload.customerName}`,
    `인원: ${payload.guestCount}명`,
    `시술: ${payload.treatmentName} ${payload.durationMinutes}분`,
    `전화: ${payload.customerPhone}`,
    `이메일: ${payload.customerEmail}`,
    `예약번호: ${payload.reservationNumber}`,
    "",
    `상태: ${payload.status}`,
  ];

  return lines.join("\n");
}
