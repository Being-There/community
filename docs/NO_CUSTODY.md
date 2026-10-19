# Being There — no project custody

**Non-negotiable:** Being There is an open-source software project, not a real-family login, storage, data, token, analytics, backup or support service. We never receive, relay, store, analyze or process real family media, metadata, identities, Google Drive content, OAuth tokens or backups, **including encrypted copies**.

Families install and operate their private Being There origin/backend, Google OAuth setup, storage, API, logs and backups in an account or server they control. Software/release documentation and entirely fictional demonstrations may be project-hosted; no real family signs in to our website or uploads memories to project infrastructure. No project-owned token callback, shared family app, content relay, key custody or remote project-controlled scripts.

## Who controls what

| Component | Project | Family and providers |
| --- | --- | --- |
| Open-source code, published releases and documentation | Publishes | Chooses and approves installation/updates |
| Real family login, OAuth callback, accounts and sessions | Never operates | Family-owned auth client and app |
| Media, API, databases, indexes, logs and backups | Never receives | Family's own installation/storage provider |
| Google Drive API consent, access/refresh tokens, app credentials | Never receives | Family organizer consents; secrets stay private to family deployment |
| Private app origin and software updates | No remote control | Family approves and controls |
| At-rest encryption and cloud account recovery | No project key system | Handled by selected provider, per its policies |

A legitimate family-owned backend may access readable content to serve authorized members; Google and the hosting provider may have access under their own security models. **Do not call this E2EE or zero knowledge.** The promise is that *Being There project operators* have no route to family content. Independently confirm that deployed software does not send diagnostics, remote scripts, private data or tokens to project infrastructure.

## The family journey

1. A family chooses its own supported host and installs a private app, preferably with guided Google OAuth setup.
2. The organizer authorizes only the selected Drive files/folder, explicitly and separately from Google sign-in.
3. Relatives receive verified, recipient-bound invitations, sign in with Google and gain only their assigned access. Google users without invitations see no private information and invoke **no Drive data operations**.
4. Existing originals remain normal readable files; new recordings, stories and app metadata are backed up in independently recoverable formats.
5. The family can revoke members, disconnect Drive, export, move or shut down its installation without project staff.

No application-managed content encryption, special decryption key, recovery kit or decryption dependency on Being There. TLS in transit and provider-managed encryption at rest remain required. There is no guarantee of 'zero liability', 'no breaches' or immutable cloud access; provider policies and account recovery matter.

## Release gates

- Zero real-family traffic, even ciphertext, to project-controlled domains or infrastructure.
- Every private API and Google Drive operation rejects anonymous, uninvited, wrong-family or revoked requesters; no public files or token leaks.
- An organizer explicitly consents to Google Drive scope, with secrets stored in the family installation and revocation behavior tested.
- Verified TLS, at-rest provider configuration, least-privilege service credentials, cross-family isolation, logging/caching protections and backups.
- Independently repeatable restore and security tests with entirely fictional data. Do not claim the current technical preview is production-ready.

See [security](SECURITY_PROMISE.md), [trust](TRUST_COMMITMENT.md), and [roadmap](DEPLOYMENT_ROADMAP.md).
