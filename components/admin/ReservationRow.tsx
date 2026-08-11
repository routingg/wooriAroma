import { getService, getServiceOption } from "@/data/services";
import { formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import { STATUS_LABELS_KO, SERVICE_NAMES_KO } from "@/lib/admin/labels";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

const STATUS_CLASS: Record<ReservationRecord["status"], string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  HOLD: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-stone-200 text-stone-500 line-through",
  NO_SHOW: "bg-red-100 text-red-700",
  COMPLETED: "bg-stone-100 text-stone-500",
};

export function ReservationRow({ reservation }: { reservation: ReservationRecord }) {
  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;
  const customer = getCustomerById(reservation.customerId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
      </div>
    </div>
  );
}
