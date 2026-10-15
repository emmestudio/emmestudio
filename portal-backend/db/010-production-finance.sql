-- A finance subject is a real project OR a real production item. No hidden projects.
CREATE TABLE IF NOT EXISTS studio_finance_targets (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL, project_id UUID, production_id UUID,
 UNIQUE(owner_id,id),
 CHECK (num_nonnulls(project_id,production_id)=1),
 CHECK ((project_id=id AND production_id IS NULL) OR (production_id=id AND project_id IS NULL)),
 FOREIGN KEY(owner_id,project_id) REFERENCES studio_projects(owner_id,id) ON DELETE CASCADE,
 FOREIGN KEY(owner_id,production_id) REFERENCES studio_production(owner_id,id) ON DELETE CASCADE
);
INSERT INTO studio_finance_targets(id,owner_id,project_id) SELECT id,owner_id,id FROM studio_projects ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION studio_register_project_finance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO studio_finance_targets(id,owner_id,project_id) VALUES(NEW.id,NEW.owner_id,NEW.id); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_project_finance_target ON studio_projects;
CREATE TRIGGER studio_project_finance_target AFTER INSERT ON studio_projects FOR EACH ROW EXECUTE FUNCTION studio_register_project_finance();
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='studio_quotes'::regclass AND confrelid='studio_projects'::regclass LOOP
 EXECUTE format('ALTER TABLE studio_quotes DROP CONSTRAINT %I',r.conname);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='studio_quotes_finance_target_fk') THEN
 ALTER TABLE studio_quotes ADD CONSTRAINT studio_quotes_finance_target_fk FOREIGN KEY(owner_id,project_id) REFERENCES studio_finance_targets(owner_id,id);
 END IF;
END $$;
