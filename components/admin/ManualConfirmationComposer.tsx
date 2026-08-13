"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  getManualPreviewAction,
  sendManualConfirmationAction,
  sendManualTestEmailAction,
  type ManualPreviewState,
  type SendResultState,
} from "@/app/admin/send-confirmation/actions";
import type { ManualConfirmationInput } from "@/lib/notifications/manualPayload";
import { describeSendResult, REASON_LABELS_KO } from "@/lib/admin/emailResultLabels";
import { getBookableServices } from "@/data/services";
import { formatCurrency } from "@/lib/booking/pricing";
import { SERVICE_NAMES_KO } from "@/lib/admin/labels";
import { localeNames } from "@/i18n/config";
import { locales, type AppLocale } from "@/i18n/routing";
import type { EmailDeliveryMode } from "@/lib/notifications/recipientPolicy";

const IDLE_PREVIEW: ManualPreviewState = { status: "idle" };
const IDLE_SEND: SendResultState = { status: "idle" };

const services = getBookableServices();

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Manual/unlinked confirmation composer — for a reservation that doesn't
 * exist in the database (walk-in, offline booking, or anything outside the
 * online booking system). Fields are controlled React state; each button
 * calls the corresponding server action directly (inside useTransition),
 * the same pattern ConfirmationEmailPanel's live preview already uses —
 * not a <form> submission, since a shared <form> with three different
 * per-button `formAction`s round-tripped through a real page navigation
 * here instead of a client-side action dispatch.
 */
export function ManualConfirmationComposer({
  deliveryMode,
  testRecipientConfigured,
}: {
  deliveryMode: EmailDeliveryMode;
  testRecipientConfigured: boolean;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [date, setDate] = useState(todayDateKey());
  const [time, setTime] = useState("21:00");
  const [serviceOptionId, setServiceOptionId] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [preferredLanguage, setPreferredLanguage] = useState<AppLocale>("en");
  const [reservationNumber, setReservationNumber] = useState("");
  const [includeMap, setIncludeMap] = useState(true);

  const [previewState, setPreviewState] = useState<ManualPreviewState>(IDLE_PREVIEW);
  const [sendState, setSendState] = useState<SendResultState>(IDLE_SEND);
  const [testState, setTestState] = useState<SendResultState>(IDLE_SEND);
  const [isPreviewing, startPreview] = useTransition();
  const [isSending, startSend] = useTransition();
  const [isTesting, startTest] = useTransition();

  function currentInput(): ManualConfirmationInput {
    return {
      customerName,
      customerEmail,
      date,
      time,
      serviceOptionId,
      guestCount,
      preferredLanguage,
      reservationNumber,
    };
  }

  function handlePreview() {
    const input = currentInput();
    startPreview(async () => setPreviewState(await getManualPreviewAction(input, includeMap)));
  }

  function handleSend() {
    const input = currentInput();
    startSend(async () => setSendState(await sendManualConfirmationAction(input, includeMap)));
  }

  function handleTest() {
    const input = currentInput();
    startTest(async () => setTestState(await sendManualTestEmailAction(input, includeMap)));
  }

  const sendResultLabel = describeSendResult(sendState);
  const testResultLabel = describeSendResult(testState);
  const previewError = previewState.status === "error" ? previewState.reason : null;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-stone-900">직접 입력</h2>
      <p className="mt-1 text-sm text-stone-500">
        예약 시스템에 없는 고객에게 보낼 확정 메일입니다. 이 발송은 예약 데이터베이스에 기록되지 않습니다.
      </p>

      {deliveryMode === "sandbox" && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          테스트 모드 — 모든 확정 메일은 실제 고객이 아닌 EMAIL_TEST_RECIPIENT로만 전달됩니다.
          {!testRecipientConfigured && " (EMAIL_TEST_RECIPIENT가 설정되지 않아 발송이 차단됩니다.)"}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="고객 이름">
          <input
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="예: yujeonglim"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="고객 이메일">
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="customer@example.com"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="날짜">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="시간">
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="메뉴">
          <select
            value={serviceOptionId}
            onChange={(event) => setServiceOptionId(event.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              메뉴를 선택하세요
            </option>
            {services.map((service) =>
              service.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {SERVICE_NAMES_KO[service.id] ?? service.id} · {option.durationMinutes}분 ·{" "}
                  {formatCurrency(option.pricePerPerson, "ko")}
                </option>
              )),
            )}
          </select>
        </Field>
        <Field label="인원">
          <select
            value={guestCount}
            onChange={(event) => setGuestCount(Number(event.target.value))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}명
              </option>
            ))}
          </select>
        </Field>
        <Field label="발송 언어">
          <select
            value={preferredLanguage}
            onChange={(event) => setPreferredLanguage(event.target.value as AppLocale)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {localeNames[locale]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="예약 번호 (선택)">
          <input
            type="text"
            value={reservationNumber}
            onChange={(event) => setReservationNumber(event.target.value)}
            placeholder="비워두면 자동 생성됩니다"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>

        <label className="col-span-full mt-1 flex w-fit items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={includeMap}
            onChange={(event) => setIncludeMap(event.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          오시는 길 지도 포함
        </label>

        <div className="col-span-full mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewing}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            {isPreviewing ? "생성 중…" : "미리보기 생성"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !testRecipientConfigured}
            title={!testRecipientConfigured ? "EMAIL_TEST_RECIPIENT가 설정되지 않았습니다" : undefined}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            {isTesting ? "발송 중…" : "테스트 메일 보내기"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSending ? "발송 중…" : "확정 메일 보내기"}
          </button>
        </div>
      </div>

      {previewError && (
        <p className="mt-3 text-xs text-red-600">미리보기 실패 — {REASON_LABELS_KO[previewError] ?? previewError}</p>
      )}

      {previewState.status === "ready" && previewState.preview && (
        <div className="mt-4 overflow-hidden rounded-lg border border-stone-200">
          <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-3 py-2">
            <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">미리보기</span>
          </div>
          <p className="border-b border-stone-100 px-3 py-2 text-sm font-medium text-stone-900">
            {previewState.preview.subject}
          </p>
          <iframe
            title="이메일 미리보기"
            srcDoc={previewState.preview.html}
            className="h-[520px] w-full bg-white"
            sandbox=""
          />
        </div>
      )}

      {sendResultLabel && <p className="mt-3 text-xs text-stone-600">확정 메일: {sendResultLabel}</p>}
      {testResultLabel && <p className="mt-1 text-xs text-stone-600">테스트 메일: {testResultLabel}</p>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
