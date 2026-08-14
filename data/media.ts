import type { StaticImageData } from "next/image";
import exterior from "@/docs/images/woori-aroma-exterior-sunny-wide.jpg";
import treatmentRoom from "@/docs/images/woori-aroma-treatment-room-three-beds-close.jpg";
import aromaMassage from "@/docs/images/aroma-massage.jpg";
import hotStoneMassage from "@/docs/images/woori-aroma-hot-stone-massage.jpg";
import thaiMassage from "@/docs/images/thai-massage.jpg";
import floralFootSpa from "@/docs/images/woori-aroma-floral-foot-spa.jpg";
import facialMassage from "@/docs/images/facial-massage.jpg";
import treatmentBedByWindow from "@/docs/images/woori-aroma-treatment-bed-by-window.jpg";
import treatmentRoomWarmLight from "@/docs/images/woori-aroma-treatment-room-warm-light.jpg";
import exteriorBacklit from "@/docs/images/woori-aroma-exterior-backlit.jpg";
import exteriorFrontEntrance from "@/docs/images/woori-aroma-exterior-front-entrance.jpg";
import treatmentRoomThreeBeds from "@/docs/images/woori-aroma-treatment-room-three-beds.jpg";
import treatmentBedFront from "@/docs/images/woori-aroma-treatment-bed-front.jpg";
import exteriorCornerWide from "@/docs/images/woori-aroma-exterior-corner-wide.jpg";
import exteriorRainyWalkway from "@/docs/images/woori-aroma-exterior-rainy-walkway.jpg";
import exteriorDeckGarden from "@/docs/images/woori-aroma-exterior-deck-garden.jpg";
import treatmentBedTopView from "@/docs/images/woori-aroma-treatment-bed-top-view.jpg";
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
 * Real photos per theme's hero, cycled as a slideshow that alternates
 * store exterior and interior shots (AGENTS §11: prioritize actual
 * Woori Aroma photography over stock/placeholders). Same booking data,
 * same copy — only the visual mood changes per skin. Each list starts
 * with the theme's original single hero image so first paint is
 * unchanged; the rest alternate interior/exterior to match that
 * theme's mood.
 */
export const heroImagesByTheme: Record<ThemeId, StaticImageData[]> = {
  "jeju-forest": [treatmentRoom, exteriorFrontEntrance, treatmentRoomThreeBeds],
  "jeju-resort": [exterior, treatmentBedFront, exteriorCornerWide],
  "korean-minimal": [treatmentBedByWindow, exteriorRainyWalkway],
  "modern-wellness": [treatmentRoomWarmLight, exteriorDeckGarden],
  "dark-luxury": [exteriorBacklit, treatmentBedTopView],
};

/** Atmosphere image per service, for the treatment cards. */
export const serviceImages: Record<string, StaticImageData> = {
  "aroma-oil": aromaMassage,
  "hot-stone": hotStoneMassage,
  "thai-massage": thaiMassage,
  "quick-spa-foot": floralFootSpa,
  facial: facialMassage,
};
