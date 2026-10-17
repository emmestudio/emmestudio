-- Artist messaging: private attachment metadata. Apply after migrations 018 and 019.
CREATE TABLE IF NOT EXISTS studio_artist_message_attachments (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  artist_id uuid NOT NULL,
  track_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES studio_artist_track_messages(id) ON DELETE CASCADE,
  blob_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_artist_message_attachments_message_idx
 ON studio_artist_message_attachments(owner_id, artist_id, track_id, message_id);
