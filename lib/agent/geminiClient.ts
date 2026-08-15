import { ApiError, GoogleGenAI } from "@google/genai";

/**
 * Server-only Gemini client factory. Never import this from a Client
 * Component or expose GEMINI_API_KEY through a `NEXT_PUBLIC_*` variable —
 * every caller must be a Route Handler, Server Action, or another
 * server-only module (same trust boundary as lib/notifications/providers/
 * email.ts's RESEND_API_KEY).
 */

/**
 * A stable alias maintained by Google that always resolves to the current
 * recommended Flash-tier model, rather than a pinned version string like
 * "gemini-2.0-flash" — pinned versions get retired (confirmed live against
 * this project's credential during implementation: gemini-2.0-flash
 * returned 404 "no longer available"). Verified against this project's
 * credential to support function calling. Override via GEMINI_MODEL
 * without touching code — this constant is the only hardcoded fallback in
 * the project.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

let cachedClient: GoogleGenAI | null = null;

/**
 * Lazily constructs (and caches) the Gemini client from GEMINI_API_KEY.
 * Throws GeminiConfigError — never logs or embeds the key value itself —
 * if the variable is unset.
 */
export function getGeminiClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError("GEMINI_API_KEY is not configured.");
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export type GeminiConnectionFailureReason =
  | "NOT_CONFIGURED"
  | "INVALID_API_KEY"
  | "UNSUPPORTED_BACKEND"
  | "MODEL_NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "API_DISABLED"
  | "UNKNOWN";

export type GeminiConnectionStatus =
  | { ok: true; model: string }
  | { ok: false; model: string; reason: GeminiConnectionFailureReason; message: string };

/**
 * Classifies an error from the Gemini SDK by HTTP status (never by
 * guessing from the API key's shape — AGENTS spec §5). Never includes the
 * API key; `error.message` from @google/genai's ApiError does not contain
 * the key, only the server's response text.
 */
/** Exported for tests/agent/geminiClient.test.ts to exercise offline, with a constructed ApiError, instead of depending on a real network round trip to produce each HTTP status. */
export function classifyGeminiError(error: unknown): { reason: GeminiConnectionFailureReason; message: string } {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return { reason: "UNSUPPORTED_BACKEND", message: error.message };
      case 401:
      case 403:
        // The Gemini API also returns 403 for a project with the
        // Generative Language API not enabled — the message text (not
        // logged with the key) is what actually distinguishes the two.
        return {
          reason: /disabled|not enabled/i.test(error.message) ? "API_DISABLED" : "INVALID_API_KEY",
          message: error.message,
        };
      case 404:
        return { reason: "MODEL_NOT_FOUND", message: error.message };
      case 429:
        return { reason: "QUOTA_EXCEEDED", message: error.message };
      default:
        return { reason: "UNKNOWN", message: error.message };
    }
  }
  return { reason: "UNKNOWN", message: error instanceof Error ? error.message : String(error) };
}

/**
 * Minimal non-mutating request (a 1-token completion) that proves the
 * configured credential can actually reach the configured model, instead
 * of assuming validity from the key string's shape. Used by the
 * diagnostics test suite (tests/agent/geminiClient.test.ts) and can be
 * called from an ad hoc admin check. Never throws — always resolves to a
 * status object so callers can't accidentally leak an unhandled rejection
 * containing SDK internals.
 */
export async function checkGeminiConnection(): Promise<GeminiConnectionStatus> {
  const model = getGeminiModelName();

  let client: GoogleGenAI;
  try {
    client = getGeminiClient();
  } catch {
    return { ok: false, model, reason: "NOT_CONFIGURED", message: "GEMINI_API_KEY is not configured." };
  }

  try {
    await client.models.generateContent({
      model,
      contents: "ping",
      config: { maxOutputTokens: 1 },
    });
    return { ok: true, model };
  } catch (error) {
    return { ok: false, model, ...classifyGeminiError(error) };
  }
}
