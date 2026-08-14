import Link from "next/link";
import { getTodayStats } from "@/lib/admin/dashboardStats";
import { formatCurrency } from "@/lib/booking/pricing";
import { ReservationRow } from "@/components/admin/ReservationRow";
import { listAll } from "@/lib/repositories/reservationRepository";

export default async function AdminDashboardPage() {
  const [stats, pending] = await Promise.all([getTodayStats(), listAll(["PENDING"])]);
  const pendingCount = pending.length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">오늘 현황</h1>
        <nav className="flex gap-4 text-sm text-stone-600">
          <Link href="/admin/reservations" className="hover:underline">
            예약 관리
          </Link>
          <Link href="/admin/send-confirmation" className="hover:underline">
            메일 보내기
          </Link>
          <Link href="/admin/blocked-times" className="hover:underline">
            시간 관리
          </Link>
          <Link href="/admin/agent-handoffs" className="hover:underline">
            에이전트 예외함
          </Link>
        </nav>
      </header>

      {pendingCount > 0 && (
        <Link
          href="/admin/reservations?status=PENDING"
          className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800 hover:bg-blue-100"
        >
          <span>검토 대기 중인 예약 요청 {pendingCount}건</span>
          <span>보러 가기 →</span>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="오늘 예약 팀 수" value={`${stats.confirmedTeams}팀`} />
        <StatCard label="오늘 방문 인원" value={`${stats.totalGuests}명`} />
        <StatCard label="오늘 예상 매출" value={formatCurrency(stats.expectedRevenue, "ko")} />
        <StatCard label="오늘 받은 예약금" value={formatCurrency(stats.depositsCollected, "ko")} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-stone-900">다음 예약</h2>
        {stats.nextReservation ? (
          <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
            <ReservationRow reservation={stats.nextReservation} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">오늘 남은 예약이 없습니다.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-stone-900">오늘 일정</h2>
        <ul className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {stats.todaysReservations.length === 0 ? (
            <li className="p-4 text-sm text-stone-500">오늘 예약이 없습니다.</li>
          ) : (
            stats.todaysReservations.map((r) => (
              <li key={r.id} className="p-4">
                <ReservationRow reservation={r} />
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}
