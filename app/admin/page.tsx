import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import Link from "next/link";
import { getTodayStats } from "@/lib/admin/dashboardStats";
import { formatCurrency } from "@/lib/booking/pricing";
import { ReservationRow } from "@/components/admin/ReservationRow";
import { listAll } from "@/lib/repositories/reservationRepository";
import { getSeoulNow, SEOUL_TIME_ZONE } from "@/lib/booking/timezone";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [stats, pending] = await Promise.all([getTodayStats(), listAll(["PENDING"])]);
  const pendingCount = pending.length;
  const todayLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL_TIME_ZONE, dateStyle: "full" }).format(
    new Date(`${getSeoulNow().dateKey}T00:00:00+09:00`),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">오늘 현황</h1>
        <p className="mt-1 text-sm text-stone-500">{todayLabel}</p>
      </div>

      {pendingCount > 0 && (
        <Link
          href="/admin/reservations?status=PENDING"
          className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800 shadow-sm transition-colors hover:bg-blue-100"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              !
            </span>
            검토 대기 중인 예약 요청 {pendingCount}건
          </span>
          <span>보러 가기 →</span>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="오늘 예약 팀 수" value={`${stats.confirmedTeams}팀`} accent="forest" icon={<TeamsIcon />} />
        <StatCard label="오늘 방문 인원" value={`${stats.totalGuests}명`} accent="blue" icon={<GuestsIcon />} />
        <StatCard label="오늘 예상 매출" value={formatCurrency(stats.expectedRevenue, "ko")} accent="amber" icon={<RevenueIcon />} />
        <StatCard label="오늘 받은 예약금" value={formatCurrency(stats.depositsCollected, "ko")} accent="violet" icon={<DepositIcon />} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-stone-900">다음 예약</h2>
        {stats.nextReservation ? (
          <div className="mt-3 rounded-xl border border-stone-200 border-l-4 border-l-forest-500 bg-white p-4 shadow-sm">
            <ReservationRow reservation={stats.nextReservation} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">오늘 남은 예약이 없습니다.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-stone-900">오늘 일정</h2>
        <ul className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm">
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

const ACCENT_CLASSES = {
  forest: "bg-forest-50 text-forest-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
} as const;

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent: keyof typeof ACCENT_CLASSES;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${ACCENT_CLASSES[accent]}`}>{icon}</span>
      <p className="mt-3 text-xs text-stone-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900">{value}</p>
    </div>
  );
}

const statIconProps = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-5 w-5",
};

function TeamsIcon() {
  return (
    <svg {...statIconProps}>
      <circle cx="7" cy="7.5" r="2.5" />
      <circle cx="14" cy="8" r="2" />
      <path d="M3 16v-1a4 4 0 0 1 4-4h.5a4 4 0 0 1 3.9 3.1" />
      <path d="M12.5 11.5A3.5 3.5 0 0 1 17 15v1" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg {...statIconProps}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 16.5a6 6 0 0 1 12 0" />
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg {...statIconProps}>
      <path d="M3.5 13 8 8.5l3 3 5.5-5.5" />
      <path d="M12.5 6h4v4" />
    </svg>
  );
}

function DepositIcon() {
  return (
    <svg {...statIconProps}>
      <rect x="3" y="6" width="14" height="9.5" rx="1.5" />
      <path d="M3 9h14" />
      <circle cx="13.5" cy="12" r="1.2" />
    </svg>
  );
}
