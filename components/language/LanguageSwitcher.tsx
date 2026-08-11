"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { localeNames } from "@/i18n/config";
import { useOnClickOutside } from "@/lib/useOnClickOutside";

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("language");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(containerRef, () => setOpen(false));

  function selectLocale(nextLocale: AppLocale) {
    setOpen(false);
    if (nextLocale === locale) return;
    // Switching locale preserves the current path (e.g. /book) so the
    // booking wizard stays put; BookingProvider rehydrates the draft
    // from localStorage, so guest/treatment/date selections survive.
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("label")}
        className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100/80 px-3 py-2 text-sm text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900"
      >
        <span aria-hidden="true" className="text-xs">🌐</span>
        <span>{localeNames[locale]}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 py-1 shadow-lg"
        >
          {routing.locales.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                onClick={() => selectLocale(code)}
                className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors hover:bg-stone-50 ${
                  code === locale ? "font-medium text-stone-900" : "text-stone-600"
                }`}
              >
                {localeNames[code]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
