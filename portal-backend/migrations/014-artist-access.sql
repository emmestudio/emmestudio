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
