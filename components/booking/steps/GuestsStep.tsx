"use client";

import { useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";

const MAX_GUESTS = 4;

export function GuestsStep() {
  const t = useTranslations("steps.guests");
  const tCommon = useTranslations("common");
  const { draft, setGuestCount, goNext } = useBooking();

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      showBack={false}
      footer={
        <PrimaryButton disabled={!draft.guestCount} onClick={goNext}>
          {tCommon("next")}
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((count) => {
          const selected = draft.guestCount === count;
          return (
            <button
              key={count}
              type="button"
              onClick={() => setGuestCount(count)}
              aria-pressed={selected}
              className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 px-4 py-5 text-center transition-colors ${
                selected
                  ? "border-stone-900 bg-stone-900 text-stone-50"
                  : "border-stone-200 bg-stone-100 text-stone-800 hover:border-stone-400"
              }`}
            >
              <span className="text-lg font-medium">{t("option", { count })}</span>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
