/**
 * Structured, single-line server logs for agent observability (task spec
 * §16). Deliberately takes only scalar fields — there is no "extra"/
 * "context" bag a caller could accidentally stuff a full conversation
 * dump, GEMINI_API_KEY, or a customer's raw email/phone/notes into. Log
 * aggregation can grep on `requestId=` to reconstruct one request's
 * timeline.
 */
export interface AgentLogEvent {
  requestId: string;
  model: string;
  event: "gemini_call" | "tool_call" | "loop_limit" | "gemini_unavailable";
  toolName?: string;
  success?: boolean;
  durationMs?: number;
  geminiStatus?: string;
  detail?: string;
}

export function logAgentEvent(event: AgentLogEvent): void {
  const fields = [
    `requestId=${event.requestId}`,
    `model=${event.model}`,
    `event=${event.event}`,
    event.toolName ? `tool=${event.toolName}` : null,
    event.success !== undefined ? `success=${event.success}` : null,
    event.durationMs !== undefined ? `durationMs=${event.durationMs}` : null,
    event.geminiStatus ? `geminiStatus=${event.geminiStatus}` : null,
    event.detail ? `detail=${event.detail}` : null,
  ].filter(Boolean);

  const line = `[agent] ${fields.join(" ")}`;
  if (event.event === "gemini_unavailable" || event.success === false) {
    console.error(line);
  } else {
    console.log(line);
  }
}
