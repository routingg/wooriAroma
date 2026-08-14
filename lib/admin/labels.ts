import type { ReservationStatus } from "@/lib/repositories/reservationRepository";
import type { NotificationChannel, NotificationStatus } from "@/lib/notifications/types";

/** Admin UI is Korean-only by design (AGENTS.md §12) — no next-intl involved here. */
export const STATUS_LABELS_KO: Record<ReservationStatus, string> = {
  DRAFT: "임시",
  HOLD: "임시보류",
  PENDING: "예약 대기",
  CONFIRMED: "예약 확정",
  CANCELLED: "예약 취소",
  NO_SHOW: "노쇼",
  COMPLETED: "예약 완료",
};

/**
 * Shared status badge colors — a submitted-but-unreviewed PENDING request
 * must never read as green/CONFIRMED (deposit removal introduced the
 * pending-review step; see reservationRepository.submitReservationRequest).
 * Used by both ReservationRow and the reservation detail page so the two
 * views can never disagree about what a given status looks like.
 */
export const STATUS_BADGE_CLASS: Record<ReservationStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  HOLD: "bg-amber-100 text-amber-700",
  PENDING: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-stone-200 text-stone-500 line-through",
  NO_SHOW: "bg-red-100 text-red-700",
  COMPLETED: "bg-stone-100 text-stone-500",
};

/**
 * Statuses eligible for admin 삭제 (soft delete) — every "this reservation
 * is finished, one way or another" terminal state. Lives here (not in
 * lib/repositories/reservationRepository.ts) specifically so client
 * components like DeleteReservationButton can import it as a plain value
 * without pulling that module's `node:sqlite` dependency into the browser
 * bundle — reservationRepository.ts's softDeleteReservation() imports it
 * back from here, so there's still exactly one source of truth.
 */
export const DELETABLE_RESERVATION_STATUSES: ReservationStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export const SERVICE_NAMES_KO: Record<string, string> = {
  "thai-massage": "전통 타이 마사지",
  "aroma-oil": "아로마 오일",
  "hot-stone": "핫스톤",
  "quick-spa-foot": "퀵 스파 – 발 마사지",
  facial: "스킨케어 – 페이셜 스파",
};

export const NOTIFICATION_CHANNEL_LABELS_KO: Record<NotificationChannel, string> = {
  EMAIL: "이메일",
};

export const NOTIFICATION_STATUS_LABELS_KO: Record<NotificationStatus, string> = {
  SENT: "발송됨",
  FAILED: "실패",
  SKIPPED: "건너뜀",
};
