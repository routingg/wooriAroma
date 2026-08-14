import { markConfirmationEmailSentAction } from "@/app/admin/actions";

/**
 * Manual "did I actually send this from Gmail" tracker — entirely separate
 * from reservation status (AGENTS.md §20). Never sends anything; the button
 * only writes a marker row via markConfirmationEmailSentAction.
 */
export function EmailStatusControl({
  reservationId,
  customerEmail,
  sentAt,
}: {
  reservationId: string;
  customerEmail: string;
  sentAt: string | null;
}) {
  const sentLabel = sentAt
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" }).format(
        new Date(sentAt),
      )
    : null;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-stone-900">메일 상태</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            sentLabel ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"
          }`}
        >
          <span aria-hidden="true">●</span>
          {sentLabel ? `발송 완료 · ${sentLabel}` : "발송 전"}
        </span>
        {!sentLabel && (
          <form action={markConfirmationEmailSentAction.bind(null, reservationId, customerEmail)}>
            <button
              type="submit"
              className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              메일 발송 완료로 표시
            </button>
          </form>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        이 상태는 시스템이 실제로 메일을 발송했는지와 무관합니다. Gmail 등에서 직접 발송한 뒤 수동으로 표시해 주세요.
      </p>
    </section>
  );
}
