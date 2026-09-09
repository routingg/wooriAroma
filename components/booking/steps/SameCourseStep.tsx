"use client";

import { useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";

export function SameCourseStep() {
  const t = useTranslations("steps.sameCourse");
  const { draft, setSameCourse, goNext } = useBooking();

  function choose(sameCourse: boolean) {
    setSameCourse(sameCourse);
    goNext();
  }

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")}>
      <div className="flex flex-col gap-3">
        {(
          [
            { value: true, label: t("same") },
            { value: false, label: t("different") },
          ] as const
        ).map(({ value, label }) => {
          const selected = draft.sameCourse === value;
          return (
            <button
              key={String(value)}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={selected}
              className={`flex min-h-16 items-center rounded-2xl border-2 px-5 py-4 text-left text-base font-medium transition-colors ${
                selected
                  ? "border-stone-900 bg-stone-900 text-stone-50"
                  : "border-stone-200 bg-stone-100 text-stone-800 hover:border-stone-400"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
