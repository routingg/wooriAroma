import { beforeEach } from "vitest";
import { resetDbForTests } from "@/lib/db/client";

process.env.DATABASE_FILE = ":memory:";
process.env.BOOKING_HOLD_MINUTES = "10";

/** Call at the top of a test file to get a fresh in-memory database per test. */
export function setupFreshDb(): void {
  beforeEach(() => {
    resetDbForTests();
  });
}
