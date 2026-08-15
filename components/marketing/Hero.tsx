"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useTheme } from "@/components/theme/ThemeProvider";
import { THEMES } from "@/lib/themes/theme-config";
import { heroImagesByTheme } from "@/data/media";
import { HeroSlideshow } from "@/components/marketing/HeroSlideshow";
import { AiBookingButton } from "@/components/ai-booking/AiBookingButton";

/**
 * The one genuine layout variant in the theme system (AGENTS §20's own
 * <Hero variant="editorial"/> suggestion) — everything else (color, radius,
 * shadow, spacing, font) is handled by CSS tokens in app/globals.css with
 * zero component changes. Booking copy/CTA target are identical across
 * variants; only composition changes.
 */
export function Hero() {
  const t = useTranslations("landing");
  const { themeId } = useTheme();
  const heroVariant = THEMES[themeId].heroVariant;
  const images = heroImagesByTheme[themeId];

  const kicker = <p className="text-xs font-medium tracking-[0.3em] uppercase">{t("kicker")}</p>;
  const brand = (
    <h1 className="font-[family-name:var(--font-heading)] font-semibold tracking-tight">{t("brand")}</h1>
  );
  const heroLines = (
    <p className="text-balance leading-relaxed">
      {t("heroLine1")}
      <br />
      {t("heroLine2")}
    </p>
  );
  const tagline = (
    <p className="font-[family-name:var(--font-heading)] font-semibold">
      {t("tagline")} <span className="font-sans text-sm font-normal opacity-80">{t("capacity")}</span>
    </p>
  );
  const cta = (label: string, className: string) => (
    <Link href="/book" className={className}>
      {label}
    </Link>
  );

  if (heroVariant === "minimal") {
    // Korean Minimal: quiet, text-forward, image contained rather than full-bleed.
    return (
      <section className="flex flex-col gap-10 px-6 pt-20 pb-16 sm:px-10 sm:pt-28">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-5 text-stone-900">
          <div className="text-stone-500">{kicker}</div>
          <div className="text-4xl sm:text-6xl">{brand}</div>
          <div className="max-w-md text-lg text-stone-600 sm:text-xl">{heroLines}</div>
          <div className="text-xl text-stone-900">{tagline}</div>
          {cta(
            t("cta"),
            "mt-2 inline-flex min-h-14 w-full max-w-xs items-center justify-center rounded-[var(--radius-button)] border border-stone-900 px-8 text-base font-medium text-stone-900 transition-colors hover:bg-stone-900 hover:text-stone-50 sm:w-auto",
          )}
          <AiBookingButton tone="light" />
        </div>
        <div className="relative mx-auto aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-[var(--radius-2xl)]">
          <HeroSlideshow
            key={themeId}
            images={images}
            alt=""
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        </div>
      </section>
    );
  }

  if (heroVariant === "editorial") {
    // Modern Wellness: asymmetric editorial split — image and text side by side.
    return (
      <section className="grid gap-0 sm:grid-cols-[1.2fr_1fr]">
        <div className="relative min-h-[45vh] sm:min-h-[80vh]">
          <HeroSlideshow
            key={themeId}
            images={images}
            alt=""
            sizes="(min-width: 640px) 55vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center gap-6 bg-stone-100 px-6 py-16 text-stone-900 sm:px-12">
          <div className="text-stone-500">{kicker}</div>
          <div className="text-4xl sm:text-5xl">{brand}</div>
          <div className="max-w-sm text-stone-600">{heroLines}</div>
          <div className="text-lg">{tagline}</div>
          {cta(
            t("cta"),
            "mt-2 inline-flex min-h-14 w-full max-w-xs items-center justify-center rounded-[var(--radius-button)] bg-stone-900 px-8 text-base font-medium text-stone-50 transition-colors hover:bg-stone-800",
          )}
          <AiBookingButton tone="light" />
        </div>
      </section>
    );
  }

  if (heroVariant === "dark") {
    // Dark Luxury: moody full-bleed, gold-accented CTA used sparingly.
    return (
      <section className="relative flex min-h-[80svh] items-center justify-center overflow-hidden sm:min-h-[80vh]">
        <HeroSlideshow key={themeId} images={images} alt="" sizes="100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-stone-50/85" />
        <div className="relative flex w-full flex-col items-center px-6 text-center text-stone-900">
          <div className="text-stone-600">{kicker}</div>
          <div className="mt-4 text-5xl sm:text-7xl">{brand}</div>
          <div aria-hidden="true" className="mt-5 h-px w-16 bg-forest-500" />
          <div className="mt-5 max-w-md text-stone-700">{heroLines}</div>
          <div className="mt-6 text-xl">{tagline}</div>
          {cta(
            t("cta"),
            "mt-8 inline-flex min-h-14 w-full max-w-xs items-center justify-center rounded-[var(--radius-button)] bg-forest-500 px-8 text-base font-medium text-stone-50 shadow-lg transition-colors hover:bg-forest-600 sm:w-auto",
          )}
          <AiBookingButton tone="light" />
        </div>
      </section>
    );
  }

  if (heroVariant === "resort") {
    // Jeju Resort: full-bleed, centered composition, generous vertical room.
    return (
      <section className="relative flex min-h-[85svh] items-center justify-center overflow-hidden sm:min-h-[85vh]">
        <HeroSlideshow key={themeId} images={images} alt="" sizes="100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-stone-900/45" />
        <div className="relative flex w-full flex-col items-center px-6 text-center text-stone-50">
          <div className="opacity-90">{kicker}</div>
          <div className="mt-5 text-5xl sm:text-7xl">{brand}</div>
          <div className="mt-6 max-w-lg opacity-95">{heroLines}</div>
          <div className="mt-6 text-xl">{tagline}</div>
          {cta(
            t("cta"),
            "mt-9 inline-flex min-h-14 w-full max-w-xs items-center justify-center rounded-[var(--radius-button)] bg-stone-50 px-8 text-base font-medium text-stone-900 shadow-lg transition-colors hover:bg-stone-100 sm:w-auto",
          )}
          <AiBookingButton tone="dark" />
        </div>
      </section>
    );
  }

  // "forest" — the original, highest-polish default: bottom-anchored, warm scrim.
  return (
    <section className="relative flex min-h-[80svh] items-end overflow-hidden sm:min-h-[80vh]">
      <HeroSlideshow
        key={themeId}
        images={images}
        alt=""
        sizes="100vw"
        className="object-cover object-[center_75%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-stone-900/85 via-stone-900/35 to-stone-900/10"
      />
      <div className="relative w-full px-6 pt-24 pb-12 sm:px-10 sm:pb-16">
        <div className="mx-auto max-w-3xl text-stone-100">
          <div className="opacity-80">{kicker}</div>
          <div className="mt-4 text-4xl text-stone-50 sm:text-6xl">{brand}</div>
          <div className="mt-6 max-w-md text-lg sm:text-xl">{heroLines}</div>
          <div className="mt-5 text-xl text-stone-50">{tagline}</div>
          {/* Wrapped in its own block (unlike the flex-col hero variants above) so the secondary AI CTA stacks under the primary one instead of sharing its inline-flex line. */}
          <div className="flex flex-col items-start">
            {cta(
              t("cta"),
              "mt-8 inline-flex min-h-14 w-full max-w-xs items-center justify-center rounded-[var(--radius-button)] bg-stone-50 px-8 text-base font-medium text-stone-900 shadow-lg shadow-stone-900/20 transition-colors hover:bg-stone-100 sm:w-auto",
            )}
            <AiBookingButton tone="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}
