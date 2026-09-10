-- Overseas guests frequently arrive with a roaming-disabled or home-country
-- phone number, so the number they typed is often unreachable while they are
-- in Jeju. Store one optional messenger handle they can actually be reached
-- on. Nullable in both columns: the wizard field is optional and every row
-- written before this migration predates it. A NULL app passes the CHECK, so
-- existing rows migrate untouched.
ALTER TABLE customers ADD COLUMN messenger_app TEXT
  CHECK (messenger_app IS NULL OR messenger_app IN ('WHATSAPP','TELEGRAM','WECHAT'));
ALTER TABLE customers ADD COLUMN messenger_handle TEXT;
