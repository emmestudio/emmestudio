CREATE TABLE IF NOT EXISTS studio_form_documents (
 id uuid PRIMARY KEY,owner_id text NOT NULL REFERENCES "user"(id),template text NOT NULL CHECK(template='studio-services-v1'),
 title text NOT NULL,state text NOT NULL CHECK(state IN('draft','ready')),payload jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,id)
);
CREATE TABLE IF NOT EXISTS studio_form_history (
 document_id uuid NOT NULL REFERENCES studio_form_documents(id) ON DELETE CASCADE,version integer NOT NULL,payload jsonb NOT NULL,state text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(document_id,version)
);
CREATE INDEX IF NOT EXISTS studio_forms_owner_updated ON studio_form_documents(owner_id,updated_at DESC);
