import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, createModelContent, createPartFromFunctionResponse, createUserContent, type Content } from "@google/genai";
import { validateChatRequest } from "@/lib/agent/chatRequest";
import { buildSystemPrompt } from "@/lib/agent/systemPrompt";
import { AGENT_TOOL_DECLARATIONS } from "@/lib/agent/toolDeclarations";
import { runAgentTool } from "@/lib/agent/toolRunner";
import { getGeminiClient, getGeminiModelName, GeminiConfigError } from "@/lib/agent/geminiClient";
import { logAgentEvent } from "@/lib/agent/log";
import { bookingErrorResponse } from "@/lib/booking/apiError";
import { BookingError } from "@/lib/booking/errors";

/**
 * POST /api/agent/chat
 *
 * Customer-facing Gemini function-calling loop (task spec §7/§12). This
 * route is the only place a Gemini function call turns into a real tool
 * execution — the request body is validated to contain ONLY {role,
 * content} message text (lib/agent/chatRequest.ts), never a client-
 * supplied tool name or tool result, and every function call Gemini
 * returns is re-validated and dispatched through lib/agent/toolRunner.ts's
 * closed registry before anything runs. Gemini never talks to the
 * database directly — every tool wraps the same domain functions/
 * repositories the Booking Wizard and admin dashboard use.
 *
 * The existing customer Booking Wizard (app/[locale]/book) does not
 * depend on this route and keeps working even if Gemini is completely
 * unavailable — see the outer catch below, which always resolves to a
 * safe fallback message instead of a 5xx.
 */

const MAX_TOOL_ITERATIONS = 6;

const FALLBACK_MESSAGE =
  "The AI assistant is temporarily unavailable. You can still book using our standard reservation form.";

const LOOP_LIMIT_MESSAGE =
  "I wasn't able to finish processing this request. A staff member will follow up with you shortly — you can also use our standard reservation form.";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const model = getGeminiModelName();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return bookingErrorResponse(new BookingError("VALIDATION_ERROR", "Request body must be valid JSON."));
  }

  let chatRequest;
  try {
    chatRequest = validateChatRequest(rawBody);
  } catch (error) {
    return bookingErrorResponse(error);
  }

  const { messages, locale } = chatRequest;
  const contents: Content[] = messages.map((m) =>
    m.role === "user" ? createUserContent(m.content) : createModelContent(m.content),
  );

  let client: ReturnType<typeof getGeminiClient>;
  try {
    client = getGeminiClient();
  } catch (error) {
    const detail = error instanceof GeminiConfigError ? "not_configured" : `unexpected_init_error: ${String(error)}`;
    logAgentEvent({ requestId, model, event: "gemini_unavailable", detail });
    return NextResponse.json({ reply: FALLBACK_MESSAGE, available: false });
  }

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const geminiStart = Date.now();
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: buildSystemPrompt(locale),
          tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
        },
      });
      logAgentEvent({
        requestId,
        model,
        event: "gemini_call",
        success: true,
        durationMs: Date.now() - geminiStart,
      });

      const calls = response.functionCalls;
      if (!calls || calls.length === 0) {
        return NextResponse.json({ reply: response.text ?? "" });
      }

      const modelTurn = response.candidates?.[0]?.content;
      if (modelTurn) contents.push(modelTurn);

      const responseParts = [];
      for (const call of calls) {
        const toolName = call.name ?? "";
        const toolStart = Date.now();
        const result = await runAgentTool(toolName, call.args, { locale });
        logAgentEvent({
          requestId,
          model,
          event: "tool_call",
          toolName,
          success: result.ok,
          durationMs: Date.now() - toolStart,
          detail: result.ok ? undefined : result.error?.code,
        });

        const callId = call.id ?? toolName ?? "call";
        responseParts.push(
          createPartFromFunctionResponse(
            callId,
            toolName,
            result.ok ? { output: result.data } : { error: result.error },
          ),
        );
      }
      contents.push({ role: "user", parts: responseParts });
    }

    logAgentEvent({ requestId, model, event: "loop_limit" });
    return NextResponse.json({ reply: LOOP_LIMIT_MESSAGE });
  } catch (error) {
    let detail = "unexpected_error";
    if (error instanceof ApiError || error instanceof GeminiConfigError) {
      detail = error.message;
    } else {
      console.error(`[api/agent/chat] unexpected error (requestId=${requestId})`, error);
    }
    logAgentEvent({ requestId, model, event: "gemini_unavailable", detail });
    return NextResponse.json({ reply: FALLBACK_MESSAGE, available: false });
  }
}
