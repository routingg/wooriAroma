import { BookingError } from "@/lib/booking/errors";
import type { AppLocale } from "@/i18n/routing";
import * as tools from "./tools";

export interface ToolCallContext {
  locale: AppLocale;
}

export interface ToolCallResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

type ToolArgs = Record<string, unknown>;
type ToolHandler = (args: ToolArgs, ctx: ToolCallContext) => Promise<unknown> | unknown;

function requireString(args: ToolArgs, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BookingError("VALIDATION_ERROR", `"${key}" must be a non-empty string.`);
  }
  return value;
}

function optionalString(args: ToolArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function requireNumber(args: ToolArgs, key: string): number {
  const value = Number(args[key]);
  if (!Number.isFinite(value)) {
    throw new BookingError("VALIDATION_ERROR", `"${key}" must be a number.`);
  }
  return value;
}

/**
 * The full, closed set of functions Gemini is allowed to invoke — the
 * enforcement point for the "no confirmReservation/deleteReservation/
 * directDatabaseWrite/etc. for the customer agent" rule. Every argument
 * from Gemini is re-extracted through the requireString/optionalString/
 * requireNumber helpers above rather than trusted as-is (Gemini's `args`
 * are untyped JSON), and
 * the underlying lib/agent/tools.ts functions re-validate again against
 * real business rules (e.g. validateReservationHoldRequest). A tool name
 * not present as a key here is unreachable — see runAgentTool().
 */
const AGENT_TOOL_REGISTRY: Record<string, ToolHandler> = {
  getServices: (_args, ctx) => tools.getServices(ctx.locale),

  getAvailability: (args) =>
    tools.getAvailability({
      date: requireString(args, "date"),
      serviceOptionId: requireString(args, "serviceOptionId"),
      partySize: requireNumber(args, "partySize"),
    }),

  calculatePrice: (args) =>
    tools.calculatePrice({
      serviceOptionId: requireString(args, "serviceOptionId"),
      partySize: requireNumber(args, "partySize"),
    }),

  createReservationRequest: (args, ctx) =>
    tools.createReservationRequest({
      serviceOptionId: requireString(args, "serviceOptionId"),
      partySize: requireNumber(args, "partySize"),
      date: requireString(args, "date"),
      time: requireString(args, "time"),
      customerName: requireString(args, "customerName"),
      email: requireString(args, "email"),
      phoneOrWhatsapp: requireString(args, "phoneOrWhatsapp"),
      specialRequest: optionalString(args, "specialRequest"),
      locale: ctx.locale,
    }),

  getReservationStatus: (args) =>
    tools.getReservationStatus({
      reservationNumber: requireString(args, "reservationNumber"),
      email: optionalString(args, "email"),
      phone: optionalString(args, "phone"),
    }),

  handoffToAdmin: (args) =>
    tools.handoffToAdmin({
      reason: requireString(args, "reason"),
      summary: requireString(args, "summary"),
      customerContact: optionalString(args, "customerContact"),
    }),
};

/** Exposed for tests/agent/toolRunner.test.ts to assert the forbidden tool names are structurally absent, not just unreachable at runtime. */
export const ALLOWED_AGENT_TOOL_NAMES: readonly string[] = Object.freeze(Object.keys(AGENT_TOOL_REGISTRY));

/**
 * Validates and executes exactly one Gemini function call. Unknown tool
 * names are rejected before any domain code runs — this is what makes it
 * impossible for a client (or a manipulated Gemini response) to reach any
 * function not in AGENT_TOOL_REGISTRY, regardless of what name appears in
 * the function-call payload.
 */
export async function runAgentTool(
  name: string,
  rawArgs: ToolArgs | undefined,
  ctx: ToolCallContext,
): Promise<ToolCallResult> {
  const handler = AGENT_TOOL_REGISTRY[name];
  if (!handler) {
    return { ok: false, error: { code: "UNKNOWN_TOOL", message: `Tool "${name}" is not available.` } };
  }

  try {
    const data = await handler(rawArgs ?? {}, ctx);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof BookingError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    console.error(`[agent/toolRunner] tool "${name}" failed`, error);
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } };
  }
}
