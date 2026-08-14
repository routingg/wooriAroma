import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, vi } from "vitest";
import { FakeD1Database } from "./fakeD1";

process.env.BOOKING_HOLD_MINUTES = "10";

const migrationsDir = join(process.cwd(), "migrations");
const migrationScripts = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf-8"));

let currentDb: FakeD1Database | undefined;

// Repository code reaches the D1 binding via getCloudflareContext().env.DB
// (see lib/db/client.ts) — this stub hands out a fresh in-memory fake D1
// per test instead of a real Cloudflare Workers context. ctx.waitUntil()
// just lets the fire-and-forget notification promise run; nothing in this
// test suite asserts on those side effects, so it doesn't need to be
// tracked/awaited.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (!currentDb) {
      throw new Error("getCloudflareContext() called before setupFreshDb()'s beforeEach ran");
    }
    return {
      env: { DB: currentDb },
      cf: undefined,
      ctx: {
        waitUntil: (promise: Promise<unknown>) => {
          void promise.catch(() => {});
        },
        passThroughOnException: () => {},
      },
    };
  },
  initOpenNextCloudflareForDev: () => {},
}));

/** Call at the top of a test file to get a fresh in-memory D1-shaped database per test. */
export function setupFreshDb(): void {
  beforeEach(() => {
    const db = new FakeD1Database();
    for (const script of migrationScripts) {
      db.applyMigrationScript(script);
    }
    currentDb = db;
  });
}
