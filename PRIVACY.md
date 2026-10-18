# Privacy and public participation

## Product boundary: zero project custody (not yet shipped)

**[Being There will distribute software, not handle family data](docs/NO_CUSTODY.md).** No Being There-operated family app/backend, centralized user directory, data relay, private file storage, encrypted backup, family OAuth token broker, key escrow, monitoring or real-family support uploads. Families operate the software in their own accounts/hardware and authorize their own relatives. [Family-held E2EE](docs/SECURITY_PROMISE.md) is mandatory for all content and privately meaningful metadata on approved devices before storage.

**The current public technical-preview app is not E2EE.** Its *locally operated* reference server can store readable family media and metadata, and family-ready onboarding has not passed independent review. Do not present it as verified zero-custody/E2EE or ask nontechnical families to upload real content. The project does not host the private reference server; it publishes the source.

An independently chosen cloud provider may still hold the family's encrypted archive/metadata under its own terms. Pre-existing originals kept in a normal Drive folder may remain readable to whoever has the family's existing permissions. A family-controlled app's code and updates must be verifiable to reduce the risk of malicious client-side code. **No legal liability waiver or absolute immunity from compromise is implied.**

## Public project participation

This GitHub repository, its issues, comments, usernames and commits are **public**, may be indexed and retained, and are intended only for synthetic examples and general feedback.

**Do not post:** real family photos, recordings, names, contact details, private stories, diagnoses, health data, credentials, access tokens or private account URLs in project Issues, PRs or discussions. We do not offer a private family support inbox or data-upload channel. If the project needs bug reproductions, generate fictional fixtures or redact locally before sharing.

Security vulnerabilities should be reported through GitHub private vulnerability reporting if available, not disclosed in public issues. The original private family app/accounts/archive remain separate from this public project.
