# Family-owned storage, Google authorization and independent recovery

**2026-10-19 product direction:** no application-managed end-to-end encryption, private family content keys, device decryption envelopes or recovery kits. This replaces the old E2EE design. Require HTTPS/TLS, provider-managed encryption at rest, strong Google sign-in **plus** explicit family invitation and per-operation authorization. [Security contract](../SECURITY_PROMISE.md).

## Who handles information

- **Being There project:** publishes source and fictional demonstrations; never receives or handles other families' photos, stories, identities, Drive tokens, backups, logs or ciphertext.
- **Family installation:** family-owned backend and app serve properly authenticated and authorized users; the backend can access readable stored data to perform approved work. It must deny uninvited and revoked users on all private API routes.
- **Google identity:** proves an account is signed in. The Google subject is the durable identity. It does **not** grant access to someone else's family or Google Drive.
- **Family authorization:** organizer-issued, verified-email-bound, single-use, expiring invitations create membership only after intended-recipient acceptance. Per-family roles, active membership and record scope control requests. Revocation blocks subsequent access.
- **Google Drive:** organizer explicitly grants a separate, narrowly scoped OAuth consent for the family-owned archive. Refresh tokens stay in the private family server's secret storage, never in browser responses, git or Being There infrastructure. Each Drive operation is allowed only after validating an active session, family membership and operation-level permissions. A backend can use the organizer's authorized Drive connection for invited contributors; individual contributors need not each configure Google Drive OAuth.
- **Host and provider:** Google and a selected hosting provider encrypt at rest under their policies; TLS protects transport. Providers and sufficiently privileged administrators might access readable data. This is not E2EE or zero knowledge.

## Readable, durable family records

Do not modify, encrypt or delete existing source files in place. Put new photos, recordings and stories into a family-controlled, human-understandable archive. Preserve originals and provenance; back up *new* recordings and associated database/index metadata, which may exist nowhere else.

Keep at least two verified independent copies, with versioned recovery points. A sync copy on the same account or disk may propagate deletion; test restoring original bytes and stories on a fresh host. Backup/restore must not need Being There-specific encryption keys or access to maintainers. Provider account recovery and safe storage of its credentials are still the family's responsibility.

## No unauthorized Google Drive API invocations

1. Anonymous or Google-signed-in-but-uninvited callers may reach public landing/login pages but never read private records or invoke Drive data operations.
2. A newly invited recipient may preview/accept only their own invitation *before* membership; that path does not touch Drive media.
3. An active member's API request is authenticated and role/scope-authorized **before** getting Drive tokens, enqueueing tasks, listing, downloading, uploading, deleting or generating previews.
4. No public Drive file links or anyone-with-link sharing. No CDN/shared cache for private media, including HEAD, Range and optimized variants.
5. Revocation takes effect immediately for future requests; asynchronous jobs require explicit bounded authorization independent of a stale user session. Revocation cannot erase content already downloaded by an authorized person.
6. Test unauthorized paths using a fake Drive adapter and assert **zero provider invocations**. Include identity spoofing, invitation replay, wrong-family file IDs, revoked accounts, bad CSRF, expired sessions, streaming and restore endpoints.

## Release status

The current technical preview has a Node/SQLite app and Google sign-in but **no native Drive adapter**, verified Cloudflare deployment or completed independent provider/security acceptance. Do not deploy real family media until those gates pass. See [Google integration](GOOGLE.md), [roadmap](../DEPLOYMENT_ROADMAP.md), and [no custody](../NO_CUSTODY.md).
