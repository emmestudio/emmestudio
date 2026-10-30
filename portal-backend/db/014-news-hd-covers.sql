CREATE TABLE IF NOT EXISTS studio_news_cover_uploads (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 total integer NOT NULL CHECK(total>0 AND total<=31457280), received integer NOT NULL DEFAULT 0,
 mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
 bytes bytea NOT NULL DEFAULT '\x', expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE INDEX IF NOT EXISTS studio_news_cover_uploads_expiry ON studio_news_cover_uploads(expires_at);
