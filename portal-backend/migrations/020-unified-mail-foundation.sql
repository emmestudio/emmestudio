-- Unified mailbox account registry. Do not store IMAP passwords or OAuth tokens here.
CREATE TABLE IF NOT EXISTS studio_mail_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('aruba','gmail')),
 address text NOT NULL,
 display_name text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'not_connected' CHECK(status IN ('not_connected','connected','attention')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,address)
);
CREATE INDEX IF NOT EXISTS studio_mail_accounts_by_owner ON studio_mail_accounts(owner_id,provider);
-- Local drafts are never sent until an explicitly authorized delivery action exists.
CREATE TABLE IF NOT EXISTS studio_mail_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 account_id uuid REFERENCES studio_mail_accounts(id) ON DELETE SET NULL,
 recipient text NOT NULL DEFAULT '',
 subject text NOT NULL DEFAULT '',
 body text NOT NULL DEFAULT '',
 quote_project_id uuid,
 quote_version integer,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_mail_drafts_by_owner ON studio_mail_drafts(owner_id,updated_at DESC);
