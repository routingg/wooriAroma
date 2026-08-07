"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { formatMonthYear, getMonthGrid, getWeekdayLabels, toDateKey } from "@/lib/booking/calendar";
import { getSeoulNow } from "@/lib/booking/timezone";

export function Calendar({
  selectedDateKey,
  onSelect,
}: {
  selectedDateKey: string | null;
  onSelect: (dateKey: string) => void;
}) {
  const locale = useLocale();
  // "Today" is always Asia/Seoul's today — a tourist browsing from
  // another timezone must see Jeju's calendar, not their device's.
  const todayKey = getSeoulNow().dateKey;
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(todayYear, todayMonth - 1, 1));

  const weeks = getMonthGrid(visibleMonth.getFullYear(), visibleMonth.getMonth());
  const weekdayLabels = getWeekdayLabels(locale);
  const isCurrentMonth =
    visibleMonth.getFullYear() === todayYear && visibleMonth.getMonth() === todayMonth - 1;

  function goToPreviousMonth() {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goToPreviousMonth}
          disabled={isCurrentMonth}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-100 disabled:invisible"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
            <path d="M12.5 4l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-sm font-medium text-stone-900">{formatMonthYear(visibleMonth, locale)}</p>
        <button
          type="button"
          onClick={goToNextMonth}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-100"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
            <path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-stone-400">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flatMap((week, weekIndex) =>
          week.map((date, dayIndex) => {
            if (!date) return <div key={`${weekIndex}-${dayIndex}`} />;

            const dateKey = toDateKey(date);
            const isPast = dateKey < todayKey;
            const isToday = dateKey === todayKey;
            const isSelected = selectedDateKey === dateKey;

            return (
              <button
                key={dateKey}
                type="button"
                disabled={isPast}
                onClick={() => onSelect(dateKey)}
                aria-current={isSelected ? "date" : undefined}
                className={`flex aspect-square min-h-11 items-center justify-center rounded-full text-sm transition-colors ${
                  isPast
                    ? "cursor-not-allowed text-stone-300"
                    : isSelected
                      ? "bg-stone-900 font-medium text-stone-50"
                      : isToday
                        ? "border border-stone-400 text-stone-900 hover:bg-stone-100"
                        : "text-stone-800 hover:bg-stone-100"
                }`}
              >
                {date.getDate()}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
