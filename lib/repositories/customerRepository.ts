import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { AppLocale } from "@/i18n/routing";

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  preferredLanguage: AppLocale;
}

export interface CustomerRecord extends CustomerInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface RawCustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferred_language: string;
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

  const existing = db.prepare("SELECT * FROM customers WHERE email = ?").get(email) as
    | RawCustomerRow
    | undefined;

  if (existing) {
    db.prepare(
      `UPDATE customers SET name = ?, phone = ?, preferred_language = ?, updated_at = ? WHERE id = ?`,
    ).run(input.name, input.phone, input.preferredLanguage, now, existing.id);
    return mapRow({
      ...existing,
      name: input.name,
      phone: input.phone,
      preferred_language: input.preferredLanguage,
      updated_at: now,
    });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO customers (id, name, phone, email, preferred_language, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.phone, email, input.preferredLanguage, now, now);

  return mapRow({
    id,
    name: input.name,
    phone: input.phone,
    email,
    preferred_language: input.preferredLanguage,
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
