import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAdminBookingAlerts } from "@/lib/notifications/adminBookingAlerts";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headers = { "Cache-Control": "no-store" };
  if (!secret) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503, headers });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  }
  try {
    const result = await processAdminBookingAlerts();
    return NextResponse.json(result, { status: result.configurationError ? 503 : 200, headers });
  } catch {
    return NextResponse.json({ error: "NOTIFICATION_RUN_FAILED" }, { status: 503, headers });
  }
}
