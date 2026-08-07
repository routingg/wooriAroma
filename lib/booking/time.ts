/** Minimal "HH:mm" arithmetic helpers, kept free of Date/timezone concerns. */

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export interface TimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

/** Locale-natural time display, e.g. "4:00 PM" (en) or "16:00" (ja/zh). */
export function formatTimeLabel(hhmm: string, locale: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const reference = new Date(2024, 0, 1, h, m);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(reference);
}
