CREATE TABLE IF NOT EXISTS studio_artists (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200), email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
 genre TEXT NOT NULL DEFAULT '', links TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 direction BOOLEAN NOT NULL DEFAULT false, director TEXT NOT NULL DEFAULT '', objectives TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id)
);
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS artist_id UUID;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS service TEXT NOT NULL DEFAULT 'Da definire';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='studio_projects_artist_workspace_fk') THEN
 ALTER TABLE studio_projects ADD CONSTRAINT studio_projects_artist_workspace_fk FOREIGN KEY(owner_id,artist_id) REFERENCES studio_artists(owner_id,id);
 END IF;
END $$;
-- Basic profiles preserve exact existing names; no guessed contacts or direction assignments.
INSERT INTO studio_artists(id,owner_id,name)
 SELECT gen_random_uuid(),p.owner_id,p.artist FROM studio_projects p WHERE p.artist_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM studio_artists a WHERE a.owner_id=p.owner_id AND a.name=p.artist)
 GROUP BY p.owner_id,p.artist;
UPDATE studio_projects p SET artist_id=a.id FROM studio_artists a WHERE p.artist_id IS NULL AND a.owner_id=p.owner_id AND a.name=p.artist;
CREATE INDEX IF NOT EXISTS studio_projects_artist_idx ON studio_projects(owner_id,artist_id);
CREATE TABLE IF NOT EXISTS studio_quotes (
 project_id UUID PRIMARY KEY, owner_id TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount BETWEEN 0 AND 999999999),
 status TEXT NOT NULL CHECK(status IN ('Bozza','Inviato','Confermato','Rifiutato')), notes TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id), UNIQUE(owner_id,project_id)
);
CREATE TABLE IF NOT EXISTS studio_installments (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL, project_id UUID NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
 due_date TEXT NOT NULL, label TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_quotes(owner_id,project_id)
);
CREATE TABLE IF NOT EXISTS studio_payments (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL, project_id UUID NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
 paid_date TEXT NOT NULL, method TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', void_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), voided_at TIMESTAMPTZ,
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_quotes(owner_id,project_id)
);
CREATE INDEX IF NOT EXISTS studio_installments_owner_idx ON studio_installments(owner_id,project_id);
CREATE INDEX IF NOT EXISTS studio_payments_owner_idx ON studio_payments(owner_id,project_id);
