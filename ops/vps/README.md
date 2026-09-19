# StreamCore VPS migration

## Current stage

Validated on 2026-09-15:

- Backend DNS and TLS: `streamcore-api.legacynerxux.online`.
- Encrypted full Supabase export copied to the protected Windows backup folder;
  VPS and PC SHA-256 checksums match, and full decryption succeeds.
- Application tables restored into isolated `streamcore_migration_stage`:
  11 tables, 191 listed creators, 3,147 posts, 58,873 Twitch observations.
- Eight table counts and content hashes match the current source exactly.
  Posts, observations and integration settings drifted while production stayed
  live. Re-export/synchronize under a write pause before cutover.
- This stage intentionally omits constraints, indexes, functions, triggers,
  policies and Supabase-managed auth/storage. It is NOT a production backend.
  Do not grant the application public access to this staging database.
- Existing Supabase authentication will remain the identity provider during
  the initial application-data migration; media remains a separate migration.
- No production URLs, schedulers or writes have been switched.

Additional staging work:

- All 46 public media objects copied to `/opt/streamcore/media`; sizes and
  SHA-256 hashes checked against the downloaded bytes (33,347,331 bytes).
  Recovery manifest is root-only. Source media URLs remain unchanged.
- Private `streamcore-api` systemd service runs at `127.0.0.1:4100` with
  writes disabled and restricted database access.
- Post mutations use row locks; reaction toggles and shares are per-account.
  Comments use the authenticated identity, never a supplied author ID.
- Raw media upload route accepts limited media types with signature checks;
  maximum 64 MB. Staging blocks all writes, including uploads.
- Persistent post event trigger tested inside a rolled-back transaction.
  Event-stream handshake works. Committed delivery/replay still requires an
  integration test before acceptance.
- Twelve local permission/mutation/media tests pass. Frontend build passes.
- The disabled VPS transport is integrated into initial feed loading, older
  general-chat pagination, post mutations, uploads and post events. Welcome
  announcements, reply-notification lookups, ranking post reads and onboarding
  engagement reads now use VPS paths when enabled. Production flags are unset.
- Duplicate post-event/HTTP-response counts are guarded. Fabricated browser
  reactions are disabled on the VPS path; real authenticated reactions remain.
- Latest API staging routes are deployed privately with writes disabled. Local
  health and engagement aggregation return 200; an unauthenticated AI job
  request returns 401. These are NOT authenticated acceptance tests.
- Browser admin session recovered. Real Supabase bearer authentication against
  `/v1/session` passed (200, admin and approved). Authenticated staging lifecycle
  passed: create 201, edit 200, reaction 200, persisted content/reaction read 200,
  delete 200 and subsequent read 404. Disposable test posts were removed.
- Staging writes were enabled only for the lifecycle tests with the activity
  worker disabled, then disabled again. Public TLS proxy now reaches the staging
  API; the production frontend still uses Supabase and production flags are unset.
- Approved non-admin and pending-member acceptance tests are still outstanding,
  as are event replay, upload serving, final synchronization and full job cutover.
- Latest consistent source snapshot synchronization passed exact row counts and
  whole-row checksums: 3,575 posts, 61,712 Twitch observations, 1,880 metric
  snapshots. Source stayed live, so these are snapshot matches, not the final
  frozen-production acceptance check.
- Added VPS live collector and ranking worker (existing formulas compiled
  unchanged), job locks/state, observation uniqueness and ranking indexes.
  API staging remains disabled. Live collector acceptance currently fails
  because local Twitch values are placeholders, not real provider credentials.
- Vercel browser is signed in and has production provider secrets. Vercel CLI
  is not authenticated; authorization was requested to obtain the production
  configuration and deploy. Do not enable workers or frontend flags yet.

Remaining engineering before production cutover:

1. Profiles, roles, creator management, invites and onboarding stay on Supabase
   per the user's narrowed scope. Audit their remaining post-related workflows
   for VPS routing; do not migrate these account tables into production VPS use.
2. Wire every application read/write and subscription; remove old database
   writes rather than leaving per-screen fallback paths.
3. Migrate ranking aggregation, Twitch observations, email queue and one AI
   worker. Secure provider credentials; stop source cron at cutover.
4. Restore required constraints/indexes; grant only endpoint-required access.
5. Serve migrated media and uploads securely; update stored media references.
6. Authenticated end-to-end tests including admin, approved member, pending
   member, visitor, reconnect and refresh persistence.
7. Write pause, final export/reconciliation, activate VPS writes and deploy the
   frontend together. Preserve source snapshot and reconcile any rollback writes.

The bootstrap prepares a private PostgreSQL database on the existing VPS. It
does not replace Supabase, move production traffic, or start another activity
worker. Run it once as root after inspecting it:

```sh
bash bootstrap-database.sh
```

Runtime credentials stay in `/opt/streamcore/private/database.env` (root-only).
The database role is not a superuser and PostgreSQL must remain loopback-only.
Do not commit runtime credentials or include them in terminal logs.

## Required before cutover

1. Confirm a backend DNS hostname and configure TLS through the existing Caddy
   service without editing unrelated app routes.
2. Confirm an encrypted off-server backup target, credentials and retention.
   A backup on the same VPS is not disaster recovery. Perform an isolated
   restore test before moving production.
3. Implement authenticated API ownership/admin checks using existing Supabase
   identities; retain account IDs and onboarding permissions.
4. Import and reconcile community posts, creator records, settings, invites,
   ranking observations and media references. Verify counts and identifiers.
5. Move feed reads/writes and incremental chat delivery to the VPS; avoid
   falling back to Supabase writes after cutover, which would split data.
6. Move the activity scheduler to one locked worker. Stop the old browser
   ticker and database cron at the same cutover to prevent duplicate posts.
7. Keep Supabase data intact as a read-only migration snapshot until acceptance.
   Rollback after new VPS writes requires reconciling those writes, not merely
   switching the URL back.

Moving only the API runtime does not reduce Supabase database egress. Production
chat queries and storage must actually move, with bounded pagination and
incremental events. Media migration is separate from database migration.
