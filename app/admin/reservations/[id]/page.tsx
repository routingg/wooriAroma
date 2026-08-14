import Link from "next/link";
import { notFound } from "next/navigation";
import { getService, getServiceOption } from "@/data/services";
import { DEFAULT_CONFIRMATION_SUBJECT, resolveConfirmationEmailFields } from "@/lib/admin/confirmationEmailTemplate";
import { formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import { SEOUL_TIME_ZONE } from "@/lib/booking/timezone";
import { DELETABLE_RESERVATION_STATUSES, STATUS_BADGE_CLASS, STATUS_LABELS_KO, SERVICE_NAMES_KO } from "@/lib/admin/labels";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { listByReservation } from "@/lib/repositories/notificationRepository";
import { getById } from "@/lib/repositories/reservationRepository";
import { resolveReservationDeletionSummary } from "@/lib/admin/reservationSummary";
import { EmailComposer } from "@/components/admin/EmailComposer";
import { EmailStatusControl } from "@/components/admin/EmailStatusControl";
import { ReservationStatusActions } from "@/components/admin/ReservationStatusActions";
import { DeleteReservationButton } from "@/components/admin/DeleteReservationButton";

export default async function AdminReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reservation = await getById(id);
  if (!reservation) notFound();

  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;

  const [customer, notifications, deletionSummary] = await Promise.all([
    getCustomerById(reservation.customerId),
    listByReservation(reservation.id),
    resolveReservationDeletionSummary(reservation),
  ]);

  const emailFields = customer ? await resolveConfirmationEmailFields(reservation, customer) : null;

  const lastConfirmationEmail = notifications
    .filter((n) => n.channel === "EMAIL" && n.eventType === "RESERVATION_CONFIRMED" && n.status === "SENT")
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))[0];

  const dateLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL_TIME_ZONE, dateStyle: "long" }).format(
    new Date(`${reservation.dateKey}T00:00:00+09:00`),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">예약 상세</h1>
        <Link href="/admin/reservations" className="text-sm text-stone-600 hover:underline">
          ← 예약 관리
        </Link>
      </div>

      {/* 예약 정보 | 메일 작성 — side by side once there's room, stacked on mobile/tablet. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold text-stone-900">{reservation.reservationNumber}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[reservation.status]}`}>
                {STATUS_LABELS_KO[reservation.status]}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="고객 이름" value={customer?.name ?? "-"} />
              <Field label="이메일 주소" value={customer?.email ?? "-"} />
              <Field label="전화번호" value={customer?.phone ?? "-"} />
              <Field label="인원" value={`${reservation.guestCount}명`} />
              <Field label="메뉴" value={service ? SERVICE_NAMES_KO[service.id] : reservation.serviceOptionId} />
              <Field label="소요시간" value={`${reservation.durationMinutes}분`} />
              <Field label="예약 날짜" value={dateLabel} />
              <Field label="예약 시간" value={formatTimeLabel(reservation.serviceStart, "ko")} />
              <Field label="결제금액" value={formatCurrency(reservation.totalAmount, "ko")} />
            </dl>

            {(reservation.status === "PENDING" || reservation.status === "CONFIRMED") && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <p className="mb-2 text-xs font-medium text-stone-500">예약 상태 변경</p>
                <ReservationStatusActions reservation={reservation} />
              </div>
            )}

            {DELETABLE_RESERVATION_STATUSES.includes(reservation.status) && !reservation.deletedAt && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <DeleteReservationButton
                  reservationId={reservation.id}
                  status={reservation.status}
                  deletedAt={reservation.deletedAt}
                  customerName={deletionSummary.customerName}
                  dateTimeLabel={deletionSummary.dateTimeLabel}
                  serviceLabel={deletionSummary.serviceLabel}
                  guestCount={deletionSummary.guestCount}
                  redirectAfterDeleteTo="/admin/reservations"
                />
              </div>
            )}

            {reservation.deletedAt && (
              <p className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                이 예약은 삭제되어 더 이상 기본 목록에 표시되지 않습니다.
              </p>
            )}
          </section>

          {customer && (
            <EmailStatusControl
              reservationId={reservation.id}
              customerEmail={customer.email}
              sentAt={lastConfirmationEmail?.sentAt ?? null}
            />
          )}
        </div>

        {!customer || !emailFields ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            예약 정보가 불완전하여 확정 메일을 준비할 수 없습니다 (고객 또는 메뉴 정보 누락).
          </p>
        ) : (
          <EmailComposer
            customerEmail={customer.email}
            initialSubject={DEFAULT_CONFIRMATION_SUBJECT}
            fields={emailFields}
          />
        )}
      </div>
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
