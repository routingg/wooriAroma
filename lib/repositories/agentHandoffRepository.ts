import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";

export type AgentHandoffStatus = "OPEN" | "RESOLVED";

export interface AgentHandoffInput {
  reason: string;
  summary: string;
  customerContact?: string;
}

export interface AgentHandoffRecord extends AgentHandoffInput {
  id: string;
  status: AgentHandoffStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawRow {
  id: string;
  reason: string;
  summary: string;
  customer_contact: string | null;
  status: AgentHandoffStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawRow): AgentHandoffRecord {
  return {
    id: row.id,
    reason: row.reason,
    summary: row.summary,
    customerContact: row.customer_contact ?? undefined,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createHandoff(input: AgentHandoffInput): Promise<AgentHandoffRecord> {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO agent_handoffs (id, reason, summary, customer_contact, status, admin_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'OPEN', NULL, ?, ?)`,
    )
    .bind(id, input.reason, input.summary, input.customerContact ?? null, now, now)
    .run();
  return {
    id,
    reason: input.reason,
    summary: input.summary,
    customerContact: input.customerContact,
    status: "OPEN",
    adminNotes: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listHandoffs(status?: AgentHandoffStatus): Promise<AgentHandoffRecord[]> {
  const db = getDb();
  const { results } = status
    ? await db.prepare("SELECT * FROM agent_handoffs WHERE status = ? ORDER BY created_at DESC").bind(status).all<RawRow>()
    : await db.prepare("SELECT * FROM agent_handoffs ORDER BY created_at DESC").all<RawRow>();
  return results.map(mapRow);
}

export async function resolveHandoff(id: string, adminNotes?: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE agent_handoffs SET status = 'RESOLVED', admin_notes = ?, updated_at = ? WHERE id = ?")
    .bind(adminNotes ?? null, new Date().toISOString(), id)
    .run();
}
