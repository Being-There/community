# No project custody of family memories — product boundary

**Approved non-negotiable product direction, not a shipped capability.** Being There is an **open-source software project, not a family-data hosting, relay, account, backup, support-access or key-custody service**. The maintainers must never receive, proxy, store, index, analyze, back up, decrypt, or deliberately collect real families' content **including ciphertext**. This decision supersedes all prior proposals for a Being There-operated hosted web app, central family database, shared content gateway, hosted recovery service or project-managed Drive OAuth token vault. No lower-privacy tier.

## Promise, in plain English

> We make the software. Your family runs its own private memory space. Your memories and the encryption keys to open them never travel through Being There-operated systems. We cannot browse, recover, manage, or access your family albums.

**This is a target architectural promise, not a current verified capability of the public technical preview.** The existing reference server still stores plaintext records and is not E2EE. Being There cannot claim verified no-custody for all released installations until implementation, threat model and independent validation pass.

## Who does what?

| Component | Being There maintainers | Family and its chosen provider |
| --- | --- | --- |
| Source code, reproducible/signed versioned releases, docs, public fictional demo | Publish and maintain | Choose if/when to install, review and update |
| Real family app/API/backend, database, file storage, encrypted archive, logs | **Never operate or receive traffic/data** | Runs in family-controlled account, hardware or provider |
| Family identities and invitations | No global sign-in service or central accounts | Family's own auth tenant/client and private instance |
| Google Drive/S3/other credentials, OAuth callback, refresh tokens | **Never proxy or receive them** | Provider callback **direct to family's instance/device**, secrets stay with family |
| Encryption keys, recovery kits and device enrollment | Never hold or escrow | Family members/devices only |
| Media, ciphertext, transcripts, profiles, tags, support dumps, backups | Never accept or store | Family's systems only |
| Anonymous public project site, documentation and synthetic demo | May operate with ordinary website infrastructure | Must never be used for real uploads or live family authentication |

**Third-party services still process family data according to their own terms.** "Being There never handles it" does not mean Google, AWS, a family-chosen hosting provider or an invited relative cannot access what their own permissions allow. A family-controlled encrypted vault is separate from preexisting plaintext photos in the family's Drive, which we never modify or encrypt in place.

## Minimum-friction family experience

1. Family opens the **Being There information/installer website** to choose a provider they control. No real photo uploads, Drive connection or family sign-in occur on the project site.
2. Guided one-click installation provisions **the family's own** app + identity and private storage in its account (or a trusted helper uses an advanced installer). The family sees where their instance lives, who pays and how to revoke helper access.
3. The installer opens **the family's instance URL**. They sign in with their own provider/tenant (Google/OIDC where supported), create locally held E2EE keys, set up a second recovery method, and invite relatives.
4. Authorized devices encrypt before upload to the **family's** app/storage. New stories gain independently verified encrypted backups; selected preexisting Drive originals stay unchanged. Tablet view remains simple.
5. A family can export, recover, migrate or stop running its installation without contacting project maintainers.

A Google Site can link to a family instance; it cannot run the current Node.js/SQLite server. A static browser-only client that talks **directly** to family-owned Drive is a research option only if family auth, E2EE key sharing, invitation and restore can be proven without any project callback/proxy. **No shared project OAuth callback** or central access-token broker. Provider OAuth consent/client configuration may still require an owner-controlled app registration or installer automation; do not promise "zero OAuth setup" without demonstrating this safely.

## Software-delivery caveat

An ordinary web browser executes JavaScript served by the app's site. If Being There maintainers serve a continuously changing live client, they could technically ship code that reads memories once users unlock them, despite E2EE. **Therefore the family must control the actual client origin, pinned version, approvals for updates and secrets.** Make releases reviewable and reproducible, ideally signed and version-pinned; no project-operated auto-update, remotely supplied scripts or silent telemetry. A public project site should host only docs, fictional demo and independently installable artifacts, **not** the private family experience.

The project must not offer a real-family demo on its own infrastructure or use uploads/logs/screenshots from real families to troubleshoot. Support uses synthetic reproductions only; a helper, if hired/invited by a family independently, operates under that family's revocable access, not project default access.

## Gate before a real-family release

- Source and runtime contain no project endpoint for family media/ciphertext, Drive credentials, key escrow, telemetry or backups. Test with network capture, fake families and strict allowlists; zero real-data traffic to project-controlled domains or services.
- Each installation owns its domain/origin, identity tenant, app/backend, logs, data/backup destination and encryption keys; no central fallback if it goes offline.
- An admin of Being There's GitHub/project infrastructure alone cannot cause installed version-pinned family devices to load unapproved new executable code. Build reproducibility, signed versioned artifacts and update-approval path are reviewed.
- Device-side encryption covers all content/metadata before private instance storage; inviting/removing users and tablet enrollment do not expose family keys to the project or family's hosting provider.
- Preserve existing imported originals unchanged, store new stories in a separate E2EE vault, verify independently recoverable backups with two family-held recovery options, test clean offline recovery.
- Independent security review and nontechnical family installation pilot using **only fictional test data**; audit project-controlled logs, DNS, error collection, support intake and connectors.

**Do not call this zero legal liability.** Open-source software authors may still have responsibilities for representations, privacy/security practices of sites they operate and applicable law. The narrower verifiable commitment is that project-operated systems do not take custody of families' memories, ciphertext, credentials or keys.

Reference: [security promise](SECURITY_PROMISE.md), [family roadmap](DEPLOYMENT_ROADMAP.md), [implementation blocker #25](https://github.com/Being-There/community/issues/25).
