-- Soft delete for completed reservations (AGENTS.md admin "삭제"
-- feature): removing an item from the admin dashboard only ever sets
-- deleted_at, never physically deletes the row — reservation history
-- (and any future analytics) stays intact. No CHECK constraint is
-- involved, so a plain ADD COLUMN is sufficient here (unlike 0004/0005).
ALTER TABLE reservations ADD COLUMN deleted_at TEXT;
CREATE INDEX idx_reservations_deleted_at ON reservations(deleted_at);
