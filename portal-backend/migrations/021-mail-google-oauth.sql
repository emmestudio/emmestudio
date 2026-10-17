-- Gmail OAuth connection metadata; encrypted credentials are stored server-side.
-- Apply only to a staging Neon branch after migration 020.
CREATE TABLE IF NOT EXISTS studio_mail_google_credentials (
 account_id uuid PRIMARY KEY REFERENCES studio_mail_accounts(id) ON DELETE CASCADE,
 owner_id text NOT NULL,
 encrypted_refresh_token text NOT NULL,
 google_subject text NOT NULL,
 scopes text NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_mail_google_credentials_owner ON studio_mail_google_credentials(owner_id);
