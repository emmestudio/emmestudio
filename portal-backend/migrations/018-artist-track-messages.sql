-- Apply to Neon after backup before enabling conversations.
CREATE TABLE IF NOT EXISTS studio_artist_track_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 artist_id uuid NOT NULL,
 track_id uuid NOT NULL,
 sender_role text NOT NULL CHECK (sender_role IN ('studio','artist')),
 body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 3000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_artist_track_messages_thread
 ON studio_artist_track_messages(owner_id,artist_id,track_id,created_at DESC);
