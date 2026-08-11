"use client";

import { useRouter } from "next/navigation";
import { THEME_LIST, THEME_STORAGE_KEY } from "@/lib/themes/theme-config";
import type { ThemeId } from "@/lib/themes/types";

function activate(id: ThemeId, router: ReturnType<typeof useRouter>) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Ignore storage failures — theme still applies this tab via the query below.
  }
  router.push("/en/book");
}

export function ThemesPreviewGrid() {
  const router = useRouter();

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {THEME_LIST.map((theme) => (
        <div
          key={theme.id}
          data-theme={theme.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-stone-300 bg-stone-50 shadow-md"
        >
          <div className="flex h-28 items-end gap-1 p-3">
            <span className="h-10 w-10 rounded-[var(--radius-2xl)] bg-stone-900" />
            <span className="h-10 w-10 rounded-[var(--radius-2xl)] bg-stone-500" />
            <span className="h-10 w-10 rounded-[var(--radius-2xl)] bg-stone-200" />
            <span className="h-10 w-10 rounded-[var(--radius-2xl)] bg-forest-500" />
          </div>
          <div className="flex flex-1 flex-col gap-3 bg-stone-50 p-5">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-stone-900">
                {theme.name}
              </h2>
              <p className="mt-1 text-sm text-stone-600">{theme.description}</p>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-stone-200 bg-stone-100 p-3 text-sm text-stone-700 shadow-[var(--shadow-sm)]">
              Sample card — {theme.heroVariant} hero, {theme.headerVariant} header
            </div>

            <button
              type="button"
              onClick={() => activate(theme.id, router)}
              className="mt-auto inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-stone-900 px-5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
            >
              Activate &amp; view booking site
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
