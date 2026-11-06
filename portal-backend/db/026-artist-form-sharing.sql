ALTER TABLE studio_artist_notifications ALTER COLUMN track_id DROP NOT NULL;
ALTER TABLE studio_artist_notifications DROP CONSTRAINT IF EXISTS studio_artist_notifications_event_type_check;
ALTER TABLE studio_artist_notifications ADD CONSTRAINT studio_artist_notifications_event_type_check
  CHECK (event_type IN ('message','preview','approval','revision','delivery','document'));

CREATE TABLE IF NOT EXISTS studio_artist_form_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  artist_id uuid NOT NULL,
  document_id uuid NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  requires_signature boolean NOT NULL,
  email_job_id uuid REFERENCES studio_artist_email_outbox(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  signed_pdf bytea CHECK (octet_length(signed_pdf) BETWEEN 5 AND 4194304),
  UNIQUE (document_id, version),
  FOREIGN KEY (owner_id, document_id) REFERENCES studio_form_documents(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (document_id, version) REFERENCES studio_form_history(document_id, version) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS studio_artist_form_shares_inbox
  ON studio_artist_form_shares(owner_id, artist_id, published_at DESC);
