import { routing, type AppLocale } from "@/i18n/routing";
import { BookingError } from "@/lib/booking/errors";

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  locale: AppLocale;
}

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4000;

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}

/**
 * Validates POST /api/agent/chat's body. Deliberately accepts ONLY
 * {role, content} text pairs — never a client-supplied tool name or tool
 * result. The Gemini conversation's function-call/function-response turns
 * are reconstructed server-side inside the route handler from the
 * server's own tool executions (see lib/agent/toolRunner.ts), never taken
 * from the request body — a client cannot make the server "replay" an
 * arbitrary tool call this way.
 */
export function validateChatRequest(body: unknown): ChatRequest {
  if (typeof body !== "object" || body === null) {
    throw new BookingError("VALIDATION_ERROR", "Request body must be an object.");
  }
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    throw new BookingError("VALIDATION_ERROR", "messages must be a non-empty array.");
  }
  if (b.messages.length > MAX_MESSAGES) {
    throw new BookingError("VALIDATION_ERROR", `messages must not exceed ${MAX_MESSAGES} entries.`);
  }

  const messages: ChatMessage[] = b.messages.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new BookingError("VALIDATION_ERROR", `messages[${index}] must be an object.`);
    }
    const m = raw as Record<string, unknown>;
    if (m.role !== "user" && m.role !== "model") {
      throw new BookingError("VALIDATION_ERROR", `messages[${index}].role must be "user" or "model".`);
    }
    if (typeof m.content !== "string" || m.content.trim().length === 0) {
      throw new BookingError("VALIDATION_ERROR", `messages[${index}].content must be a non-empty string.`);
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      throw new BookingError("VALIDATION_ERROR", `messages[${index}].content is too long.`);
    }
    return { role: m.role, content: m.content };
  });

  if (messages[messages.length - 1].role !== "user") {
    throw new BookingError("VALIDATION_ERROR", "The last message must be from the user.");
  }

  const locale = isAppLocale(b.locale) ? b.locale : routing.defaultLocale;

  return { messages, locale };
}
