import { requireAdmin } from "@/lib/admin/auth";
import { listHandoffs } from "@/lib/repositories/agentHandoffRepository";
import { resolveHandoffAction } from "../actions";

export default async function AgentHandoffsPage() {
  await requireAdmin();
  const [open, resolvedAll] = await Promise.all([listHandoffs("OPEN"), listHandoffs("RESOLVED")]);
  const resolved = resolvedAll.slice(0, 10);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900">에이전트 예외함</h1>
      <p className="text-sm text-stone-500">
        AI 예약 에이전트가 스스로 처리할 수 없어 관리자에게 넘긴 요청 목록입니다.
      </p>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          처리 대기
          {open.length > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{open.length}</span>
          ) : (
            <span className="text-xs font-normal text-stone-400">0</span>
          )}
        </h2>
        <ul className="mt-3 divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          {open.length === 0 ? (
            <li className="p-4 text-sm text-stone-500">대기 중인 항목이 없습니다.</li>
          ) : (
            open.map((h) => (
              <li key={h.id} className="flex flex-col gap-2 border-l-4 border-amber-400 p-4 text-sm">
                <p className="font-medium text-stone-900">{h.reason}</p>
                <p className="text-stone-600">{h.summary}</p>
                {h.customerContact ? <p className="text-stone-500">연락처: {h.customerContact}</p> : null}
                <p className="text-xs text-stone-400">{new Date(h.createdAt).toLocaleString("ko-KR")}</p>
                <form action={resolveHandoffAction.bind(null, h.id)} className="mt-1 flex gap-2">
                  <input
                    type="text"
                    name="adminNotes"
                    placeholder="처리 메모 (선택)"
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs"
                  />
                  <button type="submit" className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white">
                    처리 완료
                  </button>
                </form>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          최근 처리 완료
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            {resolved.length}
          </span>
        </h2>
        <ul className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm">
          {resolved.length === 0 ? (
            <li className="p-4 text-sm text-stone-500">처리 완료된 항목이 없습니다.</li>
          ) : (
            resolved.map((h) => (
              <li key={h.id} className="p-4 text-sm text-stone-500">
                <p className="text-stone-700">{h.reason}</p>
                {h.adminNotes ? <p className="mt-1 text-xs">메모: {h.adminNotes}</p> : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
