import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Work_Sans, Cormorant_Garamond, Playfair_Display, Inter, Fraunces } from "next/font/google";
import { routing, type AppLocale } from "@/i18n/routing";
import { localeHtmlLang } from "@/i18n/config";
import { SiteHeader } from "@/components/common/SiteHeader";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import "../globals.css";

// A warm humanist grotesk for body text — reads calmer and less
// "SaaS dashboard" than a geometric sans, while staying highly
// legible for international travelers.
const bodySans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

// Every heading typeface used by any theme is loaded once here, each under
// its own permanent CSS variable. Which one is actually used for headings
// is decided per theme by `--font-heading` in app/globals.css, not here —
// this keeps theme switching instant (no re-fetching fonts) since every
// face is already on the page.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: ["500", "600"],
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale subtree.
  setRequestLocale(locale);

  return (
    <html
      lang={localeHtmlLang[locale as AppLocale]}
      className={`${bodySans.variable} ${cormorant.variable} ${playfair.variable} ${inter.variable} ${fraunces.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-stone-50 font-sans text-stone-900 antialiased">
        <NextIntlClientProvider>
          <ThemeProvider>
            <SiteHeader />
            <div className="flex flex-1 flex-col">{children}</div>
            <ThemeSwitcher />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
