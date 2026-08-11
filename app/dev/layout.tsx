import type { ReactNode } from "react";
import "../globals.css";

/**
 * Standalone root layout for /dev/* tooling — outside [locale] and /admin,
 * same pattern as admin/layout.tsx. Needs its own <html>/<body> since it's
 * a separate top-level route segment. See app/dev/themes/page.tsx, which
 * gates itself out of production builds.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-stone-100 font-sans antialiased">{children}</body>
    </html>
  );
}
