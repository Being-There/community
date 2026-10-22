# Being There Community — family-owned deployment roadmap

**Target:** Google-first experience without project custody, user-managed content keys or Being There-only recovery steps. Default identity is Google sign-in; hosting can be the family's Cloudflare account or another supported family-owned host; Google Drive is the preferred owner-held archive.

**Not shipped:** v0.1.0 currently uses Node/SQLite plus a family-owned Google OAuth client; it has no native Cloudflare Workers/Pages runtime adapter or native Google Drive connector, and is not verified for real family data. Use synthetic content until required security, provider and recovery gates are complete.

## Family journey

1. Organizer follows a guided installer to create a **private instance in their own provider account**; creates/authorizes their own Google OAuth client. No real family account or OAuth callback exists on Being There's project site.
2. Organizer signs in with Google; explicitly selects and authorizes a family-owned Drive archive with least permissions. Sign-in and Drive permission are **separate consents**.
3. Organizer invites relatives by their verified Google identity. No invitation or revoked membership means **no private API/data access**, regardless of having a Google account. Loved ones may use a caregiver-enrolled tablet.
4. Photos, audio, notes and stories remain readable/portable without an app encryption key. Preserve originals untouched and verify separate backups of new recordings and metadata.

## Priorities and release blockers

**P0 — Hard authorization and no-project-custody gate.** Enforce valid session plus active family membership and role on every private API including media GET/HEAD/Range, exports and asynchronous work. No anonymous, noninvited, cross-family or revoked user may cause a Drive API operation, receive Drive credentials or view family data. Reject malformed and spoofed identity/header claims, untrusted origins, CSRF and public/shareable media links. Test denial and actual zero Drive calls with spies. Maintain absolute no-project-data custody. [Security contract](SECURITY_PROMISE.md).

**P0 — Protect transport, storage, secrets and recovery.** HTTPS/TLS and provider-managed encryption at rest; no Being There E2EE, family decryption keys or recovery kit. Keep OAuth refresh tokens server-side in the family account, scope/revoke them, protect logs, enforce restricted cloud permissions and independent backups. Test clean restore and member revocation.

**P1 — One easy Google-first installer.** Compare Cloudflare and other family-owned hosting for durable execution/data storage; implement a verified host-specific runtime and OAuth callback configuration. Do not call the current Node/SQLite technical preview deployable directly to Cloudflare Pages or promise zero Google Cloud Console setup before it is proven. [Google integration #17](https://github.com/Being-There/community/issues/17).

**P2 — Verify usable family experience.** Independent organizer/member/outsider pilot with synthetic media; invitation acceptance, role changes, tablet session, upload, storytelling, backup and restore. Security/provider tests and accessibility review are required before real families use Community Edition.

Provider templates are replaceable; verified privacy, family control, direct-readable archives, no project custody and deny-by-default access are not. A provider-managed encrypted disk does not prevent that provider or a privileged family admin from reading content, and no design removes all legal risk.
