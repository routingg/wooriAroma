import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Deliberately named middleware.ts, not Next.js 16's renamed proxy.ts:
 * proxy.ts always runs on the Node.js runtime with no edge opt-out, and
 * @opennextjs/cloudflare (as of 1.20.2) fails the build on that
 * ("Node.js middleware is not currently supported") — see
 * https://github.com/cloudflare/workers-sdk/issues/13755. Next 16 still
 * runs middleware.ts as a deprecated-but-functional back-compat alias for
 * the same feature, and OpenNext's build tooling doesn't apply the
 * proxy.ts check to it. Revisit once OpenNext adds Node.js middleware
 * support and switch back to proxy.ts then.
 */
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
