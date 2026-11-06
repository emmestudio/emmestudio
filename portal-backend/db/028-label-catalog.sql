CREATE TABLE IF NOT EXISTS studio_label_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('artist','release')),
  slug text NOT NULL,
  data jsonb NOT NULL,
  published boolean NOT NULL DEFAULT false,
  published_once boolean NOT NULL DEFAULT false,
  image bytea,
  image_type text,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, kind, slug)
);
