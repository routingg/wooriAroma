"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from "@/lib/themes/theme-config";
import type { ThemeId } from "@/lib/themes/types";

interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  isHydrated: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw && raw in THEMES ? (raw as ThemeId) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Purely presentational state — completely independent of BookingProvider's
 * localStorage draft, so switching themes can never affect booking
 * progress. Sets `data-theme` on <html>; app/globals.css does the rest via
 * CSS custom properties (see the [data-theme="..."] blocks there).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [isHydrated, setIsHydrated] = useState(false);

  // One-time sync from localStorage after mount, same pattern as
  // BookingProvider — avoids a server/client hydration mismatch since the
  // stored preference can only be read in the browser.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeIdState(loadStoredTheme());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Ignore storage failures (private browsing, quota) — the theme
      // still applies for this session, it just won't persist.
    }
  }, []);

  return <ThemeContext.Provider value={{ themeId, setThemeId, isHydrated }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
