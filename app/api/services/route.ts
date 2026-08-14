import { NextResponse } from "next/server";
import { getBookableServices } from "@/data/services";

/**
 * Read-only service catalog. Backed by data/services.ts, not the database —
 * see migrations/0001_init.sql for why the catalog isn't duplicated into a
 * `services` table. Exists mainly for API consistency and the future Gemini
 * agent tool layer (lib/agent/tools.ts); the booking wizard itself imports
 * data/services.ts directly since it's static, bundled data.
 */
export async function GET() {
  return NextResponse.json({ services: getBookableServices() });
}
