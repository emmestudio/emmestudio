ALTER TABLE studio_artists
  ADD COLUMN IF NOT EXISTS label_roster boolean NOT NULL DEFAULT false;

ALTER TABLE studio_form_documents ADD COLUMN IF NOT EXISTS work_id uuid;
CREATE INDEX IF NOT EXISTS studio_forms_artist_updated
  ON studio_form_documents(owner_id, (payload #>> '{draft,artistId}'), updated_at DESC);

CREATE TABLE IF NOT EXISTS studio_form_signatures (
  document_id uuid NOT NULL,
  version integer NOT NULL,
  signed_on date NOT NULL,
  evidence_url text NOT NULL DEFAULT '',
  PRIMARY KEY(document_id, version),
  FOREIGN KEY(document_id, version)
    REFERENCES studio_form_history(document_id, version) ON DELETE CASCADE
);
