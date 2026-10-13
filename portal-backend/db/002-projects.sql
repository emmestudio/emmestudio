CREATE TABLE IF NOT EXISTS studio_projects (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('Singolo','Album','Live','Percorso artistico')),
  status TEXT NOT NULL CHECK (status IN ('Pianificazione','In produzione','In uscita','Attivo','Completato','Archiviato')),
  deadline TEXT,
  vision TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  music INTEGER NOT NULL DEFAULT 0 CHECK (music IN (0,50,100)),
  live INTEGER NOT NULL DEFAULT 0 CHECK (live IN (0,50,100)),
  image INTEGER NOT NULL DEFAULT 0 CHECK (image IN (0,50,100)),
  request_digest TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_projects_owner_updated_idx ON studio_projects(owner_id,updated_at DESC);
