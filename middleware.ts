import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
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
const intlMiddleware = createMiddleware(routing);

/**
 * Stopgap HTTP Basic Auth in front of the entire /admin dashboard, which
 * otherwise has no authentication at all (proposal.md §11 — "관리자 인증,
 * 배포 전 최우선 처리 필요"). Same fail-closed philosophy as
 * app/api/cron/reminders/route.ts's CRON_SECRET check: if the credentials
 * aren't configured, every request is refused rather than let through —
 * there is no NODE_ENV-based dev bypass, so local development requires
 * setting these too (see .env.example). This is a stopgap, not a real
 * admin-user system with per-user accounts/roles/audit trail — it's meant
 * to buy time until that's built.
 */
function checkAdminBasicAuth(request: NextRequest): boolean {
  const expectedUser = process.env.ADMIN_BASIC_AUTH_USER;
  const expectedPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return false;
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const providedUser = decoded.slice(0, separatorIndex);
  const providedPassword = decoded.slice(separatorIndex + 1);
  return providedUser === expectedUser && providedPassword === expectedPassword;
}

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Woori Aroma Admin"' },
  });
}

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return checkAdminBasicAuth(request) ? NextResponse.next() : unauthorizedResponse();
  }
  return intlMiddleware(request);
}

export const config = {
  // Run on every customer-facing route (for locale detection) and on
  // /admin (for the Basic Auth gate above), but skip /dev (dev-only
  // tooling, see app/dev/themes), API routes, Next.js internals and
  // static files.
  matcher: [
    "/((?!api|dev|_next|_vercel|.*\\..*).*)",
  ],
};
