import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminBookingAlerts } from "@/lib/repositories/adminBookingAlertRepository";
import { getAdminAlertConfiguration } from "@/lib/notifications/providers/adminBookingEmail";

const STATUS_LABELS = {
  PENDING: "발송 대기",
  PROCESSING: "발송 처리 중",
  SENT: "이메일 서비스 접수 완료",
  TESTED: "테스트 발송 완료",
  DEAD: "관리자 확인 필요",
};

const CONFIGURATION_LABELS: Record<string, string> = {
  provider_not_configured: "이메일 서비스 연결이 필요합니다.",
  admin_recipient_not_configured: "관리자 알림을 받을 이메일 주소를 설정해 주세요.",
  sandbox_recipient_not_configured: "테스트 알림을 받을 이메일 주소를 설정해 주세요.",
  admin_origin_not_configured: "알림에 사용할 관리자 사이트 주소를 설정해 주세요.",
};

function failureHint(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === "delivery_configuration_changed") return "발송 설정이 변경되어 자동 재시도를 멈췄습니다.";
  if (reason === "retry_window_expired" || reason === "retry_limit_reached") return "자동 재시도 기한 또는 횟수를 초과했습니다.";
  if (reason === "provider_http_401" || reason === "provider_http_403") return "이메일 서비스의 인증 및 발송 권한을 확인해 주세요.";
  if (reason === "provider_http_429") return "이메일 서비스 요청이 많아 다음 발송을 기다리고 있습니다.";
  return "이메일 서비스의 발송 기록을 확인해 주세요.";
}

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const alerts = await listAdminBookingAlerts();
  const configuration = getAdminAlertConfiguration();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <header>
        <Link href="/admin" className="text-sm text-stone-600 hover:underline">← 관리자 홈</Link>
        <h1 className="mt-3 text-2xl font-semibold text-stone-900">관리자 예약 알림</h1>
        <p className="mt-2 text-sm text-stone-600">
          새 예약 요청 알림의 최근 처리 내역입니다. 서비스 접수 완료 후 실제 수신 여부는 이메일함에서 확인해 주세요.
        </p>
      </header>
      {!configuration.configured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {CONFIGURATION_LABELS[configuration.reason]} 예약 요청은 저장되며, 연결 후 대기 중인 알림을 처리합니다.
        </p>
      ) : configuration.value.mode === "sandbox" ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          현재 테스트 수신 주소로만 발송합니다. 테스트 완료 내역은 운영 발송으로 계산하지 않습니다.
        </p>
      ) : null}
      <p className="text-sm text-stone-600">
        일시적인 발송 실패는 예약 알림 스케줄러가 다시 시도합니다. 관리자 확인이 필요한 경우 이메일 서비스의 발송 기록과
        해당 예약을 확인해 주세요. 중복 알림을 피하기 위해 자동 재시도를 멈춘 내역입니다.
      </p>
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {alerts.length === 0 ? <li className="p-4 text-sm text-stone-500">아직 알림 내역이 없습니다.</li> : alerts.map((alert) => (
          <li key={alert.reservation_id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className={alert.status === "DEAD" ? "font-medium text-red-700" : "font-medium text-stone-900"}>
                {STATUS_LABELS[alert.status]}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(alert.created_at))}
                {" · "}{alert.attempt_count}회 시도
              </p>
              {alert.last_error && <p className="mt-1 text-xs text-stone-600">{failureHint(alert.last_error)}</p>}
            </div>
            <Link href={`/admin/reservations/${encodeURIComponent(alert.reservation_id)}`} className="text-blue-700 hover:underline">
              예약 확인 →
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
