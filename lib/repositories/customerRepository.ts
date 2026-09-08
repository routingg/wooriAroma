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
 * Prepares an independent booking contact. An email supplied by an anonymous
 * guest is not proof that they own an existing customer's identity. The caller
 * must persist this statement in the same D1 batch as its reservation.
 */
export function prepareBookingCustomer(input: CustomerInput): { customer: CustomerRecord; statement: D1PreparedStatement } {
  const db = getDb();
  const now = new Date().toISOString();
  const email = input.email.trim().toLowerCase();

  const id = randomUUID();
  const statement = db
    .prepare(
      `INSERT INTO customers (id, name, phone, email, preferred_language, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.name, input.phone, email, input.preferredLanguage, now, now);

  const customer = mapRow({
    id,
    name: input.name,
    phone: input.phone,
    email,
    preferred_language: input.preferredLanguage,
    created_at: now,
    updated_at: now,
  });
  return { customer, statement };
}

export async function getCustomerById(id: string): Promise<CustomerRecord | undefined> {
  const row = await getDb().prepare("SELECT * FROM customers WHERE id = ?").bind(id).first<RawCustomerRow>();
  return row ? mapRow(row) : undefined;
}
