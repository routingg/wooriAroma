import Link from "next/link";
import { listAll, type ReservationRecord, type ReservationStatus } from "@/lib/repositories/reservationRepository";
import { getSeoulNow } from "@/lib/booking/timezone";
import { toMinutes } from "@/lib/booking/time";
import { ReservationRow } from "@/components/admin/ReservationRow";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { STATUS_LABELS_KO } from "@/lib/admin/labels";
import { updateReservationStatusAction } from "../actions";

const STATUS_OPTIONS: ReservationStatus[] = ["HOLD", "CONFIRMED", "CANCELLED", "NO_SHOW", "COMPLETED"];

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status as ReservationStatus | undefined;

  const reservations = listAll(statusFilter ? [statusFilter] : undefined);

  const now = getSeoulNow();
  const isUpcoming = (r: ReservationRecord) =>
    r.dateKey > now.dateKey || (r.dateKey === now.dateKey && toMinutes(r.serviceStart) >= now.minutes);

  const upcoming = reservations.filter(isUpcoming).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.serviceStart.localeCompare(b.serviceStart));
  const past = reservations
    .filter((r) => !isUpcoming(r))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.serviceStart.localeCompare(a.serviceStart));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">예약 관리</h1>
        <Link href="/admin" className="text-sm text-stone-600 hover:underline">
          ← 대시보드
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm text-stone-700">
          상태
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS_KO[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white">
          조회
        </button>
      </form>

      <ReservationSection title={`다가오는 예약 (${upcoming.length})`} reservations={upcoming} />
      <ReservationSection title={`지난 예약 (${past.length})`} reservations={past} />
    </main>
  );
}

function ReservationSection({ title, reservations }: { title: string; reservations: ReservationRecord[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {reservations.length === 0 ? (
          <li className="p-4 text-sm text-stone-500">조건에 맞는 예약이 없습니다.</li>
        ) : (
          reservations.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <ReservationRow reservation={r} />
              <ReservationActions reservation={r} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function ReservationActions({ reservation }: { reservation: ReservationRecord }) {
  if (reservation.status !== "CONFIRMED") return null;

  return (
    <div className="flex shrink-0 gap-2">
      <form action={updateReservationStatusAction.bind(null, reservation.id, "COMPLETED")}>
        <button type="submit" className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100">
          완료 처리
        </button>
      </form>
      <form action={updateReservationStatusAction.bind(null, reservation.id, "NO_SHOW")}>
        <ConfirmSubmitButton
          confirmMessage={`${reservation.reservationNumber} 예약을 No-show 처리할까요?`}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100"
        >
          No-show
        </ConfirmSubmitButton>
      </form>
      <form action={updateReservationStatusAction.bind(null, reservation.id, "CANCELLED")}>
        <ConfirmSubmitButton
          confirmMessage={`${reservation.reservationNumber} 예약을 취소할까요?`}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
        >
          취소
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
