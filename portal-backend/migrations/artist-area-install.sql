-- Area Artista: eseguire una sola volta nel SQL Editor Neon dopo uno snapshot/backup.
BEGIN;

-- 013-artist-previews.sql
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


-- 014-artist-access.sql
-- Separately managed artist authentication; not a portal_members role.
CREATE TABLE IF NOT EXISTS studio_artist_access (
 owner_id text NOT NULL,
 artist_id uuid NOT NULL,
 email text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,artist_id),
 UNIQUE(owner_id,email)
);
CREATE INDEX IF NOT EXISTS studio_artist_access_login ON studio_artist_access(lower(email)) WHERE enabled=true;


-- 015-artist-deliveries.sql
CREATE TABLE IF NOT EXISTS studio_artist_deliveries (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL,
 artist_id uuid NOT NULL,
 track_id uuid NOT NULL,
 title varchar(300) NOT NULL,
 file_id varchar(200) NOT NULL,
 file_name varchar(255) NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id)
);
CREATE INDEX IF NOT EXISTS artist_deliveries_visible ON studio_artist_deliveries(owner_id,artist_id,enabled);

COMMIT;
SELECT to_regclass('public.studio_artist_previews') AS anteprime, to_regclass('public.studio_artist_access') AS accessi, to_regclass('public.studio_artist_deliveries') AS consegne;
