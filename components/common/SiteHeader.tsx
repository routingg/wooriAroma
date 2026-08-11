"use client";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language/LanguageSwitcher";
import { useTheme } from "@/components/theme/ThemeProvider";
import { THEMES } from "@/lib/themes/theme-config";

const HEADER_CLASS_BY_VARIANT: Record<string, string> = {
  blurred: "sticky top-0 z-40 border-b border-stone-200/70 bg-stone-50/90 backdrop-blur",
  solid: "sticky top-0 z-40 border-b border-stone-200 bg-stone-50",
  "minimal-line": "border-b border-stone-200",
  editorial: "border-b border-stone-300 bg-stone-100",
};

export function SiteHeader() {
  const { themeId } = useTheme();
  const headerClass = HEADER_CLASS_BY_VARIANT[THEMES[themeId].headerVariant];

  return (
    <header className={headerClass}>
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-heading)] text-lg font-semibold tracking-wide text-stone-900"
        >
          WOORI AROMA
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
