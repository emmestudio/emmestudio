CREATE TABLE IF NOT EXISTS studio_news (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 slug text NOT NULL UNIQUE, title text NOT NULL, excerpt text NOT NULL,
 category text NOT NULL CHECK (category IN ('Studio','Label','Uscite','Live')),
 body text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 featured boolean NOT NULL DEFAULT false, publication_date date NOT NULL DEFAULT CURRENT_DATE,
 cover bytea, cover_type text, related_label text NOT NULL DEFAULT '', related_url text NOT NULL DEFAULT '',
 media_url text NOT NULL DEFAULT '', first_published_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_news_public ON studio_news(status,publication_date DESC);
CREATE INDEX IF NOT EXISTS studio_news_owner ON studio_news(owner_id);
