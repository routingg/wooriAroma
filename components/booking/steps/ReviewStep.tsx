"use client";

import { useLocale, useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import {
  isMixedTreatment,
  resolveGuestOptionIds,
  resolveGuestTreatments,
  totalAmountForGuestOptionIds,
} from "@/lib/booking/guestSelection";
import type { AppLocale } from "@/i18n/routing";

export function ReviewStep() {
  const t = useTranslations("steps.review");
  const tCommon = useTranslations("common");
  const tServices = useTranslations("services");
  const locale = useLocale() as AppLocale;
  const { draft, goNext, goToStep } = useBooking();

  const guestCount = draft.guestCount ?? 0;
  const guestOptionIds = resolveGuestOptionIds(draft);
  const treatments = guestOptionIds ? resolveGuestTreatments(guestOptionIds) : null;

  if (!treatments || !draft.date || !draft.time || !draft.details) {
    return null;
  }

  const mixed = isMixedTreatment(guestOptionIds!);
  const total = totalAmountForGuestOptionIds(guestOptionIds!);
  const { option, service } = treatments[0];

  const dateLabel = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${draft.date}T00:00:00`));

  return (
    <StepShell
      title={t("title")}
      footer={
        <PrimaryButton onClick={goNext}>{t("submitRequest")}</PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-stone-200 bg-stone-100 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-stone-500">{t("guestsLabel", { count: guestCount })}</p>
              {mixed ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {treatments.map((guest) => (
                    <li key={guest.guestNumber} className="text-sm font-medium text-stone-900">
                      {tCommon("guestLabel", { n: guest.guestNumber })}: {tServices(guest.service.nameKey.replace("services.", ""))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-stone-900">
                  {tServices(service.nameKey.replace("services.", ""))}
                </p>
              )}
              <p className="text-sm text-stone-600">
                {option.durationMinutes} {tCommon("min")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goToStep(mixed ? "sameCourse" : "treatment")}
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
          {mixed ? (
            treatments.map((guest) => (
              <div key={guest.guestNumber} className="flex items-center justify-between text-stone-600">
                <span>
                  {tCommon("guestLabel", { n: guest.guestNumber })} · {tServices(guest.service.nameKey.replace("services.", ""))}
                </span>
                <span>{formatCurrency(guest.option.pricePerPerson, locale)}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between text-stone-600">
              <span>{t("treatmentLine", { price: formatCurrency(option.pricePerPerson, locale), count: guestCount })}</span>
              <span>{formatCurrency(total, locale)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 font-medium text-stone-900">
            <span>{t("totalLabel")}</span>
            <span>{formatCurrency(total, locale)}</span>
          </div>
        </div>

        <p className="text-center text-xs text-stone-500">{t("termsNote")}</p>
      </div>
    </StepShell>
  );
}
