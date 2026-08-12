import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/booking/reminderService";

/**
 * POST /api/cron/reminders
 *
 * Deployment-agnostic 24h reminder trigger: this codebase has no queue, no
 * in-process scheduler, and (via node:sqlite) no serverless-friendly
 * database, so the simplest reliable option is a plain HTTP endpoint that
 * any external scheduler can hit — Vercel Cron, a server crontab curling
 * this URL, a GitHub Actions scheduled workflow, etc. See README's
 * "Notification System Setup" for wiring examples.
 *
 * CRON_SECRET guards this from being triggered by anyone who finds the URL.
 * Required in production; if unset, the route refuses every request rather
 * than running unauthenticated (fail closed, not open).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[api/cron/reminders] CRON_SECRET is not configured — refusing to run.");
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Reminder cron is not configured." } }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing bearer token." } }, { status: 401 });
  }

  const result = await sendDueReminders();
  return NextResponse.json(result);
}
