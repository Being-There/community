# Privacy and public participation

Our commitments: **no ads, no family-data business, and no Being There project custody**. Families control their own private app, Google OAuth client, invited members, storage and backup systems. The project never receives family media, metadata, account tokens, logs or backups, **even ciphertext**. See [trust](docs/TRUST_COMMITMENT.md), [security](docs/SECURITY_PROMISE.md) and [no custody](docs/NO_CUSTODY.md).

## Family privacy design (release requirements, not verified technical-preview claims)

- Mandatory HTTPS/TLS for every app/provider connection and provider-managed encryption at rest; **no extra Being There client-side encryption or family decryption keys**.
- Google identity authentication **plus** explicit active family membership and role/scope checks on every private API call. Google sign-in alone never authorizes a family's private data.
- Google Drive requires independent organizer OAuth consent. No outsider, logged-out or revoked user may invoke Drive file operations. Tokens remain in the privately operated family installation.
- Content and archives remain in ordinary, exportable formats; existing originals stay unchanged; new recordings and metadata require separately verified backups.
- Third-party providers (including Google and a family's host), authorized relatives and sufficiently privileged family administrators may have access under their own policies. This is **not E2EE or zero knowledge**. No guarantee against compromise, indefinite provider retention or legal risk is implied.
- No project-controlled family app, shared token vault, analytics beacon, content relay, background script or private support upload.

**Current Community technical preview:** stores readable content in the operator's locally controlled Node/SQLite backend and has not passed native Drive, hosted deployment, independent privacy/security, real OAuth and nontechnical-family release gates. Do not supply real family data to unreviewed deployments.

## Public project participation

Issues, commits, usernames, comments and PRs in this GitHub repository are **public** and may be indexed or retained. Use only fictional or safely redacted reproductions. **Never post** real media, names, contact details, stories, diagnoses, access tokens, credentials or private app URLs. The project does not offer a private real-family support-upload channel. Security vulnerabilities should use GitHub's private vulnerability reporting where available.
