CREATE TABLE IF NOT EXISTS studio_artist_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 artist_id uuid NOT NULL,
 track_id uuid NOT NULL,
 recipient text NOT NULL CHECK (recipient IN ('studio','artist')),
 event_type text NOT NULL CHECK (event_type IN ('message','preview','approval','revision','delivery')),
 body text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS studio_artist_notifications_inbox ON studio_artist_notifications(owner_id,recipient,artist_id,created_at DESC);
