# Area Artista — release gate
This branch must not be merged into the production branch until all release gates are checked.

## Automated gates
- `node --experimental-strip-types --test test/artist-access-policy.test.mjs` passes in CI.
- `node test/artist-area-db.integration.mjs` passes in isolated PGlite; no production data used.
- `npm run build` passes in CI and Vercel preview.

## Required pre-release functional gates (not covered by current CI)
1. Back up PostgreSQL and confirm restoration. Apply migrations 013, 014 and 015 to a **separate staging database**, not the operational database.
2. Configure staging Better Auth URL, Google OAuth redirect URI and Drive consent; use dedicated Google test account owned by the studio.
3. Create Artist A and Artist B, each with different verified Google addresses; enable each via the artist record, confirm login, change Artist A email, disable A, confirm all A routes reject A's old session.
4. Publish a dedicated MP3 preview under Artist A's track; confirm A plays it, B cannot access the endpoint by guessing its UUID, and drafts and withdrawn previews cannot play.
5. Trigger revision and approval on A; verify only its own track is changed and the admin sees the feedback.
6. Register a non-sensitive test WAV deliverable for A: initial download must fail; toggle authorization on and confirm download; disable and confirm download fails again; B must always fail.
7. Verify Drive cannot be reached through public file links; use separate preview copies. Streaming cannot prevent a determined listener from recording audio.
8. Complete desktop/mobile checks, validate site navigation, run a staged restore, and review privacy text and retention for artist emails and feedback.

## Restrictions
- Never enable global public Google Drive link sharing as part of the artist area.
- Never merge or promote the preview branch based only on a successful build.
- Studio and artist roles must stay separate, with permission checks performed on every protected request.
- Artist authentication and music preview should use a test project until sign-off.
