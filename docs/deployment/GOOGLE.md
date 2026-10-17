# Google Sites and Google Drive: optional, family-owned integration

**Status: design, not implemented.** The current Community application is a Node.js/SQLite server with a private filesystem archive. Neither a native Google Drive write-through storage adapter nor a Google Sites-hosted version is shipped. Current import works from a host-mounted/synced folder, not by connecting directly to the Drive API.

## Separate the three choices

- **Open the app:** direct HTTPS app URL (recommended, especially on tablets), a Google Sites page linking to the app (supported by Google Sites without an app change), or an optional *tested* full-page embedded app (not yet supported/approved by this project).
- **Run the app:** AWS-owned server, future family-owned home server/NAS, or another supported host. Google Sites does **not** run the existing Node/SQLite API, securely persist sessions, process recordings or replace hosting.
- **Store family data:** private local/NAS, Amazon S3, Google Drive, or other tested connectors, through a portable data interface. These are choices, not constraints on the hosting or identity provider. A family should not need AWS just to choose Drive, or Google Drive to use Google sign-in.

**Core privacy rule:** The Being There server authorizes every private read/write; Sites visibility and Drive sharing links are *never* an alternative to family invitations. Google Sites pages may be public or shared beyond the family, so never embed or publish raw private Drive photo/audio/video URLs.

## Google Sites: start simple

Google Sites can embed external URLs as pages or sections, but the destination must permit framing. Our app currently uses its own HTTPS session cookies and anti-clickjacking protection; blindly permitting all iframes would be a privacy regression. Third-party-cookie restrictions and OAuth redirects can also break login in embedded frames.

**Recommended default:** Family adds a clear **Open Being There** link to an existing Google Site. It opens the app directly with the full-screen Family/Tablet UI, working login, upload and microphone permissions. No extra API credentials or project-owned publishing access. This is already possible once the family has its own private hosted app URL.

**Optional later:** A verified full-page iframe mode *only* for owner-approved, exact site origins, with CSP `frame-ancestors` allowlist, secure cookie/OAuth and accessibility/mobile/microphone acceptance tests. Test Safari and Chromium, third-party-cookie blocking, domain changes, and Sites access changes. Fail closed and offer the direct link. No general `frame-ancestors *` or public iframe endpoint.

## Google Drive: make storage owner-visible and portable

The family selects a **regular, visible Drive folder** for originals/backups, not Google's hidden `appDataFolder`: it is not suitable as the principal family-visible archive and is not designed for shared family folders. Organize originals by family, contributor and immutable ID, and store checksummed manifest/snapshot files that can be copied out of Drive without the app. Meaningful readable folder hierarchy is fine, but avoid putting a diagnosis, family identity or confidential story text into public link names/URLs.

Suggested layout (illustrative, not a shipped writer):

```text
Being There (private folder chosen by owner)/
  family-export-manifest.json
  families/<opaque-family-id>/
    contributors/<opaque-contributor-id>/
      originals/<opaque-original-id>
    snapshots/<sequence>-<opaque-snapshot-id>.json
```

The family can browse/manage the folder in Drive; access should be granted only to the owner-selected Google identity or an owner-administered Workspace shared drive. **Do not make media shareable to anyone with a link.** Family contributors upload/play through the *authorized app API*, not by requiring every contributor to have direct Google Drive permissions.

### Connection and credentials

1. Organizer opens **Storage settings → Google Drive → Connect** in their **private Being There instance**.
2. Grant limited access, ideally `drive.file` plus Google Picker selection of an owner-chosen folder, to a Google OAuth client that the family understands and controls. Google API app verification/consent rules and file-selection restrictions are design gates; no claim of zero-setup OAuth yet. For a self-hosted installation, a family-owned OAuth client is always an option; an audited shared public client would need a separate trust/verification analysis and must **not** send user Drive tokens to Being There maintainers.
3. Store **refresh tokens only in the family-owned app secret store** with restricted access/rotation. Tokens are never placed in the public repo, browser local storage, Stack outputs, logging, Sites or a Being There cloud service.
4. Display the folder, account identifier, quota warnings, last remote checksum verification, permission/reauthorization errors and clear **Disconnect**/export behavior. Disconnecting integration must not erase family originals without a separate explicit destruction workflow.
5. Keep sign-in/identity separate from Drive storage authorization: a Cognito-authenticated family can still connect the organizer's Drive storage; Google login does not grant the app all Drive access automatically.

**Scope limitations:** `drive.file` gives app-created/selected-file access; use official file picker and test real folder selection, descendants, app-created files, readback, export and shared-drive behavior. Avoid requesting broad restricted `drive` scope. Google may require verification of an OAuth app. Do not use a headless service account as a magical shortcut to access an arbitrary personal Drive.

### Safe incremental delivery

**Phase G1 — Drive off-device archive (near-term):** Preserve the current local SQLite write model and private originals; add opt-in background export of immutable originals and manifests to the selected Drive folder. Verify bytes/hashes and recording/story metadata before reporting the backup as verified. Durable export includes replayable copy of originals and an archive snapshot. The initial copy is a **backup**, not an always-live storage replacement. Retries are idempotent; handle intermittent quota, revoked token, deleted folder, network and permission errors. Ensure the family can export the Drive folder and restore on a clean non-Google instance.

**Phase G2 — Native Drive as selected originals/archive destination (later):** Introduce a small, provider-neutral **OriginalArchiveStore** contract (`writeImmutable`, `readExact`, `listSnapshots`, `verify`, `recover`) and adapters for local filesystem, Drive, and S3. Keep SQLite as runtime metadata/index initially; use a recovery manifest that restores a fresh SQLite database without the old host. If Drive is the authoritative off-host originals store, do not report a new original as durably archived until Drive readback/hash and manifest commit succeed. Document offline behavior and recovery of pending uploads. Google Drive API consistency/permission semantics are not SQLite transactions; explicit two-phase/idempotent write and failure injection are required. No claim of exactly-once distributed transactions.

**Phase G3 — Beginner install surface:** A Google-first guided setup can pair the selected family Drive folder with a separately hosted minimal app backend. Evaluate concrete, low-maintenance hosting (such as an explicitly priced VM or family-administered service) against secure SQLite persistence; **do not** claim Google Sites, Apps Script, or ephemeral Cloud Run alone runs the existing app without a rewrite. Separate this from the AWS quick-create milestone so users can mix host and storage providers.

## Acceptance tests

- Shared memory with no person tag, several contributors and a named storyteller uploads; Drive archive exports exact original media bytes and metadata snapshots; restore onto a **different** host reproduces content without restoring access tokens or session grants.
- Outside/invited-not-in-family identities denied through the app API; anonymous Google Sites visitors see **no** private content.
- Revoke Drive OAuth credentials while app runs; verify blocked/offline backup status without data destruction or false success.
- Tamper with/delete a Drive original; verify checksums fail and restore never silently substitutes the wrong file.
- Upload interruption, retry, quota exhaustion, duplicate content, token expiry, folder deleted/moved/re-shared, Google Drive rate limiting and incomplete snapshots must be handled explicitly.
- A family may migrate Drive → local/NAS or S3 → Drive with complete manifest and original-byte checks, without dependence on Being There servers.

### Authoritative product references

- [Google Sites: embed external pages or links](https://support.google.com/sites/answer/90569)
- [Drive API scopes, Google Picker and `drive.file`](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Why Drive `appDataFolder` is not a visible family archive](https://developers.google.com/workspace/drive/api/guides/appdata)
