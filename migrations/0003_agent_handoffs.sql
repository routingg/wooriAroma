-- "에이전트 예외함" (AGENTS.md §18): cases the Gemini agent could not
-- safely resolve itself and must hand to a human. The agent never
-- gets tools for discounts, refunds, or bypassing blocked times — it
-- can only ever escalate here, never act around a missing policy.
CREATE TABLE agent_handoffs (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  summary TEXT NOT NULL,
  customer_contact TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  admin_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agent_handoffs_status ON agent_handoffs(status);
