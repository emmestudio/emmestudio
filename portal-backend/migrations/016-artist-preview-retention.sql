-- Apply after a database backup. Existing preview rows are not retroactively expired.
ALTER TABLE studio_artist_previews ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE studio_artist_previews ADD COLUMN IF NOT EXISTS purged_at timestamptz;
CREATE INDEX IF NOT EXISTS studio_artist_previews_retention
 ON studio_artist_previews(superseded_at) WHERE superseded_at IS NOT NULL AND purged_at IS NULL;
-- Supersession is only determined when the newer version is made ready for listening.
-- Retained draft previews do not start the 30-day clock.
CREATE OR REPLACE FUNCTION studio_mark_superseded_artist_previews() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status = 'ready' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'ready') THEN
  UPDATE studio_artist_previews
   SET superseded_at=now(),status='withdrawn',updated_at=now()
   WHERE owner_id=NEW.owner_id AND artist_id=NEW.artist_id AND track_id=NEW.track_id
     AND id<>NEW.id AND status IN ('ready','approved','revision_requested')
     AND superseded_at IS NULL AND purged_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_artist_preview_supersession ON studio_artist_previews;
CREATE TRIGGER studio_artist_preview_supersession AFTER INSERT OR UPDATE OF status
 ON studio_artist_previews FOR EACH ROW EXECUTE FUNCTION studio_mark_superseded_artist_previews();
