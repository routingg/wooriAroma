"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { getServiceOption } from "@/data/services";
import { generateAvailableSlots } from "@/lib/booking/availability";
import { getMockBlockedWindows } from "@/lib/booking/mockData";
import { formatTimeLabel } from "@/lib/booking/time";

export function TimeStep() {
  const t = useTranslations("steps.time");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { draft, setTime, goNext } = useBooking();

  const option = draft.serviceOptionId ? getServiceOption(draft.serviceOptionId) : undefined;

  const slots = useMemo(() => {
    if (!option || !draft.date) return [];
    return generateAvailableSlots(draft.date, option.durationMinutes, getMockBlockedWindows(draft.date));
  }, [option, draft.date]);

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <PrimaryButton disabled={!draft.time} onClick={goNext}>
          {tCommon("next")}
        </PrimaryButton>
      }
    >
      {slots.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-white p-5 text-center text-sm text-stone-600">
          {t("noSlots")}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {slots.map((slot) => {
            const selected = draft.time === slot.time;
            return (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => setTime(slot.time)}
                aria-pressed={selected}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl border-2 px-2 py-2.5 text-sm transition-colors ${
                  !slot.available
                    ? "cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300 line-through"
                    : selected
                      ? "border-stone-900 bg-stone-900 font-medium text-stone-50"
                      : "border-stone-200 bg-white text-stone-800 hover:border-stone-400"
                }`}
              >
                {formatTimeLabel(slot.time, locale)}
              </button>
            );
          })}
        </div>
      )}
    </StepShell>
  );
}
