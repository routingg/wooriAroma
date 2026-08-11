"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { getServiceOption } from "@/data/services";
import { formatTimeLabel } from "@/lib/booking/time";
import type { TimeSlot } from "@/types/booking";

type LoadState = "loading" | "error" | "ready";

export function TimeStep() {
  const t = useTranslations("steps.time");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { draft, setTime, goNext } = useBooking();

  const option = draft.serviceOptionId ? getServiceOption(draft.serviceOptionId) : undefined;

  const [state, setState] = useState<LoadState>("loading");
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  const loadSlots = useCallback(async () => {
    if (!option || !draft.date) return;
    setState("loading");
    try {
      const params = new URLSearchParams({ date: draft.date, serviceOptionId: option.id });
      const res = await fetch(`/api/availability?${params.toString()}`);
      if (!res.ok) throw new Error(`availability request failed: ${res.status}`);
      const body = (await res.json()) as { slots: TimeSlot[] };
      setSlots(body.slots);
      setState("ready");
    } catch {
      // Never show the previously requested time as available on failure —
      // an explicit error/retry state instead of guessing (AGENTS.md §5.4, T12).
      setSlots([]);
      setState("error");
    }
  }, [option, draft.date]);

  useEffect(() => {
    // Data fetch from an external system (the availability API), not a
    // derived-state calculation — the standard exception to
    // react-hooks/set-state-in-effect, same as BookingProvider's hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSlots();
  }, [loadSlots]);

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <PrimaryButton disabled={!draft.time || state !== "ready"} onClick={goNext}>
          {tCommon("next")}
        </PrimaryButton>
      }
    >
      {state === "loading" ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-stone-100 p-8 text-sm text-stone-600">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900"
          />
          {t("loading")}
        </div>
      ) : state === "error" ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-stone-100 p-6 text-center">
          <p className="text-sm text-red-500">{t("loadError")}</p>
          <button
            type="button"
            onClick={() => void loadSlots()}
            className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-100"
          >
            {t("retry")}
          </button>
        </div>
      ) : slots.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-stone-100 p-5 text-center text-sm text-stone-600">
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
                      : "border-stone-200 bg-stone-100 text-stone-800 hover:border-stone-400"
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
