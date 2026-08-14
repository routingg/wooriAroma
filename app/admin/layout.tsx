import type { ReactNode } from "react";
import "../globals.css";

/**
 * Every admin page reads live D1 state (today's reservations, pending
 * counts, blocked times, ...) — it must never be statically prerendered
 * with data baked in at build time. This also makes getCloudflareContext()
 * (see lib/db/client.ts) usable in its default sync mode: that call throws
 * if reached from a static route, since there's no per-request Cloudflare
 * context to read at prerender time.
 */
export const dynamic = "force-dynamic";

/**
 * Independent root layout for the future admin dashboard.
 * Deliberately outside app/[locale] and next-intl's routing — staff
 * are Korean-only and this area must never follow browser-language
 * detection. This file only proves the architecture divides cleanly;
 * the dashboard itself is out of scope for this task (see section 27).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col bg-stone-100 font-sans text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
