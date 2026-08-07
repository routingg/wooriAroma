"use client";

import { useTranslations } from "next-intl";
import type { BookingStep } from "@/types/bookingState";

// The 9 internal wizard steps map onto 5 customer-facing progress
// labels, per the "minimal, not visually heavy" requirement.
const PROGRESS_GROUPS: { key: string; steps: BookingStep[] }[] = [
  { key: "guests", steps: ["guests"] },
  { key: "treatment", steps: ["treatment", "duration"] },
  { key: "dateTime", steps: ["date", "time"] },
  { key: "details", steps: ["details"] },
  { key: "confirm", steps: ["review", "payment", "confirmation"] },
];

export function BookingProgress({ currentStep }: { currentStep: BookingStep }) {
  const t = useTranslations("progress");
  const activeGroupIndex = PROGRESS_GROUPS.findIndex((g) => g.steps.includes(currentStep));

  return (
    <nav aria-label={t("guests")} className="w-full">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {PROGRESS_GROUPS.map((group, index) => {
          const state =
            index < activeGroupIndex ? "done" : index === activeGroupIndex ? "active" : "upcoming";
          return (
            <li key={group.key} className="flex flex-1 items-center gap-1.5 sm:gap-2">
              <div
                aria-current={state === "active" ? "step" : undefined}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  state === "upcoming" ? "bg-stone-200" : "bg-stone-800"
                }`}
              />
              <span
                className={`hidden text-xs whitespace-nowrap sm:inline ${
                  state === "active" ? "font-medium text-stone-900" : "text-stone-400"
                }`}
              >
                {t(group.key)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
