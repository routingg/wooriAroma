"use client";

import { useRef, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { THEME_LIST } from "@/lib/themes/theme-config";
import { useOnClickOutside } from "@/lib/useOnClickOutside";

/**
 * Floating dev/comparison control (AGENTS §5 of the theming brief) — not a
 * customer-facing feature. Instant, no reload; independent of booking
 * state entirely (see ThemeProvider).
 */
export function ThemeSwitcher() {
  const { themeId, setThemeId, isHydrated } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(containerRef, () => setOpen(false));

  if (!isHydrated) return null;

  return (
    // bottom-24 (not bottom-4) clears StepShell's fixed full-width footer
    // button during the booking wizard — a plain bottom-4 corner placement
    // overlaps the primary CTA's tap target on mobile.
    <div ref={containerRef} className="fixed right-4 bottom-24 z-[60] sm:right-5">
      {open ? (
        <div className="mb-3 w-64 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-lg">
          <p className="border-b border-stone-200 px-4 py-3 text-xs font-medium tracking-wide text-stone-500 uppercase">
            Theme
          </p>
          <ul>
            {THEME_LIST.map((theme) => (
              <li key={theme.id}>
                <button
                  type="button"
                  onClick={() => {
                    setThemeId(theme.id);
                    setOpen(false);
                  }}
                  aria-pressed={theme.id === themeId}
                  className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-stone-50 ${
                    theme.id === themeId ? "bg-stone-50 font-medium text-stone-900" : "text-stone-700"
                  }`}
                >
                  <span>{theme.name}</span>
                  <span className="text-xs font-normal text-stone-400">{theme.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch design theme"
        aria-expanded={open}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-lg shadow-lg transition-transform hover:scale-105"
      >
        🎨
      </button>
    </div>
  );
}
