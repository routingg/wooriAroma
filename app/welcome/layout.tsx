import type { ReactNode } from "react";
import { Work_Sans, Cormorant_Garamond } from "next/font/google";
import "../globals.css";

// Same CSS variable names app/[locale]/layout.tsx uses for these two
// faces, so the Jeju Forest theme tokens already in globals.css
// (--font-sans -> --font-work-sans, --font-heading -> --font-cormorant)
// resolve correctly here too, with no separate font block to keep in sync.
const bodySans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

/**
 * Standalone root layout for the in-store guest kiosk (/welcome) — outside
 * app/[locale] and next-intl's routing, same pattern as admin/layout.tsx
 * and dev/layout.tsx. This screen is bilingual (EN + KO together, run by
 * staff on a tablet) rather than locale-switched, so it doesn't belong in
 * the [locale] tree.
 */
export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bodySans.variable} ${cormorant.variable} h-full`}>
      <body className="h-full overflow-hidden overscroll-none bg-stone-900 font-sans antialiased">{children}</body>
    </html>
  );
}
