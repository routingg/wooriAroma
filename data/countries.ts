/**
 * ISO 3166-1 alpha-2 codes for the countries Woori Aroma's guests
 * most commonly travel from. Display names are localized at render
 * time via `Intl.DisplayNames` (see lib/booking/countries.ts) rather
 * than being translated by hand, so this list needs no i18n upkeep.
 */
export const countryCodes = [
  "KR", "CN", "JP", "TW", "HK", "SG", "TH", "VN", "MY", "ID", "PH",
  "US", "CA", "GB", "AU", "NZ", "DE", "FR", "IT", "ES", "NL",
  "AE", "IN", "OTHER",
] as const;
