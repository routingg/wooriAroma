import Link from "next/link";
import { notFound } from "next/navigation";
import { getService, getServiceOption } from "@/data/services";
import { buildReservationNotificationPayload } from "@/lib/booking/reservationNotifications";
import { formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import { SEOUL_TIME_ZONE } from "@/lib/booking/timezone";
import { STATUS_LABELS_KO, SERVICE_NAMES_KO } from "@/lib/admin/labels";
import { renderEmailPreview } from "@/lib/notifications/preview";
import { resolveEmailDeliveryMode } from "@/lib/notifications/recipientPolicy";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { listByReservation } from "@/lib/repositories/notificationRepository";
import { getById } from "@/lib/repositories/reservationRepository";
import { ConfirmationEmailPanel } from "@/components/admin/ConfirmationEmailPanel";

export default async function AdminReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reservation = getById(id);
  if (!reservation) notFound();

  const customer = getCustomerById(reservation.customerId);
  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;

  const payload = await buildReservationNotificationPayload(reservation, "RESERVATION_CONFIRMED");
  const initialPreview = payload ? await renderEmailPreview(payload, { includeMap: true }) : null;

  const notifications = listByReservation(reservation.id);
  const lastConfirmationEmail = notifications
    .filter((n) => n.channel === "EMAIL" && n.eventType === "RESERVATION_CONFIRMED" && n.status === "SENT")
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))[0];

  const deliveryMode = resolveEmailDeliveryMode();
  const testRecipientConfigured = Boolean(process.env.EMAIL_TEST_RECIPIENT);

  const dateLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL_TIME_ZONE, dateStyle: "long" }).format(
    new Date(`${reservation.dateKey}T00:00:00+09:00`),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">예약 상세</h1>
        <Link href="/admin/reservations" className="text-sm text-stone-600 hover:underline">
          ← 예약 관리
        </Link>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-semibold text-stone-900">{reservation.reservationNumber}</p>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
            {STATUS_LABELS_KO[reservation.status]}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="고객명" value={customer?.name ?? "-"} />
          <Field label="이메일" value={customer?.email ?? "-"} />
          <Field label="전화번호" value={customer?.phone ?? "-"} />
          <Field label="인원" value={`${reservation.guestCount}명`} />
          <Field label="메뉴" value={service ? SERVICE_NAMES_KO[service.id] : reservation.serviceOptionId} />
          <Field label="소요시간" value={`${reservation.durationMinutes}분`} />
          <Field label="날짜" value={dateLabel} />
          <Field label="시간" value={formatTimeLabel(reservation.serviceStart, "ko")} />
          <Field label="결제금액" value={formatCurrency(reservation.totalAmount, "ko")} />
        </dl>
      </section>

      {!customer || !payload || !initialPreview ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          예약 정보가 불완전하여 확정 메일을 준비할 수 없습니다 (고객 또는 메뉴 정보 누락).
        </p>
      ) : (
        <ConfirmationEmailPanel
          reservationId={reservation.id}
          initialPreview={initialPreview}
          deliveryMode={deliveryMode}
          testRecipientConfigured={testRecipientConfigured}
          lastSentAt={lastConfirmationEmail?.sentAt ?? null}
        />
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-stone-900">{value}</dd>
    </div>
  );
}
