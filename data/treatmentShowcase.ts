/**
 * Landing-page-only presentation data for the "/" Treatment section.
 *
 * This intentionally does NOT touch `data/services.ts` (the shared
 * source of truth for booking-flow order/pricing/`recommended` flags —
 * changing those would also change the booking step UI). Prices and
 * durations are still looked up live from `data/services.ts` via
 * `optionId`, so there is no duplicated/divergent pricing; this file
 * only adds marketing copy structure and the fixed landing display
 * order.
 */
export interface TreatmentShowcaseOption {
  /** Matches a `ServiceOption.id` in data/services.ts. */
  optionId: string;
  /** Landing-only "Most Popular" flag — independent of ServiceOption.recommended. */
  mostPopular?: boolean;
}

export interface TreatmentShowcaseItem {
  /** Matches a `Service.id` in data/services.ts. */
  serviceId: string;
  /** Key into the `treatmentShowcase` i18n namespace. */
  translationKey: string;
  /** English alt text for the treatment image (accessibility). */
  imageAlt: string;
  /** Whether `${translationKey}.tagline` is populated in messages/*.json. */
  hasTagline?: boolean;
  /** Whether `${translationKey}.everyCourseIncludes` is populated in messages/*.json. */
  hasEveryCourseIncludes?: boolean;
  /** Duration/price rows, in display order. */
  options: TreatmentShowcaseOption[];
}

/** Fixed display order for the "/" Treatment section (AGENTS.md §1). */
export const treatmentShowcase: TreatmentShowcaseItem[] = [
  {
    serviceId: "aroma-oil",
    translationKey: "aromaOil",
    imageAlt: "Aroma oil massage treatment at Woori Aroma Jeju",
    hasTagline: true,
    hasEveryCourseIncludes: true,
    options: [
      { optionId: "aroma-oil-60" },
      { optionId: "aroma-oil-90", mostPopular: true },
      { optionId: "aroma-oil-120" },
    ],
  },
  {
    serviceId: "hot-stone",
    translationKey: "hotStone",
    imageAlt: "Hot stone massage treatment at Woori Aroma Jeju",
    hasTagline: true,
    hasEveryCourseIncludes: true,
    options: [
      { optionId: "hot-stone-60" },
      { optionId: "hot-stone-90" },
      { optionId: "hot-stone-120", mostPopular: true },
    ],
  },
  {
    serviceId: "thai-massage",
    translationKey: "thaiMassage",
    imageAlt: "Traditional Thai massage treatment at Woori Aroma Jeju",
    hasTagline: true,
    options: [
      { optionId: "thai-massage-60" },
      { optionId: "thai-massage-90" },
      { optionId: "thai-massage-120" },
    ],
  },
  {
    serviceId: "quick-spa-foot",
    translationKey: "quickSpaFoot",
    imageAlt: "Foot spa and foot massage treatment at Woori Aroma Jeju",
    options: [{ optionId: "quick-spa-foot-50" }],
  },
  {
    serviceId: "facial",
    translationKey: "facial",
    imageAlt: "Facial spa and skin care treatment at Woori Aroma Jeju",
    options: [{ optionId: "facial-60" }],
  },
];
