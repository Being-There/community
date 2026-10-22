# Ways families can run Being There

All real family installations must be operated inside family-owned infrastructure and accounts. The project never hosts family logins or processes family data, even ciphertext. Security means invite-gated private APIs, mandatory TLS, provider-managed encryption at rest, safe secrets and independently recoverable readable archives — **not Being There-managed E2EE or recovery keys**.

| Option | Family experience | Reality today |
| --- | --- | --- |
| Guided cloud deployment, Google-first | Organizer installs to their own provider account and authorizes Google sign-in/Drive; relatives use invitations | Planned, not yet verified |
| Home server or NAS | Technical relative installs on family equipment; Google identity is still possible | Advanced self-hosting only |
| Cloudflare deployment | Family uses its own Cloudflare account with Google OAuth callback and separately authorized Drive | Requires a supported runtime/storage adapter; current Node/SQLite app is not directly a Pages application |
| Linux with private disk | Operator configures HTTPS Node/SQLite, Google OAuth and backups | Technical preview available, **synthetic test data only** |

The family organizer controls its own OAuth client, private application origin, sessions, roles, tokens, storage and backups. **Google sign-in does not grant any Drive permission or family membership.** Drive authorization is explicit, separate, least-privilege consent. An invited relative does not configure a developer account; no Google user without an accepted invitation sees private content or triggers Drive data operations.

Existing originals remain normally readable. New memories and records must be independently backed up and exportable without Being There or application-specific decryption keys. Google and selected hosting providers may retain privileged access under their own policies; no end-to-end-encryption or zero-knowledge claim.

See [deployment roadmap](../DEPLOYMENT_ROADMAP.md), [Google integration](GOOGLE.md) and [security contract](../SECURITY_PROMISE.md).
