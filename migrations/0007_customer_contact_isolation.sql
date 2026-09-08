-- Guest checkout does not prove ownership of an email address. Keep each
-- new booking's contact record separate instead of overwriting older guests.
-- Preserve all existing ids, data and reservation foreign keys. D1 runs a
-- migration in a transaction; defer constraints while replacing the parent.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE customers_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  preferred_language TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 0
);
INSERT INTO customers_v2
  (id, name, phone, email, preferred_language, created_at, updated_at, whatsapp_opt_in)
SELECT id, name, phone, email, preferred_language, created_at, updated_at, whatsapp_opt_in
FROM customers;
DROP TABLE customers;
ALTER TABLE customers_v2 RENAME TO customers;
CREATE INDEX idx_customers_email ON customers(email);

PRAGMA defer_foreign_keys = OFF;
