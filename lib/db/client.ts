import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Returns the D1 binding for this request. Workers isolates are
 * per-request, so unlike the old node:sqlite singleton this is cheap to
 * call repeatedly and must never be cached at module scope — always call
 * getDb() fresh at each call site rather than hoisting its result.
 */
export function getDb(): D1Database {
  const { env } = getCloudflareContext();
  return env.DB;
}
