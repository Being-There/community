# Being There — family-owned web app roadmap

**Decision: [No project custody ever](NO_CUSTODY.md).** Being There distributes open-source software, install guides and synthetic demos. **We do not run family instances, store encrypted or unencrypted memories, receive storage tokens, manage encryption keys, relay private uploads, or collect family usage data.** One personal web app, installed in the family's own account, remains the ideal user experience.

**Current status:** The public Community app is a **technical preview** requiring a Linux host and manually configured Google OAuth, private SQLite/filesystem storage and HTTPS. **It is not end-to-end encrypted**, does not satisfy this new policy, and is not validated for nontechnical family installation. Do not use real family data in the Community preview.

## What should Mom do?

1. Visit the public project website **to choose an installer**. No family sign-in, Google Drive connection or real uploads happen on that site.
2. Choose a family-owned deployment: **guided one-click in an account the family owns** (Google or AWS as supported), or a home/NAS install from a trusted helper. Installer clearly shows where it will run and what it costs.
3. Open **her family's own Being There web address**. Sign in with a Google/OIDC provider configured for **that family's instance**, enroll family-held keys/recovery and invite relatives. She never handles developer APIs or passwords beyond her existing login.
4. Enjoy photos and stories on a simple browser/tablet interface. The family-controlled app is responsible for encrypted, separately backed-up copies and recoverable archives. Existing Google Drive originals stay untouched.

This is **not a Being There-operated hosted web app**. The user sees a web app, but every private API, storage upload, OAuth callback and private log belongs to the family.

## Only three high-level decisions

**Authentication:** A family-controlled identity/authorization system, with no project-run account directory or OAuth token proxy. The family can use Google sign-in where supported, but any OAuth callback must terminate at its own installation/device. No project-managed Drive refresh tokens or family login database. The developer may need to provide a per-family OAuth setup wizard or preconfigured family-owned identity tenant; do not promise zero configuration until tested.

**Storage:** A separate private, family-owned archive: Google Drive, S3 or NAS as validated options. All Being There-managed content is **E2EE on authorized family devices before upload**. Neither Being There nor cloud operators receive decryption keys. Imported originals stay unchanged; new stories need verified independent backups and multiple family-held recovery paths. Export and offline recovery must not depend on project infrastructure.

**Distribution/code:** Families control their app's **origin and version-pinned client code**. A live project-operated website capable of delivering altered JavaScript to family browsers cannot support an unconditional “we can never read it” claim. Releases should be verifiable/signed, updates owner-approved, with no mandatory central telemetry or support access.

## Work priorities

**P0 — [Absolute no-project custody](NO_CUSTODY.md) and [mandatory family-held E2EE](SECURITY_PROMISE.md)**: gate every real-family distribution. Prove project domains receive no family traffic/files/tokens, full server/backup compromise cannot decrypt content, and malicious JS update/supply-chain threats are addressed. [Implementation blocker #25](https://github.com/Being-There/community/issues/25).

**P1 — Nontechnical independent installer**: prototype one provider-first guided install (family-owned app, identity, storage, HTTPS, backup). A family can use the resulting web interface with no hosting expertise; no central sign-in or Being There backend. [AWS #13](https://github.com/Being-There/community/issues/13) is an existing candidate; [other install options](deployment/OPTIONS.md) can follow.

**P2 — Family privacy and preservation pilot**: real-provider OAuth in an isolated owned instance, new encrypted voice stories and photos, two authorized users and tablet, negative access tests, loss-of-server restoration and family-held recovery **using synthetic fixtures**. No real family data to project maintainers. Drive connector [#17](https://github.com/Being-There/community/issues/17), auth [#14](https://github.com/Being-There/community/issues/14), recovery [#15](https://github.com/Being-There/community/issues/15), usability [#16](https://github.com/Being-There/community/issues/16) and tablet [#21](https://github.com/Being-There/community/issues/21).

**Community implementation:** portable containers [#19](https://github.com/Being-There/community/issues/19), host-specific deployment guides and storage adapters. They should help families, not create another centralized service.

## Go/no-go

A release is **not** family-ready until the software demonstrably has **no project-controlled data paths** and independent security verification. The family's provider necessarily handles its own infrastructure and ciphertext, subject to its terms; this is not a promise that no third party anywhere can ever process bytes. The project can promise no *maintainer* custody, not “zero liability” under law.
