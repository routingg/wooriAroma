/**
 * Quick-action ids only — display label and the actual prompt sent to the
 * agent are deliberately kept apart in messages/*.json under
 * `aiAssistant.quickActions.<id>.{label,prompt}`, so nothing here is
 * hardcoded per language (AiBookingDialog resolves both via useTranslations).
 */
export const QUICK_ACTION_IDS = [
  "todayAvailability",
  "twoGuests",
  "recommend",
  "prices",
  "location",
  "duration",
] as const;

export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

/** Shown up front on mobile before "More questions" reveals the rest — keeps the initial screen short on small viewports (task spec §22). */
export const MOBILE_PRIMARY_QUICK_ACTION_COUNT = 4;
