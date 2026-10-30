ALTER TABLE studio_bookings ADD COLUMN IF NOT EXISTS quote_refs jsonb NOT NULL DEFAULT '[]';
ALTER TABLE studio_booking_mail ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS studio_booking_quote_files(booking_id uuid NOT NULL REFERENCES studio_bookings(id) ON DELETE CASCADE,target_id uuid NOT NULL,version integer NOT NULL,name text NOT NULL,pdf bytea NOT NULL,PRIMARY KEY(booking_id,target_id));
