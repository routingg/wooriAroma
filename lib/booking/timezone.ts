/**
 * Woori Aroma operates in Jeju, so "today" and "past time" must
 * always be evaluated in Asia/Seoul wall-clock time — never the
 * customer's device timezone or the server/deployment runtime's
 * local timezone.
 *
 * `Date` objects represent an absolute instant regardless of where
 * the code runs; `Intl.DateTimeFormat` with an explicit `timeZone`
 * correctly derives Seoul's wall-clock date/time from that instant,
 * so no timezone library is needed.
 */
export const SEOUL_TIME_ZONE = "Asia/Seoul";

export interface SeoulNow {
  /** "YYYY-MM-DD" in Asia/Seoul. */
  dateKey: string;
  /** Minutes since midnight, Asia/Seoul wall-clock. */
  minutes: number;
}

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getSeoulNow(instant: Date = new Date()): SeoulNow {
  const parts = seoulFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";

  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** True if `dateKey` is strictly before Asia/Seoul's current date. */
export function isDateKeyPast(dateKey: string, now: SeoulNow = getSeoulNow()): boolean {
  return dateKey < now.dateKey;
}

export function isDateKeyToday(dateKey: string, now: SeoulNow = getSeoulNow()): boolean {
  return dateKey === now.dateKey;
}
