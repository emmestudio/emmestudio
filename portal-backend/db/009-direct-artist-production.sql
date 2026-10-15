-- Existing projects and production records remain valid. Direct work has no project.
ALTER TABLE studio_production ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE studio_production ADD COLUMN IF NOT EXISTS artist_id UUID;
UPDATE studio_production r SET artist_id=p.artist_id FROM studio_projects p
 WHERE r.project_id=p.id AND r.owner_id=p.owner_id AND r.artist_id IS NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='studio_production_artist_workspace_fk') THEN
 ALTER TABLE studio_production ADD CONSTRAINT studio_production_artist_workspace_fk
 FOREIGN KEY(owner_id,artist_id) REFERENCES studio_artists(owner_id,id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='studio_production_context_check') THEN
 ALTER TABLE studio_production ADD CONSTRAINT studio_production_context_check CHECK(project_id IS NOT NULL OR artist_id IS NOT NULL);
 END IF;
END $$;
ALTER TABLE studio_production DROP CONSTRAINT IF EXISTS studio_production_kind_check;
ALTER TABLE studio_production ADD CONSTRAINT studio_production_kind_check CHECK(kind IN ('track','recording','material','revision','live','service'));
CREATE INDEX IF NOT EXISTS studio_production_artist_idx ON studio_production(owner_id,artist_id);
