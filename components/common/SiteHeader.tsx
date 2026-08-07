import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language/LanguageSwitcher";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-stone-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide text-stone-900"
        >
          WOORI AROMA
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
