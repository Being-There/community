# Being There — family-owned web app roadmap

**Non-negotiable: [Being There does not handle anybody else's data](NO_CUSTODY.md), including encrypted bytes.** We publish source, signed/versioned releases, guides and fictional demos. Families operate the real app, accounts, OAuth callbacks, private API, storage, backups, logs and encryption keys in systems they control. **No central Being There family service, data relay or recovery service.**

**Not yet ready:** The current public Community technical preview uses Node/SQLite, manual Google OAuth and a locally operated backend with readable originals; E2EE and easy family installation are not implemented. Use synthetic data only.

## The family experience

1. Choose a guided **installation into your family's own provider account** or ask a helper to install on a home server. The project website supplies software/instructions, not family logins or private uploads.
2. Open **your own private Being There web address**. The family-controlled install handles Google/OIDC authentication and private invites; no Being There-operated OAuth callback or token service.
3. Enroll family-held encryption keys and two independent recovery methods. Import existing originals **without modifying them**; upload only new encrypted vault copies, stories and metadata.
4. Enjoy shared memories on any authorized web/tablet device. Independently verify encrypted backups and offline recovery.

## Priorities

**P0: Security and custody.** [Absolute no-project custody](NO_CUSTODY.md) and [family-held E2EE](SECURITY_PROMISE.md) block every real-family release. No project-controlled family-data endpoint, no central login or token broker, no project-hosted live client which can silently substitute malicious JavaScript. Family controls the client origin, pinned release and update approvals. [Implementation #25](https://github.com/Being-There/community/issues/25).

**P1: One nontechnical installation.** Build and test one simple account-owned installer producing a family web address, private identity, encrypted vault and durable independent backups. AWS [#13](https://github.com/Being-There/community/issues/13), Google-first [#17](https://github.com/Being-There/community/issues/17) and portable container [#19](https://github.com/Being-There/community/issues/19) are community implementation options, not separate products. Google Drive OAuth configuration may still require owner setup; never pretend an API key suffices.

**P2: Validate family sharing, tablet and recovery.** Test with fictional photos/audio/stories, independent user accounts and a caregiver-provisioned tablet. A lost server or project shutdown must not prevent the family from decrypting and restoring from family-held keys and archives. [Auth #14](https://github.com/Being-There/community/issues/14), [recovery #15](https://github.com/Being-There/community/issues/15), [family pilot #16](https://github.com/Being-There/community/issues/16), [tablet #21](https://github.com/Being-There/community/issues/21).

**Others can implement more installer templates.** See [deployment options](deployment/OPTIONS.md) and the public issue backlog. Provider-specific infrastructure must not introduce project-operated storage, telemetry, email/OAuth token relay or support access.

## Honest boundary

The project's servers cannot handle real family data—not even ciphertext. Families choose their own cloud/NAS services and are responsible for those providers' data handling terms. A signed software release does not guarantee no future compromise; independent review, pinned code and family-controlled updates are necessary before making a strong security promise. **No design eliminates all legal liability.**
