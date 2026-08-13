import type { ReservationStatus } from "@/lib/repositories/reservationRepository";
import type { NotificationChannel, NotificationStatus } from "@/lib/notifications/types";

/** Admin UI is Korean-only by design (AGENTS.md §12) — no next-intl involved here. */
export const STATUS_LABELS_KO: Record<ReservationStatus, string> = {
  DRAFT: "임시",
  HOLD: "임시보류",
  CONFIRMED: "확정",
  CANCELLED: "취소",
  NO_SHOW: "노쇼",
  COMPLETED: "완료",
};

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
