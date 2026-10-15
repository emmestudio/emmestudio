# Collegamento email: checklist di staging

## Gmail
- Register a Google OAuth web application with separate Gmail credentials, not the existing portal-login OAuth client.
- Add exact redirect URI: `https://portal.emmestudioproduction.it/api/mail/google/callback` (use the staging URL when testing in staging).
- Store `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, and `MAIL_TOKEN_ENCRYPTION_KEY` (64 hexadecimal characters = 32 random bytes) only as server-side environment secrets. No client-side `NEXT_PUBLIC_` prefixes.
- Gmail read/send scopes require review of Google's verification and restricted-scope requirements before use with real accounts. Consult current Google policy and test on a permitted test user first.
- Apply migrations 020 and 021 on an isolated Neon branch, **not production**, until the feature is ready.
- Register the Gmail address under Posta, then click 'Autorizza Gmail'. The OAuth callback verifies the selected mailbox email, stores an encrypted refresh token, and marks the account connected only on success.
- No Gmail message listing or sending has yet been implemented. A 'connected' status only establishes authorization, not a successful read/send test.
- The mailbox will remain owner-only. Revoke the Google consent from Google Account settings if needed; future disconnect UI will also invalidate local access.

## Aruba
- Confirm if the mailbox is standard Aruba email or PEC; PEC needs a separate workflow.
- Determine hostnames and required IMAP/SMTP ports from official Aruba mail settings for the specific service.
- Implement server-side credential vault plus an explicit connection test; no passwords in repo, database plaintext, or chat.
- The current Aruba address registry is deliberately **not** a live connection.

## Release gate
- No production merge or Vercel deployment while quota is exhausted.
- Validate Next.js compilation, session permission paths, OAuth state mismatch/expiry, address mismatch, token-encryption recovery, and user-approved test accounts before a live connection.
