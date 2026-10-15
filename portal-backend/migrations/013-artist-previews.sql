-- Preview metadata only. Never store Google OAuth tokens or deliverable media here.
-- Apply using the existing portal database migration workflow, before enabling the API.
CREATE TABLE IF NOT EXISTS studio_artist_previews (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  artist_id uuid NOT NULL,
  track_id uuid NOT NULL,
  title varchar(300) NOT NULL,
  drive_file_id varchar(200) NOT NULL,
  version_label varchar(100) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','approved','revision_requested','withdrawn')),
  delivery_unlocked boolean NOT NULL DEFAULT false,
  feedback text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);
CREATE INDEX IF NOT EXISTS studio_artist_previews_owner_artist
  ON studio_artist_previews(owner_id, artist_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS studio_artist_previews_owner_track
  ON studio_artist_previews(owner_id, track_id);
