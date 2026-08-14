import type { SendResultState } from "@/lib/notifications/adminDispatch";

/** Used by ManualConfirmationComposer (manual/unlinked entry send flow on /admin/send-confirmation). The reservation-linked flow on /admin/reservations no longer sends anything itself — see EmailComposer.tsx. */
export const REASON_LABELS_KO: Record<string, string> = {
  provider_not_configured: "이메일 발송 서비스(RESEND_API_KEY)가 설정되지 않았습니다.",
  sandbox_mode_no_test_recipient: "테스트 모드인데 EMAIL_TEST_RECIPIENT가 설정되지 않아 발송을 건너뛰었습니다.",
  invalid_customer_email: "고객 이메일 주소가 올바르지 않습니다.",
  reservation_not_found: "예약을 찾을 수 없습니다.",
  reservation_data_incomplete: "예약 정보가 불완전합니다.",
  missing_customer_name: "고객 이름을 입력해 주세요.",
  invalid_date: "날짜를 확인해 주세요.",
  invalid_time: "시간을 확인해 주세요.",
  invalid_guest_count: "인원은 1~4명 사이여야 합니다.",
  invalid_language: "언어를 확인해 주세요.",
  invalid_service: "메뉴를 선택해 주세요.",
};

export function describeSendResult(state: SendResultState): string | null {
  if (state.status === "idle") return null;
  if (state.status === "sent") {
    return state.redirected ? "발송 완료 (테스트 모드: 테스트 주소로 전달됨, 실제 고객 아님)" : "발송 완료";
  }
  const reason = state.reason ? (REASON_LABELS_KO[state.reason] ?? state.reason) : "";
  return state.status === "skipped" ? `건너뜀 — ${reason}` : `실패 — ${reason}`;
}
