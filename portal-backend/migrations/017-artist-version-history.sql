-- Artist version history v017. Apply in Neon SQL Editor after backup.
ALTER TABLE studio_artist_previews ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE studio_artist_previews ADD COLUMN IF NOT EXISTS revision_requested_at timestamptz;
CREATE TABLE IF NOT EXISTS studio_artist_preview_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 preview_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('published','approved','revision_requested','withdrawn')),
 notes text NOT NULL DEFAULT '',
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_artist_preview_events_by_preview ON studio_artist_preview_events(owner_id,preview_id,occurred_at DESC);
CREATE OR REPLACE FUNCTION studio_artist_version_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
  IF NEW.status='approved' THEN NEW.approved_at=now(); END IF;
  IF NEW.status='revision_requested' THEN NEW.revision_requested_at=now(); END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artist_version_audit_before ON studio_artist_previews;
CREATE TRIGGER artist_version_audit_before BEFORE UPDATE OF status ON studio_artist_previews
 FOR EACH ROW EXECUTE FUNCTION studio_artist_version_audit();
CREATE OR REPLACE FUNCTION studio_artist_version_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
  IF NEW.status IN ('ready','approved','revision_requested','withdrawn') THEN
   INSERT INTO studio_artist_preview_events(owner_id,preview_id,event_type,notes) VALUES
    (NEW.owner_id,NEW.id,CASE WHEN NEW.status='ready' THEN 'published' ELSE NEW.status END,COALESCE(NEW.feedback,''));
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS artist_version_audit_after ON studio_artist_previews;
CREATE TRIGGER artist_version_audit_after AFTER UPDATE OF status ON studio_artist_previews
 FOR EACH ROW EXECUTE FUNCTION studio_artist_version_history();
