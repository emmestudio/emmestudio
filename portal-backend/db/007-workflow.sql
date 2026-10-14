ALTER TABLE studio_tasks ADD COLUMN IF NOT EXISTS assignee_email TEXT;
CREATE TABLE IF NOT EXISTS studio_workflow (
 project_id UUID PRIMARY KEY, owner_id TEXT NOT NULL, template TEXT, planned_minutes INTEGER NOT NULL DEFAULT 0 CHECK(planned_minutes BETWEEN 0 AND 600000),
 version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id)
);
CREATE TABLE IF NOT EXISTS studio_hours (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL, project_id UUID NOT NULL, person_email TEXT NOT NULL,
 worked_on TEXT NOT NULL, minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 1440), category TEXT NOT NULL,
 description TEXT NOT NULL, production_id UUID, version INTEGER NOT NULL DEFAULT 1, void_reason TEXT,
 request_digest TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id), FOREIGN KEY(owner_id,production_id) REFERENCES studio_production(owner_id,id)
);
CREATE TABLE IF NOT EXISTS studio_delivery (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL, project_id UUID NOT NULL, track_id UUID,
 label TEXT NOT NULL, done BOOLEAN NOT NULL DEFAULT false, required BOOLEAN NOT NULL DEFAULT true,
 assignee_email TEXT, due_date TEXT, notes TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
 completed_at TIMESTAMPTZ, completed_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id), FOREIGN KEY(owner_id,track_id) REFERENCES studio_production(owner_id,id)
);
CREATE TABLE IF NOT EXISTS studio_work_history (
 resource_id UUID NOT NULL, owner_id TEXT NOT NULL, kind TEXT NOT NULL, version INTEGER NOT NULL,
 snapshot JSONB NOT NULL, actor TEXT NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(resource_id,kind,version)
);
CREATE INDEX IF NOT EXISTS studio_hours_owner_person ON studio_hours(owner_id,person_email,worked_on);
CREATE INDEX IF NOT EXISTS studio_delivery_project ON studio_delivery(owner_id,project_id);
