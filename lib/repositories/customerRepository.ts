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
 * Not atomic with the caller's reservation write (D1 has no interactive
 * transactions — see reservationRepository.createHold) — that's fine here
 * since this upsert is idempotent and keyed on a unique email, independent
 * of any particular reservation.
 */
export async function upsertCustomer(input: CustomerInput): Promise<CustomerRecord> {
  const db = getDb();
  const now = new Date().toISOString();
  const email = input.email.trim().toLowerCase();

  const existing = await db.prepare("SELECT * FROM customers WHERE email = ?").bind(email).first<RawCustomerRow>();

  if (existing) {
    await db
      .prepare(`UPDATE customers SET name = ?, phone = ?, preferred_language = ?, updated_at = ? WHERE id = ?`)
      .bind(input.name, input.phone, input.preferredLanguage, now, existing.id)
      .run();
    return mapRow({
      ...existing,
      name: input.name,
      phone: input.phone,
      preferred_language: input.preferredLanguage,
      updated_at: now,
    });
  }

  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO customers (id, name, phone, email, preferred_language, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.name, input.phone, email, input.preferredLanguage, now, now)
    .run();

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

export async function getCustomerById(id: string): Promise<CustomerRecord | undefined> {
  const row = await getDb().prepare("SELECT * FROM customers WHERE id = ?").bind(id).first<RawCustomerRow>();
  return row ? mapRow(row) : undefined;
}

export async function getCustomerByEmail(email: string): Promise<CustomerRecord | undefined> {
  const row = await getDb()
    .prepare("SELECT * FROM customers WHERE email = ?")
    .bind(email.trim().toLowerCase())
    .first<RawCustomerRow>();
  return row ? mapRow(row) : undefined;
}
