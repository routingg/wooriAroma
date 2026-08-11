import type { ReservationStatus } from "@/lib/repositories/reservationRepository";

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
  "aroma-oil": "아로마 오일",
  "hot-stone": "핫스톤",
  facial: "페이셜",
};
