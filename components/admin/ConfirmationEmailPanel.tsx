"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  getEmailPreviewAction,
  sendConfirmationEmailAction,
  sendTestConfirmationEmailAction,
  type SendResultState,
} from "@/app/admin/reservations/[id]/actions";
import { describeSendResult } from "@/lib/admin/emailResultLabels";
import type { EmailPreview } from "@/lib/notifications/preview";
import type { EmailDeliveryMode } from "@/lib/notifications/recipientPolicy";

const IDLE: SendResultState = { status: "idle" };

export function ConfirmationEmailPanel({
  reservationId,
  initialPreview,
  deliveryMode,
  testRecipientConfigured,
  lastSentAt,
}: {
  reservationId: string;
  initialPreview: EmailPreview;
  deliveryMode: EmailDeliveryMode;
  testRecipientConfigured: boolean;
  lastSentAt: string | null;
}) {
  const [includeMap, setIncludeMap] = useState(true);
  const [preview, setPreview] = useState(initialPreview);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const isFirstRender = useRef(true);

  const [sendState, sendAction, isSending] = useActionState(
    sendConfirmationEmailAction.bind(null, reservationId),
    IDLE,
  );
  const [testState, testAction, isTesting] = useActionState(
    sendTestConfirmationEmailAction.bind(null, reservationId),
    IDLE,
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    startPreviewTransition(async () => {
      const result = await getEmailPreviewAction(reservationId, includeMap);
      if ("html" in result) setPreview(result);
    });
  }, [includeMap, reservationId, startPreviewTransition]);

  const lastSentLabel = lastSentAt
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" }).format(
        new Date(lastSentAt),
      )
    : null;

  const sendResultLabel = describeSendResult(sendState);
  const testResultLabel = describeSendResult(testState);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">확정 메일</h2>
        {lastSentLabel ? (
          <span className="text-xs font-medium text-emerald-700">✓ 발송됨 · {lastSentLabel}</span>
        ) : (
          <span className="text-xs text-stone-400">미발송</span>
        )}
      </div>

      {deliveryMode === "sandbox" && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          테스트 모드 — 모든 확정 메일은 실제 고객이 아닌 EMAIL_TEST_RECIPIENT로만 전달됩니다.
          {!testRecipientConfigured && " (EMAIL_TEST_RECIPIENT가 설정되지 않아 발송이 차단됩니다.)"}
        </p>
      )}

      <label className="mt-4 flex w-fit items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={includeMap}
          onChange={(event) => setIncludeMap(event.target.checked)}
          className="h-4 w-4 rounded border-stone-300"
        />
        오시는 길 지도 포함
      </label>

      <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-3 py-2">
          <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">미리보기</span>
          {isPreviewPending && <span className="text-xs text-stone-400">업데이트 중…</span>}
        </div>
        <p className="border-b border-stone-100 px-3 py-2 text-sm font-medium text-stone-900">{preview.subject}</p>
        <iframe title="이메일 미리보기" srcDoc={preview.html} className="h-[520px] w-full bg-white" sandbox="" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={sendAction}>
          <input type="hidden" name="includeMap" value={includeMap ? "on" : "off"} />
          <button
            type="submit"
            disabled={isSending}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSending ? "발송 중…" : lastSentLabel ? "재발송" : "확정 메일 보내기"}
          </button>
        </form>
        <form action={testAction}>
          <input type="hidden" name="includeMap" value={includeMap ? "on" : "off"} />
          <button
            type="submit"
            disabled={isTesting || !testRecipientConfigured}
            title={!testRecipientConfigured ? "EMAIL_TEST_RECIPIENT가 설정되지 않았습니다" : undefined}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            {isTesting ? "발송 중…" : "테스트 메일 보내기"}
          </button>
        </form>
      </div>

      {sendResultLabel && <p className="mt-2 text-xs text-stone-600">확정 메일: {sendResultLabel}</p>}
      {testResultLabel && <p className="mt-1 text-xs text-stone-600">테스트 메일: {testResultLabel}</p>}
    </section>
  );
}
