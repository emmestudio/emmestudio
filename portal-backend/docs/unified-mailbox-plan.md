# Posta unificata — Emme Studio

## Objective
One inbox interface, two selectable sending identities (Aruba domain mailbox, Gmail/Google Workspace), each with its own incoming/sent/drafts data. Messages must never cross accounts inadvertently.

## Integration
- Gmail: Google OAuth consent with minimum necessary Gmail scopes, separate from existing Google Drive OAuth. Never reuse the Drive access token as a Gmail credential. Google mailbox access requires explicit connection and consent.
- Aruba: IMAP over TLS to read/synchronize messages, SMTP over TLS to send. Configure provider host/ports only after checking actual Aruba mailbox settings and email service type. Credentials must be stored encrypted in a managed secret store, never in the application database as plain text, browser state, GitHub or logs.
- Production functionality is blocked until each account is connected and tested. UI must display the real connection state, not imply readiness.
- Avoid mailbox polling during every page visit; sync per account with cursor/UID strategy, throttling and error states.
- When sending, explicit From selector, recipient confirmation, sending result and provider message ID; do not optimistically label email as sent.
- Attach PDF quotation from an existing finalized/versioned quote only after validating its owner, authorization and exact revision. Attachment must be generated server-side, with size limits. Do not leak arbitrary Drive IDs.
- Search artists/prospects as optional recipients; do not mass-send or create marketing campaigns without explicit consent and legal checks.
- Store app drafts in `studio_mail_drafts`; actual provider sent messages remain authoritative. Never store account passwords/OAuth tokens in these tables.
- Separate inbox, sent, draft and archived views by provider and offer unified filtering. Email content is untrusted HTML: sanitize before displaying; no automatic remote image loading.
- Only studio owner is granted mailbox access initially; add team permissions later only with explicit roles and audit trail.
- Do not connect or send emails during a code deployment. Connection and sending require an explicit action.

## Finance/delivery integration
Finance ledger already stores quote cents, installments and nonvoid payments by project/production target. Display balance near track deliveries based on correct finance target resolution; do not duplicate balances into mailbox tables. Downloads must remain manually authorized, even after the balance reaches zero.

## Release sequence
1. Schema 020 on an isolated Neon branch, migration verified.
2. Provider connection settings (Gmail OAuth and Aruba secured server-side configuration).
3. Read-only unified inbox; provider send/reply; drafts and attachments.
4. Client-facing quote PDF attachment and artist/profile linking.
5. End-to-end tests with both real accounts and safe test recipients.
6. Only then merge feature branch and deploy once within Vercel quota.
