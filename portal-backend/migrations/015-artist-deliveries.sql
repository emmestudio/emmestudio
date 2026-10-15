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
