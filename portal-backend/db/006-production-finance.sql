CREATE TABLE IF NOT EXISTS studio_production (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL, project_id UUID NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('track','recording','material','revision','live')),
 data JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 1, request_digest TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id), UNIQUE(owner_id,id)
);
CREATE TABLE IF NOT EXISTS studio_production_history (
 item_id UUID NOT NULL, owner_id TEXT NOT NULL, version INTEGER NOT NULL, data JSONB NOT NULL,
 actor TEXT NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(item_id,version),
 FOREIGN KEY(owner_id,item_id) REFERENCES studio_production(owner_id,id)
);
CREATE INDEX IF NOT EXISTS studio_production_project_idx ON studio_production(owner_id,project_id);
ALTER TABLE studio_quotes ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]';
ALTER TABLE studio_quotes ADD COLUMN IF NOT EXISTS confirmed_on TEXT;
ALTER TABLE studio_quotes ADD COLUMN IF NOT EXISTS confirmation_note TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS studio_quote_history (
 project_id UUID NOT NULL, owner_id TEXT NOT NULL, revision INTEGER NOT NULL,
 snapshot JSONB NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,revision), FOREIGN KEY(owner_id,project_id) REFERENCES studio_quotes(owner_id,project_id)
);
INSERT INTO studio_quote_history(project_id,owner_id,revision,snapshot)
 SELECT project_id,owner_id,version,jsonb_build_object('amount',amount,'status',status,'notes',notes,'items',items,'confirmedOn',confirmed_on,'confirmationNote',confirmation_note) FROM studio_quotes
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS studio_costs (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL, project_id UUID NOT NULL,
 description TEXT NOT NULL, supplier TEXT NOT NULL DEFAULT '', category TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>0 AND amount<=999999999), status TEXT NOT NULL CHECK(status IN ('Previsto','Da pagare','Pagato','Annullato')),
 due_date TEXT, paid_date TEXT, notes TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
 request_digest TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id)
);
CREATE TABLE IF NOT EXISTS studio_cost_history (
 cost_id UUID NOT NULL REFERENCES studio_costs(id), version INTEGER NOT NULL, snapshot JSONB NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(cost_id,version)
);
CREATE INDEX IF NOT EXISTS studio_costs_project_idx ON studio_costs(owner_id,project_id);
