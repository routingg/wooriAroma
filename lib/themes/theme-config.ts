import type { ThemeConfig, ThemeId } from "./types";

export const DEFAULT_THEME: ThemeId = "jeju-forest";
export const THEME_STORAGE_KEY = "woori-aroma-theme";

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "jeju-forest": {
    id: "jeju-forest",
    name: "Jeju Forest",
    description: "Warm hinoki wood and forest calm — the primary brand direction.",
    heroVariant: "forest",
    headerVariant: "blurred",
    isDark: false,
  },
  "jeju-resort": {
    id: "jeju-resort",
    name: "Jeju Resort",
    description: "Ivory, sand and ocean blue — a boutique resort spa mood.",
    heroVariant: "resort",
    headerVariant: "solid",
    isDark: false,
  },
  "korean-minimal": {
    id: "korean-minimal",
    name: "Korean Minimal",
    description: "Restrained modern Korean minimalism — stone, wood, quiet geometry.",
    heroVariant: "minimal",
    headerVariant: "minimal-line",
    isDark: false,
  },
  "modern-wellness": {
    id: "modern-wellness",
    name: "Modern Wellness",
    description: "Editorial international wellness-brand direction.",
    heroVariant: "editorial",
    headerVariant: "editorial",
    isDark: false,
  },
  "dark-luxury": {
    id: "dark-luxury",
    name: "Dark Luxury",
    description: "Intimate, private night-spa atmosphere with a muted gold accent.",
    heroVariant: "dark",
    headerVariant: "blurred",
    isDark: true,
  },
};

export const THEME_LIST = Object.values(THEMES);
