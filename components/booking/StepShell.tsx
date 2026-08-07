"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useBooking } from "./BookingProvider";
import { BookingProgress } from "./BookingProgress";

export function StepShell({
  title,
  subtitle,
  showBack = true,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  const { draft, goBack } = useBooking();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-28 pt-5 sm:px-6">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            aria-label={t("back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
              <path
                d="M12.5 4l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div className="h-10 w-10 shrink-0" />
        )}
        <BookingProgress currentStep={draft.step} />
      </div>

      <div className="mt-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-stone-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-stone-600">{subtitle}</p> : null}
      </div>

      <div className="mt-6 flex-1">{children}</div>

      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto max-w-xl">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}
