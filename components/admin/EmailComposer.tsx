"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CLOSING_TEXT,
  DEFAULT_CONFIRM_TEXT,
  DEFAULT_INTRO_TEXT,
  DEFAULT_PRIVACY_TEXT,
  DEFAULT_VISIT_TEXT,
  generateConfirmationEmail,
  type ConfirmationEmailReservationFields,
} from "@/lib/admin/confirmationEmailTemplate";

type CopyKey = "name" | "email" | "subject" | "body" | "all";
type ClipboardOutcome = "rich" | "plain" | "failed";
type EmailVersion = "text" | "design";

const VERSION_STORAGE_KEY = "wa_admin_email_version";

interface EmailComposerProps {
  customerEmail: string;
  initialSubject: string;
  fields: ConfirmationEmailReservationFields;
}

function loadStoredVersion(): EmailVersion {
  if (typeof window === "undefined") return "design";
  try {
    const raw = window.sessionStorage.getItem(VERSION_STORAGE_KEY);
    return raw === "text" ? "text" : "design";
  } catch {
    return "design";
  }
}

/**
 * Prepare-and-copy only — never sends anything. Reservation-derived fields
 * (date/time/treatment/guests/name) come in as fixed props; everything the
 * admin can edit (subject + the five text blocks) is local React state that
 * never writes back to the reservation. The exact same
 * generateConfirmationEmail() call feeds both the 텍스트 버전 and 디자인 버전,
 * so the two — and the live preview vs. what gets copied — can never drift
 * apart (AGENTS.md §14/§23).
 */
export function EmailComposer({ customerEmail, initialSubject, fields }: EmailComposerProps) {
  const [version, setVersion] = useState<EmailVersion>("design");
  const [subject, setSubject] = useState(initialSubject);
  const [introText, setIntroText] = useState(DEFAULT_INTRO_TEXT);
  const [confirmText, setConfirmText] = useState(DEFAULT_CONFIRM_TEXT);
  const [privacyText, setPrivacyText] = useState(DEFAULT_PRIVACY_TEXT);
  const [visitText, setVisitText] = useState(DEFAULT_VISIT_TEXT);
  const [closingText, setClosingText] = useState(DEFAULT_CLOSING_TEXT);

  const [copiedKey, setCopiedKey] = useState<CopyKey | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remember the admin's last-picked version for this browser tab session
  // (AGENTS.md §3) — read once on mount, after hydration, to avoid a
  // server/client mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVersion(loadStoredVersion());
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(VERSION_STORAGE_KEY, version);
    } catch {
      // Ignore storage failures (private browsing, quota) — the choice
      // still applies for this render, it just won't persist.
    }
  }, [version]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  const generated = useMemo(
    () =>
      generateConfirmationEmail({
        subject,
        customerName: fields.customerName,
        dateLabel: fields.dateLabel,
        timeLabel: fields.timeLabel,
        treatmentName: fields.treatmentName,
        durationMinutes: fields.durationMinutes,
        guestCount: fields.guestCount,
        introText,
        confirmText,
        privacyText,
        visitText,
        closingText,
      }),
    [subject, introText, confirmText, privacyText, visitText, closingText, fields],
  );

  /** Standalone text-version body: subject embedded at the top so it's self-contained for Instagram DM/WhatsApp, which have no separate subject field (AGENTS.md §4). */
  const standaloneText = `Subject:\n${subject}\n\n\n${generated.plainText}`;

  function flashCopied(key: CopyKey) {
    setCopiedKey(key);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedKey(null), 1500);
  }

  function showFallbackNotice() {
    setFallbackNotice(true);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setFallbackNotice(false), 4000);
  }

  async function copyPlain(key: CopyKey, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied(key);
    } catch {
      // Clipboard permission denied or unavailable — nothing else we can do here.
    }
  }

  /**
   * 디자인 메일 복사: attempts an HTML + plain-text ClipboardItem first (so
   * pasting into Gmail keeps formatting), and falls back to plain text when
   * the browser doesn't support writing HTML to the clipboard (AGENTS.md
   * §18/§21) — never fails silently, the fallback is surfaced via a Korean
   * notice.
   */
  async function copyDesignVersion() {
    const outcome = await writeRichClipboard(generated.html, generated.plainText);
    if (outcome === "failed") return;
    flashCopied("body");
    if (outcome === "plain") showFallbackNotice();
  }

  const allText = [
    `Name: ${fields.customerName}`,
    `Email: ${customerEmail}`,
    "",
    "Subject:",
    subject,
    "",
    "Message:",
    generated.plainText,
  ].join("\n");

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">메일 작성</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            자동으로 발송되지 않습니다. 내용을 확인한 뒤 복사하여 Gmail 등에서 직접 보내주세요.
          </p>
        </div>
        <CopyButton label="전체 정보 복사" size="small" copied={copiedKey === "all"} onClick={() => copyPlain("all", allText)} />
      </div>

      <p className="mt-5 text-xs font-semibold tracking-wide text-stone-500">고객</p>
      <FieldRow label="고객 이름" value={fields.customerName} copyLabel="이름 복사" copied={copiedKey === "name"} onCopy={() => copyPlain("name", fields.customerName)} />
      <FieldRow label="이메일" value={customerEmail} copyLabel="이메일 복사" copied={copiedKey === "email"} onCopy={() => copyPlain("email", customerEmail)} />

      <div className="mt-5 border-t border-stone-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="email-subject" className="text-xs font-semibold tracking-wide text-stone-500">
            메일 제목
          </label>
          <CopyButton label="제목 복사" copied={copiedKey === "subject"} onClick={() => copyPlain("subject", subject)} />
        </div>
        <input
          id="email-subject"
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
        />
      </div>

      <div className="mt-6 border-t border-stone-100 pt-4">
        <p className="text-sm font-semibold text-stone-900">메일 문구 수정</p>
        <p className="mt-0.5 text-xs text-stone-500">
          디자인은 고정되어 있으며, 아래 문구만 수정할 수 있습니다. 수정 내용은 텍스트 버전과 디자인 버전에 동시에 반영됩니다.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <TextField label="인사말" value={introText} onChange={setIntroText} />
          <TextField label="예약 안내 문구" value={confirmText} onChange={setConfirmText} />
          <TextField label="프라이빗 스파 안내" value={privacyText} onChange={setPrivacyText} />
          <TextField label="방문 안내" value={visitText} onChange={setVisitText} />
          <TextField label="마무리 문구" value={closingText} onChange={setClosingText} />
        </div>
      </div>

      <div className="mt-6 border-t border-stone-100 pt-4">
        <p className="text-sm font-semibold text-stone-900">메일 형식</p>
        <div className="mt-2 inline-flex rounded-lg border border-stone-300 bg-stone-100 p-1">
          <VersionTabButton label="텍스트 버전" active={version === "text"} onClick={() => setVersion("text")} />
          <VersionTabButton label="디자인 버전" active={version === "design"} onClick={() => setVersion("design")} />
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-stone-500">메일 미리보기</p>
          {version === "text" ? (
            <pre className="mt-2 max-h-[600px] overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-stone-800">
              {standaloneText}
            </pre>
          ) : (
            <div className="mt-2 overflow-hidden rounded-lg border border-stone-200">
              <iframe title="메일 미리보기" srcDoc={generated.html} className="h-[600px] w-full bg-white" sandbox="" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {version === "text" ? (
          <button
            type="button"
            onClick={() => void copyPlain("body", standaloneText)}
            className={`flex-1 rounded-lg px-5 py-3 text-sm font-semibold transition-colors sm:flex-none sm:px-8 ${
              copiedKey === "body" ? "bg-emerald-600 text-white" : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            {copiedKey === "body" ? "복사 완료 ✓" : "텍스트 복사"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void copyDesignVersion()}
            className={`flex-1 rounded-lg px-5 py-3 text-sm font-semibold transition-colors sm:flex-none sm:px-8 ${
              copiedKey === "body" ? "bg-emerald-600 text-white" : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            {copiedKey === "body" ? "복사 완료 ✓" : "디자인 메일 복사"}
          </button>
        )}
        {fallbackNotice && (
          <p className="text-xs text-amber-700">이 브라우저에서는 서식 없는 텍스트로 복사되었습니다.</p>
        )}
      </div>
    </section>
  );
}

/** Attempts a rich (HTML + plain text) clipboard write; falls back to plain text; never throws. */
async function writeRichClipboard(html: string, text: string): Promise<ClipboardOutcome> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return "rich";
    }
  } catch {
    // Some browsers expose ClipboardItem but reject non-text MIME types —
    // fall through to the plain-text path below.
  }

  try {
    await navigator.clipboard.writeText(text);
    return "plain";
  } catch {
    return "failed";
  }
}

function FieldRow({
  label,
  value,
  copyLabel,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-stone-900">{value}</p>
      </div>
      <CopyButton label={copyLabel} copied={copied} onClick={onCopy} />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm leading-relaxed text-stone-900 focus:border-stone-500 focus:outline-none"
      />
    </label>
  );
}

function VersionTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
      }`}
    >
      {label}
    </button>
  );
}

function CopyButton({
  label,
  copied,
  onClick,
  size = "default",
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
  size?: "default" | "small";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg font-medium transition-colors ${
        size === "small" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${
        copied ? "border border-emerald-300 bg-emerald-50 text-emerald-700" : "border border-stone-300 text-stone-700 hover:bg-stone-100"
      }`}
    >
      {copied ? "복사 완료 ✓" : label}
    </button>
  );
}
