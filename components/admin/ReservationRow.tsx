import { getService, getServiceOption } from "@/data/services";
import { formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import { BUSINESS } from "@/lib/config/business";
import {
  NOTIFICATION_CHANNEL_LABELS_KO,
  NOTIFICATION_STATUS_LABELS_KO,
  STATUS_LABELS_KO,
  SERVICE_NAMES_KO,
} from "@/lib/admin/labels";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { listByReservation } from "@/lib/repositories/notificationRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

const STATUS_CLASS: Record<ReservationRecord["status"], string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  HOLD: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-stone-200 text-stone-500 line-through",
  NO_SHOW: "bg-red-100 text-red-700",
  COMPLETED: "bg-stone-100 text-stone-500",
};

const NOTIFICATION_STATUS_ICON: Record<string, string> = {
  SENT: "✓",
  FAILED: "✕",
  SKIPPED: "—",
};

const NOTIFICATION_STATUS_CLASS: Record<string, string> = {
  SENT: "text-emerald-600",
  FAILED: "text-red-600",
  SKIPPED: "text-stone-400",
};

export function ReservationRow({ reservation }: { reservation: ReservationRecord }) {
  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;
  const customer = getCustomerById(reservation.customerId);
  const notifications = listByReservation(reservation.id);

  return (
    <details className="group text-sm">
      <summary className="flex flex-wrap items-center justify-between gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div>
          <p className="font-medium text-stone-900">
            {formatTimeLabel(reservation.serviceStart, "ko")} · {service ? SERVICE_NAMES_KO[service.id] : reservation.serviceOptionId} (
            {option?.durationMinutes}분)
          </p>
          <p className="text-stone-500">
            {customer?.name ?? "-"} · {reservation.guestCount}명 · {reservation.reservationNumber}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-stone-600">{formatCurrency(reservation.totalAmount, "ko")}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[reservation.status]}`}>
            {STATUS_LABELS_KO[reservation.status]}
          </span>
          <span className="text-xs text-stone-400 group-open:hidden">알림 보기 ▾</span>
          <span className="hidden text-xs text-stone-400 group-open:inline">알림 숨기기 ▴</span>
        </div>
      </summary>

      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
        <p className="mb-2 text-xs font-medium text-stone-500">알림 발송 현황</p>
        {notifications.length === 0 ? (
          <p className="text-xs text-stone-400">아직 발송된 알림이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between text-xs">
                <span className="text-stone-600">{NOTIFICATION_CHANNEL_LABELS_KO[n.channel]}</span>
                <span className={NOTIFICATION_STATUS_CLASS[n.status]}>
                  {NOTIFICATION_STATUS_ICON[n.status]} {NOTIFICATION_STATUS_LABELS_KO[n.status]}
                  {n.status === "FAILED" && n.lastError ? ` (${n.lastError.slice(0, 60)})` : ""}
                  {n.status === "SKIPPED" && n.lastError === "not_needed" ? " (필요 없음)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <a
          href={BUSINESS.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs font-medium text-stone-600 underline-offset-2 hover:underline"
        >
          인스타그램으로 고객에게 연락 →
        </a>
      </div>
    </details>
  );
}
