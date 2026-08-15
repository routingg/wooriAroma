"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { BUSINESS, googleMapsPinUrl } from "@/lib/config/business";
import { MOBILE_PRIMARY_QUICK_ACTION_COUNT, QUICK_ACTION_IDS, type QuickActionId } from "./quickActions";

/**
 * A user/model turn as shown in the UI. Deliberately the same shape
 * POST /api/agent/chat's `messages` accepts (see lib/agent/chatRequest.ts's
 * ChatMessage) — no client-side tool_call/tool_result field exists here,
 * since the server rejects anything beyond {role, content} anyway.
 * `link` is UI-only (never sent to the API) — set solely by the local
 * "location" quick action below to render a real, clickable Google Maps
 * link rather than a plain-text URL.
 */
interface ChatEntry {
  role: "user" | "model";
  content: string;
  link?: { label: string; href: string };
}

interface ChatApiResponse {
  reply?: string;
  /** false when Gemini itself is unavailable — see app/api/agent/chat/route.ts's fallback contract. */
  available?: boolean;
}

/**
 * Modal booking assistant, opened from AiBookingButton. Uses the native
 * <dialog> element (via showModal()) rather than a hand-rolled overlay:
 * focus trap, ESC-to-close, and aria-modal semantics all come for free
 * from the browser, which is what task spec §18's accessibility
 * requirements ask for with the least custom code.
 *
 * Only ever talks to the existing POST /api/agent/chat — no new agent
 * backend, no direct tool calls from the client (task spec §20).
 */
export function AiBookingDialog({ onClose }: { onClose: () => void }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("aiAssistant");
  const tQuick = useTranslations("aiAssistant.quickActions");
  const tErrors = useTranslations("errors");

  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // Focus the close button, not the textarea — opening the dialog
    // shouldn't yank a mobile keyboard open before the customer has
    // decided to type anything (task spec §18 "initial focus").
    closeButtonRef.current?.focus();

    function handleNativeClose() {
      onClose();
    }
    dialog.addEventListener("close", handleNativeClose);
    return () => dialog.removeEventListener("close", handleNativeClose);
    // Runs once on mount/unmount only — showModal() must not be called again on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (pending || !trimmed) return;

    const nextMessages: ChatEntry[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setPending(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          locale,
        }),
      });
      const body = (await res.json()) as ChatApiResponse;

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "model", content: tErrors("generic") }]);
        return;
      }

      setUnavailable(body.available === false);
      setMessages((prev) => [...prev, { role: "model", content: body.reply ?? "" }]);
    } catch {
      // Network failure is functionally the same as "AI unavailable" from
      // the customer's point of view — surface the same standard-booking
      // fallback (task spec §11), not just a generic error bubble.
      setUnavailable(true);
      setMessages((prev) => [...prev, { role: "model", content: tErrors("generic") }]);
    } finally {
      setPending(false);
    }
  }

  function submitDraft() {
    if (pending) return;
    const value = draft;
    setDraft("");
    void sendMessage(value);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitDraft();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitDraft();
    }
  }

  /**
   * The "location" quick action is answered locally from real business
   * data (lib/config/business.ts — the same address/link the footer
   * uses) instead of round-tripping to Gemini, per task spec §7's
   * "가능하면 기존 Google Maps 링크/매장 정보 component를 재사용한다": the
   * address is a fixed fact, not something worth any hallucination risk
   * or extra latency for. Every other quick action sends its prompt
   * through the same agent flow as free-typed text.
   */
  function handleQuickAction(id: QuickActionId) {
    if (pending) return;
    if (id === "location") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: tQuick("location.label") },
        {
          role: "model",
          content: BUSINESS.addressEn,
          link: { label: t("viewOnMaps"), href: googleMapsPinUrl },
        },
      ]);
      return;
    }
    void sendMessage(tQuick(`${id}.prompt`));
  }

  const visibleQuickActionIds = showAllQuickActions
    ? QUICK_ACTION_IDS
    : QUICK_ACTION_IDS.slice(0, MOBILE_PRIMARY_QUICK_ACTION_COUNT);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={(event) => {
        // Standard "click on the backdrop closes the dialog" idiom: a
        // direct hit on the <dialog> element itself (not a descendant)
        // only happens outside the visible content box.
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 flex h-[92dvh] w-full max-w-none flex-col rounded-t-[var(--radius-2xl)] border-t border-stone-200 bg-stone-50 p-0 text-stone-900 shadow-lg backdrop:bg-stone-900/50 sm:inset-0 sm:m-auto sm:h-auto sm:max-h-[640px] sm:w-full sm:max-w-md sm:rounded-[var(--radius-2xl)] sm:border"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <div>
          <h2 id={titleId} className="font-[family-name:var(--font-display)] text-lg font-semibold text-stone-900">
            {t("dialogTitle")}
          </h2>
          <p className="text-xs text-stone-500">{t("dialogSubtitle")}</p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t("close")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
            <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-relaxed text-stone-700">
            {t("greeting")}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                (message.role === "user" ? "bg-stone-900 text-stone-50" : "bg-stone-100 text-stone-800")
              }
            >
              <p className="whitespace-pre-line">{message.content}</p>
              {message.link ? (
                <a
                  href={message.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-medium underline underline-offset-4"
                >
                  {message.link.label}
                </a>
              ) : null}
            </div>
          </div>
        ))}

        {pending ? (
          <div className="flex justify-start">
            <p className="rounded-2xl bg-stone-100 px-4 py-2.5 text-sm text-stone-500 italic">{t("thinking")}</p>
          </div>
        ) : null}

        {unavailable ? (
          <div className="rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-700">
            <p className="font-medium text-stone-900">{t("unavailableTitle")}</p>
            <p className="mt-1">{t("unavailableBody")}</p>
            <Link
              href="/book"
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-[var(--radius-button)] bg-stone-900 px-5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
            >
              {t("standardBookingCta")}
            </Link>
          </div>
        ) : null}

        {/*
         * Quick actions only show on the empty first screen — mid-
         * conversation structured replies (guest-count buttons, treatment
         * buttons per task spec §8) are an intentional extension point,
         * not built in this pass. ChatEntry/handleQuickAction's shape
         * already generalizes to a future `quickReplies?: QuickActionId[]`
         * field on a model turn without changing this component's core loop.
         */}
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {visibleQuickActionIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleQuickAction(id)}
                disabled={pending}
                className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-left text-sm text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tQuick(`${id}.label`)}
              </button>
            ))}
            {!showAllQuickActions && QUICK_ACTION_IDS.length > MOBILE_PRIMARY_QUICK_ACTION_COUNT ? (
              <button
                type="button"
                onClick={() => setShowAllQuickActions(true)}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-stone-500 underline underline-offset-4 hover:text-stone-900"
              >
                {t("moreQuestions")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-stone-200 bg-stone-50 px-4 py-3">
        <textarea
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder={t("inputPlaceholder")}
          disabled={pending}
          className="max-h-28 flex-1 resize-none rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="flex h-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-stone-900 px-5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {t("send")}
        </button>
      </form>
    </dialog>
  );
}
