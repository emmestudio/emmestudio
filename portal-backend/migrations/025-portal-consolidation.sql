-- Additive consolidation, no external operations and no removal of existing data.
CREATE TABLE IF NOT EXISTS studio_artist_version_counters (
 owner_id text NOT NULL, track_id uuid NOT NULL, last_version integer NOT NULL CHECK(last_version>=0), PRIMARY KEY(owner_id,track_id)
);
INSERT INTO studio_artist_version_counters(owner_id,track_id,last_version)
 SELECT owner_id,track_id,GREATEST(count(*)::integer,COALESCE(max(NULLIF(substring(version_label from 'v([0-9]+)$'),'')::integer),0)) FROM studio_artist_previews GROUP BY owner_id,track_id
 ON CONFLICT(owner_id,track_id) DO UPDATE SET last_version=GREATEST(studio_artist_version_counters.last_version,EXCLUDED.last_version);
CREATE OR REPLACE FUNCTION studio_assign_preview_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 IF current_setting('emme.restoring',true)='1' THEN RETURN NEW; END IF;
 INSERT INTO studio_artist_version_counters(owner_id,track_id,last_version) VALUES(NEW.owner_id,NEW.track_id,1)
 ON CONFLICT(owner_id,track_id) DO UPDATE SET last_version=studio_artist_version_counters.last_version+1 RETURNING last_version INTO n;
 NEW.version_label='Mix v'||CASE WHEN n<10 THEN '0' ELSE '' END||n::text;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_assign_preview_version ON studio_artist_previews;
CREATE TRIGGER studio_assign_preview_version BEFORE INSERT ON studio_artist_previews FOR EACH ROW EXECUTE FUNCTION studio_assign_preview_version();
CREATE OR REPLACE FUNCTION studio_preview_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('emme.restoring',true)='1' THEN RETURN NEW; END IF;
 IF NEW.status IN ('ready','approved','revision_requested') THEN
  IF NEW.purged_at IS NOT NULL THEN RAISE EXCEPTION 'PREVIEW_PURGED'; END IF;
  NEW.superseded_at=NULL;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_preview_lifecycle ON studio_artist_previews;
CREATE TRIGGER studio_preview_lifecycle BEFORE INSERT OR UPDATE OF status ON studio_artist_previews FOR EACH ROW EXECUTE FUNCTION studio_preview_lifecycle();
-- Remove metadata history with an explicitly deleted portal preview, never the Drive file.
CREATE OR REPLACE FUNCTION studio_delete_preview_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM studio_artist_preview_events WHERE owner_id=OLD.owner_id AND preview_id=OLD.id;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS studio_delete_preview_history ON studio_artist_previews;
CREATE TRIGGER studio_delete_preview_history BEFORE DELETE ON studio_artist_previews FOR EACH ROW EXECUTE FUNCTION studio_delete_preview_history();
CREATE TABLE IF NOT EXISTS studio_artist_notification_reads (
 owner_id text NOT NULL, notification_id uuid NOT NULL REFERENCES studio_artist_notifications(id) ON DELETE CASCADE,
 user_id text NOT NULL, read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,notification_id,user_id)
);
CREATE TABLE IF NOT EXISTS studio_artist_email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL,
 notification_id uuid NOT NULL REFERENCES studio_artist_notifications(id) ON DELETE CASCADE,
 recipient_email text NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','uncertain')),
 attempts integer NOT NULL DEFAULT 0, error text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(notification_id,recipient_email)
);

CREATE OR REPLACE FUNCTION studio_mark_superseded_artist_previews() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('emme.restoring',true)='1' THEN RETURN NEW; END IF;
 IF NEW.status = 'ready' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'ready') THEN
  UPDATE studio_artist_previews
   SET superseded_at=now(),status='withdrawn',updated_at=now()
   WHERE owner_id=NEW.owner_id AND artist_id=NEW.artist_id AND track_id=NEW.track_id
     AND id<>NEW.id AND status IN ('ready','approved','revision_requested')
     AND superseded_at IS NULL AND purged_at IS NULL;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION studio_lock_artist_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fid text;
BEGIN
 IF current_setting('emme.restoring',true)='1' THEN RETURN NEW; END IF;
 fid=CASE WHEN TG_TABLE_NAME='studio_artist_previews' THEN NEW.drive_file_id ELSE NEW.file_id END;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_id||'/'||fid,9723187));
 IF EXISTS(SELECT 1 FROM studio_artist_previews WHERE owner_id=NEW.owner_id AND drive_file_id=fid AND purged_at IS NOT NULL) THEN RAISE EXCEPTION 'PREVIEW_FILE_PURGED'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_lock_artist_file ON studio_artist_previews;
CREATE TRIGGER studio_lock_artist_file BEFORE INSERT OR UPDATE ON studio_artist_previews FOR EACH ROW EXECUTE FUNCTION studio_lock_artist_file();
DROP TRIGGER IF EXISTS studio_lock_artist_file ON studio_artist_deliveries;
CREATE TRIGGER studio_lock_artist_file BEFORE INSERT OR UPDATE ON studio_artist_deliveries FOR EACH ROW EXECUTE FUNCTION studio_lock_artist_file();
