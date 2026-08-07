import type { AppLocale } from "./routing";

/** Native-script label shown inside the language switcher. */
export const localeNames: Record<AppLocale, string> = {
  en: "English",
  ko: "한국어",
  zh: "中文",
  ja: "日本語",
};

/** BCP 47 tag used for <html lang> and hreflang metadata. */
export const localeHtmlLang: Record<AppLocale, string> = {
  en: "en",
  ko: "ko",
  zh: "zh-CN",
  ja: "ja",
};

/**
 * The cookie the customer's *communication* language preference
 * (Preferred Language on the details step) is stored under.
 * Deliberately separate from the `NEXT_LOCALE` cookie next-intl uses
 * for the website UI locale — a guest may browse in English but
 * request Japanese communication.
 */
export const PREFERRED_LANGUAGE_COOKIE = "wa_preferred_language";
