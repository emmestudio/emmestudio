-- Additive: persist small attachments with owner's private mail drafts.
-- Requires one manual run on Neon main before attachments can persist.
ALTER TABLE studio_mail_drafts
 ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN studio_mail_drafts.attachments IS 'Private draft attachments, base64. Limit 2 MiB total via API.';
