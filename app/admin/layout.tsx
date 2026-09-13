import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { listAll } from "@/lib/repositories/reservationRepository";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
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
 * Independent root layout for the admin dashboard. Deliberately outside
 * app/[locale] and next-intl's routing — staff are Korean-only and this
 * area must never follow browser-language detection. Renders the
 * persistent AdminSidebar so every admin page shares the same
 * cross-navigation instead of only linking back to /admin one hop at a time.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const pending = await listAll(["PENDING"]);

  return (
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col bg-stone-100 font-sans text-stone-900 antialiased md:flex-row">
        <AdminSidebar pendingCount={pending.length} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
