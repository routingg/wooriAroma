import Link from "next/link";
import { listUpcomingBlockedTimes } from "@/lib/repositories/blockedTimeRepository";
import { getSeoulNow } from "@/lib/booking/timezone";
import { formatTimeLabel } from "@/lib/booking/time";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { createBlockedTimeAction, removeBlockedTimeAction } from "../actions";

export default async function AdminBlockedTimesPage() {
  const today = getSeoulNow().dateKey;
  const blocks = listUpcomingBlockedTimes(today);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">시간 관리</h1>
        <Link href="/admin" className="text-sm text-stone-600 hover:underline">
          ← 대시보드
        </Link>
      </div>

      <form action={createBlockedTimeAction} className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-900">차단 추가</h2>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm text-stone-700">
            날짜
            <input required type="date" name="dateKey" min={today} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-stone-700">
            시작
            <input type="time" name="startTime" defaultValue="10:00" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-stone-700">
            종료
            <input type="time" name="endTime" defaultValue="21:00" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-stone-700">
            <input type="checkbox" name="fullDay" /> 하루 종일 (휴무일)
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-stone-700">
          사유
          <input
            type="text"
            name="reason"
            placeholder="예: 정기 휴무, 시설 점검"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="w-fit rounded-lg bg-stone-900 px-4 py-2 text-sm text-white">
          추가
        </button>
      </form>

      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {blocks.length === 0 ? (
          <li className="p-4 text-sm text-stone-500">예정된 차단 시간이 없습니다.</li>
        ) : (
          blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium text-stone-900">
                  {b.dateKey} · {b.fullDay ? "하루 종일" : `${formatTimeLabel(b.startTime, "ko")} - ${formatTimeLabel(b.endTime, "ko")}`}
                </p>
                {b.reason ? <p className="text-stone-500">{b.reason}</p> : null}
              </div>
              <form action={removeBlockedTimeAction.bind(null, b.id)}>
                <ConfirmSubmitButton
                  confirmMessage="이 차단을 삭제할까요? 해당 시간이 다시 예약 가능해집니다."
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100"
                >
                  삭제
                </ConfirmSubmitButton>
              </form>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
