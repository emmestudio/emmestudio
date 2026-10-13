CREATE UNIQUE INDEX IF NOT EXISTS studio_projects_owner_id_unique ON studio_projects(owner_id,id);
CREATE TABLE IF NOT EXISTS studio_tasks (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  assignee TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Da fare' CHECK (status IN ('Da fare','In corso','Completata')),
  priority TEXT NOT NULL DEFAULT 'Normale' CHECK (priority IN ('Alta','Normale','Bassa')),
  deadline TEXT,
  notes TEXT NOT NULL DEFAULT '',
  request_digest TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS studio_tasks_owner_deadline_idx ON studio_tasks(owner_id,deadline);
