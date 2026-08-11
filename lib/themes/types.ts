/**
 * Theme metadata consumed by React for genuine LAYOUT differences (Hero,
 * SiteHeader). Color/radius/shadow/spacing/font differences are handled
 * entirely by CSS custom properties in app/globals.css, scoped per theme
 * via `[data-theme="<id>"]` — see that file for the actual token values.
 * This file only carries what components need to branch on structurally.
 */
export const THEME_IDS = [
  "jeju-forest",
  "jeju-resort",
  "korean-minimal",
  "modern-wellness",
  "dark-luxury",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type HeroVariant = "forest" | "resort" | "minimal" | "editorial" | "dark";
/**
 * "blurred" covers both Jeju Forest and Dark Luxury — same markup, and the
 * dark theme's inverted color tokens (see globals.css) turn the identical
 * translucent-blur classes dark automatically, so no separate variant is
 * needed there.
 */
export type HeaderVariant = "blurred" | "solid" | "minimal-line" | "editorial";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  heroVariant: HeroVariant;
  headerVariant: HeaderVariant;
  /** True for themes with a dark page background — lets components pick a matching scrim/overlay tone. */
  isDark: boolean;
}
