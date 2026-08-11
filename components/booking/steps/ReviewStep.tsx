"use client";

import { useLocale, useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { getService, getServiceOption } from "@/data/services";
import {
  calculateDepositAmount,
  calculateRemainingAmount,
  calculateTotalAmount,
  formatCurrency,
} from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import type { AppLocale } from "@/i18n/routing";

export function ReviewStep() {
  const t = useTranslations("steps.review");
  const tCommon = useTranslations("common");
  const tServices = useTranslations("services");
  const locale = useLocale() as AppLocale;
  const { draft, goNext, goToStep } = useBooking();

  const option = draft.serviceOptionId ? getServiceOption(draft.serviceOptionId) : undefined;
  const service = option ? getService(option.serviceId) : undefined;
  const guestCount = draft.guestCount ?? 0;

  if (!option || !service || !draft.date || !draft.time || !draft.details) {
    return null;
  }

  const total = calculateTotalAmount(option.pricePerPerson, guestCount);
  const deposit = calculateDepositAmount(guestCount);
  const remaining = calculateRemainingAmount(total, deposit);

  const dateLabel = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${draft.date}T00:00:00`));

  return (
    <StepShell
      title={t("title")}
      footer={
        <PrimaryButton onClick={goNext}>{t("confirmAndPay")}</PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-stone-200 bg-stone-100 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-stone-500">{t("guestsLabel", { count: guestCount })}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-stone-900">
                {tServices(service.nameKey.replace("services.", ""))}
              </p>
              <p className="text-sm text-stone-600">
                {option.durationMinutes} {tCommon("min")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goToStep("treatment")}
              className="text-sm font-medium text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
            >
              {t("edit")}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4 text-sm">
            <span className="text-stone-600">
              {dateLabel} · {formatTimeLabel(draft.time, locale)}
            </span>
            <button
              type="button"
              onClick={() => goToStep("date")}
              className="font-medium text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
            >
              {t("edit")}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-100 p-5 text-sm">
          <div className="flex items-center justify-between text-stone-600">
            <span>{t("treatmentLine", { price: formatCurrency(option.pricePerPerson, locale), count: guestCount })}</span>
            <span>{formatCurrency(total, locale)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 font-medium text-stone-900">
            <span>{t("totalLabel")}</span>
            <span>{formatCurrency(total, locale)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-stone-600">
            <span>{t("depositLabel")}</span>
            <span>{formatCurrency(deposit, locale)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-stone-600">
            <span>{t("payAtSpaLabel")}</span>
            <span>{formatCurrency(remaining, locale)}</span>
          </div>
        </div>

        <p className="text-center text-xs text-stone-500">{t("termsNote")}</p>
      </div>
    </StepShell>
  );
}
