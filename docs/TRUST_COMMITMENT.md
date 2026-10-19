# The Being There Trust Commitment

**Your memories. Your family. Your control.**

Being There publishes free, open-source software; every family runs its own private installation and stores its own memories. The project never receives or operates a real-family login, API, Google Drive connector, media relay, backup, support upload or data service — even for encrypted content.

## Our commitments

- **No ads or data business.** No advertising, tracking, selling, profiling or training on family data; no project-hosted family analytics or telemetry.
- **No project custody or hidden project access.** The family owns its Google OAuth project/client, Drive or other archive, hosting and secrets. No shared project-managed authentication callback, proxy, token vault or backdoor.
- **Google identity plus invitation.** Only active, invited family members may access private app data. A Google account alone never grants membership. A revoked member immediately loses future server access. Organizers explicitly control roles.
- **Protected connections.** HTTPS/TLS is mandatory across every browser, app and provider connection. Family-owned storage uses its provider's built-in encryption at rest. **No extra Being There content encryption keys or recovery kits.**
- **Preservation first.** Existing originals are never modified in place; new stories and metadata get independent, versioned, verified backups. Families must be able to recover readable content without the Being There project.
- **Transparent limitations.** We publish source, permissions, security caveats, current release readiness and provider responsibilities. We do not claim zero risk or zero legal liability.

## Important privacy distinction

**This is not end-to-end encryption or a zero-knowledge service.** Google and the family's hosting provider may have technical or legal access under their own policies; authorized family members, sufficiently privileged family administrators or compromised devices can expose data. TLS protects transit, not a malicious endpoint. We can promise no project-operated custody only after review and verification of installed releases; we cannot promise that nobody else could ever access data.

## Family-ready release gate

Test that anonymous users and Google users without an accepted invitation receive no private family metadata or media and can trigger **no Google Drive data operation**. Verify read/write, image, video, audio, Range/HEAD, invitation replay and revocation paths; require provider-consent scoping, backups and independent review. The current technical preview has not passed every release gate; use fictional data only.

See [security contract](SECURITY_PROMISE.md), [no custody](NO_CUSTODY.md) and [deployment roadmap](DEPLOYMENT_ROADMAP.md).
