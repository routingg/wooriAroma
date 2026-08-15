"use client";

import { useState } from "react";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

/** Plain fetch to the server route — never calls Gemini or reads GEMINI_API_KEY from the client. */
export function AgentChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraft("");
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, locale: "en" }),
      });
      const body = (await res.json()) as { reply?: string; error?: { message?: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Request failed.");
        return;
      }
      setMessages((prev) => [...prev, { role: "model", content: body.reply ?? "" }]);
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex min-h-[300px] flex-1 flex-col gap-3 rounded-lg border border-stone-300 bg-white p-4">
        {messages.length === 0 && <p className="text-sm text-stone-400">No messages yet.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end text-right" : "self-start text-left"}>
            <div
              className={
                "inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm " +
                (m.role === "user" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-900")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm text-stone-400">Thinking…</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Can I get a 90-minute aroma massage tomorrow at 4pm for two people?"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
