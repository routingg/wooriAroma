import { defineRouting } from "next-intl/routing";

/**
 * Supported customer-facing locales.
 * English is the source/default language — every other locale is
 * translated from `messages/en.json`.
 *
 * To add a language later (e.g. Indonesian, Thai, French, German):
 * 1. Add the locale code below.
 * 2. Add it to `localeNames` and `localeFlags` in i18n/config.ts.
 * 3. Add a `messages/<locale>.json` file.
 * No other architectural changes are required.
 */
export const locales = ["en", "ko", "zh", "ja"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: false,
});
