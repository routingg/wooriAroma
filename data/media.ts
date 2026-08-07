import type { StaticImageData } from "next/image";
import exterior from "@/docs/images/woori-aroma-exterior.jpg";
import treatmentRoom1 from "@/docs/images/woori-aroma-treatment-room-1.jpg";
import treatmentRoom2 from "@/docs/images/woori-aroma-treatment-room-2.jpg";
import footbath from "@/docs/images/woori-aroma-footbath.jpg";
import reception from "@/docs/images/woori-aroma-reception.jpg";

/**
 * Real Woori Aroma interior/exterior photography (docs/images),
 * imported as static assets so Next.js can optimize, size and
 * blur-placeholder them. Centralized here rather than imported ad
 * hoc so every usage stays in sync if an asset is replaced.
 */
export const media = {
  exterior,
  treatmentRoom1,
  treatmentRoom2,
  footbath,
  reception,
};

/** Hero image for the landing page. */
export const heroImage = media.treatmentRoom1;

/** Atmosphere image per service, for the treatment cards. */
export const serviceImages: Record<string, StaticImageData> = {
  "aroma-oil": media.treatmentRoom2,
  "hot-stone": media.treatmentRoom1,
  facial: media.footbath,
};
