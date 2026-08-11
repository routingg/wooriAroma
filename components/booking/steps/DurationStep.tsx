"use client";

import { useLocale, useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { getService } from "@/data/services";
import { formatCurrency } from "@/lib/booking/pricing";
import type { AppLocale } from "@/i18n/routing";

export function DurationStep() {
  const t = useTranslations("steps.duration");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const { draft, setDuration, goNext } = useBooking();

  const service = draft.serviceId ? getService(draft.serviceId) : undefined;

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <PrimaryButton disabled={!draft.serviceOptionId} onClick={goNext}>
          {tCommon("next")}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-3">
        {service?.options.map((option) => {
          const selected = draft.serviceOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setDuration(option.id)}
              aria-pressed={selected}
              className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left transition-colors ${
                selected
                  ? "border-stone-900 bg-stone-900 text-stone-50"
                  : "border-stone-200 bg-stone-100 text-stone-800 hover:border-stone-400"
              }`}
            >
              <span className="flex items-center gap-2 text-base font-medium">
                {option.durationMinutes} {tCommon("min")}
                {option.recommended ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      selected ? "bg-stone-50 text-forest-700" : "bg-forest-500 text-stone-50"
                    }`}
                  >
                    {tCommon("recommended")}
                  </span>
                ) : null}
              </span>
              <span className={`text-sm ${selected ? "text-stone-200" : "text-stone-600"}`}>
                {formatCurrency(option.pricePerPerson, locale)}
                <span className="ml-1">{tCommon("perPerson")}</span>
              </span>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
