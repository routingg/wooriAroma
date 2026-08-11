import type { StaticImageData } from "next/image";
import exterior from "@/docs/images/woori-aroma-exterior-sunny-wide.jpg";
import treatmentRoom from "@/docs/images/woori-aroma-treatment-room-three-beds-close.jpg";
import backMassage from "@/docs/images/woori-aroma-back-massage.jpg";
import hotStoneMassage from "@/docs/images/woori-aroma-hot-stone-massage.jpg";
import shoulderNeckMassage from "@/docs/images/woori-aroma-shoulder-neck-massage.jpg";
import treatmentBedByWindow from "@/docs/images/woori-aroma-treatment-bed-by-window.jpg";
import treatmentRoomWarmLight from "@/docs/images/woori-aroma-treatment-room-warm-light.jpg";
import exteriorBacklit from "@/docs/images/woori-aroma-exterior-backlit.jpg";
import type { ThemeId } from "@/lib/themes/types";

/**
 * Real Woori Aroma interior/exterior photography (docs/images),
 * imported as static assets so Next.js can optimize, size and
 * blur-placeholder them. Centralized here rather than imported ad
 * hoc so every usage stays in sync if an asset is replaced.
 */
export const media = {
  exterior,
  treatmentRoom,
};

/** Hero image for the landing page. */
export const heroImage = media.treatmentRoom;

/**
 * One real photo per theme's hero (AGENTS §11: prioritize actual Woori
 * Aroma photography over stock/placeholders). Same booking data, same
 * copy — only the visual mood changes per skin.
 */
export const heroImageByTheme: Record<ThemeId, StaticImageData> = {
  "jeju-forest": treatmentRoom,
  "jeju-resort": exterior,
  "korean-minimal": treatmentBedByWindow,
  "modern-wellness": treatmentRoomWarmLight,
  "dark-luxury": exteriorBacklit,
};

/** Atmosphere image per service, for the treatment cards. */
export const serviceImages: Record<string, StaticImageData> = {
  "aroma-oil": backMassage,
  "hot-stone": hotStoneMassage,
  facial: shoulderNeckMassage,
};
