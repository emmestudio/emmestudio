CREATE TABLE IF NOT EXISTS studio_bookings(
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id), client_key uuid NOT NULL UNIQUE,
 name text NOT NULL,email text NOT NULL,phone text NOT NULL,project text NOT NULL,service text NOT NULL,description text NOT NULL,links text NOT NULL DEFAULT '',alternative text NOT NULL DEFAULT '',
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','proposed','confirmed','rejected','cancelled','completed')),
 proposed_start timestamptz,proposed_end timestamptz,internal_notes text NOT NULL DEFAULT '',assigned_to text NOT NULL DEFAULT '',artist_id text NOT NULL DEFAULT '',project_id text NOT NULL DEFAULT '',
 calendar_state text NOT NULL DEFAULT 'pending',calendar_message text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),ip_hash text NOT NULL, reminder_at timestamptz
);
CREATE INDEX IF NOT EXISTS studio_bookings_owner_start ON studio_bookings(owner_id,start_at);
CREATE INDEX IF NOT EXISTS studio_bookings_abuse ON studio_bookings(ip_hash,created_at);
CREATE TABLE IF NOT EXISTS studio_booking_messages(id uuid PRIMARY KEY,booking_id uuid NOT NULL REFERENCES studio_bookings(id) ON DELETE CASCADE,author text NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS studio_booking_mail(id uuid PRIMARY KEY,booking_id uuid NOT NULL REFERENCES studio_bookings(id) ON DELETE CASCADE,recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,sent_at timestamptz,attempts integer NOT NULL DEFAULT 0,last_error text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE studio_bookings ADD COLUMN IF NOT EXISTS calendar_event_id text;
