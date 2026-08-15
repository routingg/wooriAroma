import { notFound } from "next/navigation";
import { AgentChatPanel } from "./AgentChatPanel";

/**
 * Dev-only manual test harness for POST /api/agent/chat (task spec §14:
 * "필요하면 최소한의 dev/test UI만 만든다" — not a replacement for the real
 * customer Booking Wizard at app/[locale]/book, which is untouched).
 * Same production-gating pattern as app/dev/themes/page.tsx.
 */
export default function DevAgentChatPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Agent Chat (dev)</h1>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          Manual test harness for the Gemini booking assistant (POST /api/agent/chat). Not linked from the
          customer site.
        </p>
      </div>
      <AgentChatPanel />
    </main>
  );
}
