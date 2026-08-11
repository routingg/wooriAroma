import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on every customer-facing route, but skip /admin (Korean-only,
  // not part of the locale-detection architecture), /dev (dev-only
  // tooling, see app/dev/themes), API routes, Next.js internals and
  // static files.
  matcher: [
    "/((?!api|admin|dev|_next|_vercel|.*\\..*).*)",
  ],
};
