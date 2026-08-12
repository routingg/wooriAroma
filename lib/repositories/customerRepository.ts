import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { AppLocale } from "@/i18n/routing";

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  preferredLanguage: AppLocale;
  /** Explicit consent to receive WhatsApp reservation notifications (Meta template-messaging rule) — defaults to false. */
  whatsappOptIn?: boolean;
}

export interface CustomerRecord extends Omit<CustomerInput, "whatsappOptIn"> {
  id: string;
  whatsappOptIn: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RawCustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferred_language: string;
  whatsapp_opt_in: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawCustomerRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    preferredLanguage: row.preferred_language as AppLocale,
    whatsappOptIn: row.whatsapp_opt_in === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Inserts a new customer, or updates an existing one matched by email — the
 * closest thing to a customer identity available without a login system.
 * Call from inside the caller's write transaction (see
 * reservationRepository.createHold) so it commits atomically with the
 * reservation it belongs to.
 */
export function upsertCustomer(input: CustomerInput): CustomerRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const email = input.email.trim().toLowerCase();
  const whatsappOptIn = input.whatsappOptIn ?? false;

  const existing = db.prepare("SELECT * FROM customers WHERE email = ?").get(email) as
    | RawCustomerRow
    | undefined;

  if (existing) {
    db.prepare(
      `UPDATE customers SET name = ?, phone = ?, preferred_language = ?, whatsapp_opt_in = ?, updated_at = ? WHERE id = ?`,
    ).run(input.name, input.phone, input.preferredLanguage, whatsappOptIn ? 1 : 0, now, existing.id);
    return mapRow({
      ...existing,
      name: input.name,
      phone: input.phone,
      preferred_language: input.preferredLanguage,
      whatsapp_opt_in: whatsappOptIn ? 1 : 0,
      updated_at: now,
    });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO customers (id, name, phone, email, preferred_language, whatsapp_opt_in, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.phone, email, input.preferredLanguage, whatsappOptIn ? 1 : 0, now, now);

  return mapRow({
    id,
    name: input.name,
    phone: input.phone,
    email,
    preferred_language: input.preferredLanguage,
    whatsapp_opt_in: whatsappOptIn ? 1 : 0,
    created_at: now,
    updated_at: now,
  });
}

export function getCustomerById(id: string): CustomerRecord | undefined {
  const row = getDb().prepare("SELECT * FROM customers WHERE id = ?").get(id) as RawCustomerRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function getCustomerByEmail(email: string): CustomerRecord | undefined {
  const row = getDb()
    .prepare("SELECT * FROM customers WHERE email = ?")
    .get(email.trim().toLowerCase()) as RawCustomerRow | undefined;
  return row ? mapRow(row) : undefined;
}
