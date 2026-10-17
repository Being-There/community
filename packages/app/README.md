# Being There — private family workflow candidate

More meaningful moments together. No pressure to remember.

This **pre-release advanced-host reference** connects invite-only family access, multiple people, original photos, separate text/audio stories, recording recovery, responsive image variants and verified portable recovery. It has automated synthetic integration/browser evidence. It has **not** completed a real Google-account pilot, independent security/accessibility review or a nontechnical installation trial. Do not upload family data to an unreviewed deployment.

## Family experience

A family organizer receives a private invitation from their own operator, signs in with the intended Google account, reviews the family/access scope and accepts. They add people, invite contributors and share a photo. People may simply enjoy it, listen, add a separate story or move on. Simple view reduces the controls; it grants no permissions. Profiles never grant login access.

Ordinary invitees never configure hosting, databases, DNS or credentials. A technical steward currently provisions and maintains the independent instance. A verified no-technical-operator installer is still a separate roadmap gate, not a capability of this reference.

## Advanced host prerequisites

- Linux, Node.js 22.13+ or Node 24, npm, persistent private disk and a real HTTPS reverse proxy.
- Family-owned Google OAuth web-client ID/secret and an exact registered callback `https://YOUR-HOST/auth/google/callback`.
- Private directories owned by the service account, mode 0700. Restrict the Node listener to loopback; configure the HTTPS proxy to preserve the exact configured Host and enforce abuse/request limits. Do not trust client forwarding headers.
- This first invitation adapter accepts provider-authoritative verified Gmail/Google Workspace addresses. Other Google-associated email providers need another verified recipient-binding path before invitation support can be promised.

From this package directory:

```sh
npm ci --omit=dev --ignore-scripts
# Set APP_ORIGIN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and DATA_DIR securely.
# Optional ORIGINALS_DIR points to a separately backed-up private directory.
npm run family:start
```

No credentials, central Being There service, paid AI or sample production accounts are supplied. Missing credentials fail startup; there is no test-login bypass. Keep secrets outside source/history and never print them in logs.

Provision the first private organizer invitation through the local operator command, using the same private DATA_DIR and HTTPS APP_ORIGIN:

```sh
npm run family:operator -- invite-organizer FAMILY_ID ORGANIZER_EMAIL
```

This explicitly creates the family and a seven-day, one-use organizer invitation bound to the intended verified recipient. The printed link is private; share it only with that person. No first-visitor-wins administrator exists. Contributors can read/add within their scope; only organizers invite, revoke or export. Last-organizer revocation is blocked.

## Import photos from a folder

The trusted host operator can point Being There at an existing mounted or synced folder, including Google Drive, a NAS, or a local drive. Create a person profile first, then from the app directory:

```sh
DATA_DIR=/private/being-there npm run family:import -- FAMILY_ID PROFILE_ID /mounted/photos
```

The importer works recursively on static JPEG/PNG/WebP, creates optimized views, preserves exact originals independently and leaves every input file untouched. Repeated imports skip identical photos. The command needs filesystem access to the **private** family database; it is not a public endpoint or a substitute for login. It does not authenticate to Google Drive, install a sync client, monitor folders automatically, or support HEIC/video yet. Importing the same picture with a new profile association requires an explicit edit rather than silently changing the old association.

## Original preservation and recovery

Uploads commit metadata and exact originals transactionally to SQLite with full synchronization. Before success is acknowledged, plain originals and a new versioned metadata snapshot are also flushed under `ORIGINALS_DIR` (default `DATA_DIR/original-archive`):

`FAMILY_ID/contributors/CONTRIBUTOR_ID/originals/ORIGINAL_ID`

and `FAMILY_ID/snapshots/SNAPSHOT_ID.json`.

Contributor names/relationships are in the snapshots. Originals are immutable; derivatives are replaceable and excluded from recovery requirements. Different stories keep different original recordings and attribution. Original capture metadata is preserved with the original file; do not share those files publicly.

The local archive is independent of the application database. **A second folder on the same disk is not a disaster backup.** The operator must maintain a separate family-owned copy, storage monitoring and a tested recovery procedure. Direct Google Drive API ingestion/synchronization is not wired into this first reference; mounted/synced Drive folders can be imported with the operator command above. No background offsite backup is claimed.

An organizer with a fresh sign-in may download a checksum-verified private JSON archive from Family tools. Treat it as private family data; it is not encrypted by the application. Store/transfer it only using reviewed family-controlled encrypted storage. Exports are generated in memory without temporary server export files. A minimal export-prepared event stays in the private DB; read activity is not tracked.

To recover into a **new** family ID with no imported accounts/sessions/invitations:

```sh
npm run family:operator -- restore NEW_FAMILY_ID PRIVATE_EXPORT_JSON
# An independent original-archive snapshot path is also accepted as the source.
```

The command refuses an existing destination. After independently verifying authority over the restored family, the operator can explicitly issue a new organizer invitation:

```sh
npm run family:operator -- invite-recovery-organizer NEW_FAMILY_ID ORGANIZER_EMAIL
```

Never restore provider credentials or infer identities from contributor names. Restored content is denied to existing sessions until access is explicitly re-established. Record the snapshot/source and restore result privately. If a commit succeeds but an independent archive flush fails, the request fails without a durable acknowledgment; retrying the same contribution ID is safe. Do not delete local pending recordings merely because a request was sent.

## Limits and unfinished release gates

Photos: static JPEG/PNG/WebP, 40 megapixels, approximately 14 MiB source limit. Originals stay exact; three WebP variants reuse the 640/1280/2560 policy and never upscale. Microphone access starts only after an explicit recording action. Audio originals support WebM/Opus, MP4 or WAV within the bounded request size. The server does not transcribe or interpret stories. Preserve a long/failed recording locally; this first transport is not a proven unlimited-duration recorder. Browser storage/quota or device loss can affect local recovery; a temporary in-page copy must be sent before closing if local storage fails.

Metadata lists and story lists are bounded (10,000/100); large-family pagination remains work. Media reads verify bounded complete objects before slicing ranges; streaming large collections is not proven. Core archives are capped at 256 MiB and reject unsupported richer fields instead of silently dropping notes/reactions/dates/preferences/consent metadata. This is not yet a complete exporter for a richer legacy application. Account linking, fine-grained invitation scopes, transcription, graph UI, reactions, retained-item management and guided provisioning remain outside this first workflow.

Before a family-ready release: real provider callback/reauthentication and independent accounts/storage trial; independent security review; screen-reader and nontechnical-family testing; deployment/backup/export-lifecycle review; exact public diff/provenance/license signoff and verified destination branch enforcement. Automated synthetic checks do not satisfy these human/provider gates.

## Developer verification

```sh
npm ci --ignore-scripts
npm run check
node scripts/recovery-drill.mjs
npx playwright install chromium --only-shell
npm run test:browser
```

Browser acceptance uses synthetic, locally signed test tokens, a temporary local HTTPS certificate and Chromium's fake audio device. It exercises the actual maintained Google JWT verifier against test keys, not a real Google-account sign-in. The fake verifier/certificate wiring exists in test code only; no test sign-in endpoint ships in the app. No real family content or microphone is used.

Read [TENETS.md](TENETS.md) and [AGENTS.md](AGENTS.md). Licensed under [Apache License 2.0](LICENSE); native/third-party dependencies carry their own licenses. Publication remains a separate maintainer decision.
