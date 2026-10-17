# Community Edition: family-owned onboarding and deployment plan

**Status:** Proposed delivery plan, not an available one-click installer. Dad's private installation is out of scope. The public Community Edition currently runs Node.js + SQLite + private filesystem originals, requires a real Google OAuth web client and HTTPS, and has only synthetic deployment tests. Nothing in this document claims a real cloud installation, security audit or independent-family pilot.

## Goal

A family with limited technical knowledge can launch a private instance **in an account they own**, invite a contributor, open the large-screen Tablet view, keep exact originals, and restore an archive elsewhere without needing an account, login, backend, API key or subscription from Being There.

**Reduce setup steps, not ownership.** One-click infrastructure is helpful, but an account and identity provider still need setup. A trusted volunteer may assist; the family must retain administrative control, billing access, backup/recovery instructions and the ability to revoke that helper.

## Delivery choice

| Route | User | How it works | Status |
| --- | --- | --- | --- |
| **AWS guided launch (first)** | Family with an AWS account or helper | CDK-authored stack, **versioned/signed-off synthesized CloudFormation template**, AWS console quick-create link; resources deploy in family's account | **Planned; template not built or tested** |
| **Home server / NAS (second)** | Comfortable running a home server, or helper | Pinned image/Compose, host storage and off-device backups; optional mounted/synced Drive intake | Planned |
| **Advanced/manual installation (existing)** | Linux/Node operator | Follow [application guide](../packages/app/README.md) | Working reference; no real-world deployment verification |
| Being There-managed hosting | No-hosting family | Would put hosting, billing and trust at project/operator boundary | **Not a required path and not committed** |

### First AWS architecture: simple and recoverable

Use **one small EC2 instance** (not ECS/Fargate/RDS/ALB by default), with a separate persistent **encrypted EBS data volume** for `DATA_DIR` (SQLite database, originals, metadata snapshots), an HTTPS reverse proxy bound to the family's domain, a **private S3 bucket for independent versioned backups**, and **customer-managed AWS KMS encryption keys**. Application process stays bound to 127.0.0.1; only public HTTPS/required certificate validation traffic reaches the proxy. IAM instance profile narrowly permits needed reads/writes, Session Manager replaces SSH ingress, Secrets Manager retains OAuth client credentials. No S3 static website, public objects, shared central app database or family keys in CloudFormation parameters. Pin the public app release/source digest.

This matches the present single-process/SQLite design. **S3 is a backup target, not the live database/media adapter**: current archive preservation requires synchronized filesystem writes, and pretending `aws s3 sync` is a transactional storage backend would be incorrect. A native S3 originals provider is a separately validated future decision, requiring exact-byte reads, atomic acknowledgment, recovery equivalence and failure injection. Default one-instance service has planned maintenance/downtime and needs sizing/cost testing.

Use CDK for maintainable infrastructure code; **do not make families install CDK**. CI should synthesize a *reviewed, immutable, version-pinned* CloudFormation template, publish it at a release-specific S3 URL, and expose a CloudFormation quick-create link. Include template hash and complete resource manifest. No deployment from an unreviewed moving branch. Developers may use `cdk deploy`; that path requires AWS credentials and account/region bootstrapping.

AWS references: [CloudFormation quick-create links](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stacks-quick-create-links.html), [CDK deployment prerequisites](https://docs.aws.amazon.com/cdk/v2/guide/deploy.html), [EBS encryption](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html), [S3 SSE-KMS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html), [SSM Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html).

## Human journey (design target, not yet implemented)

1. **Choose control model.** Explain AWS account ownership versus a home-server path, who sees data, ongoing costs, and who is responsible for backups. Never ask a family to send keys, media or passwords to the project.
2. **Launch in own AWS account.** Choose region, DNS/domain (initial guided path assumes control of a public DNS name), approximate capacity and backup retention. Review resources and monthly cost *before* deploy. No CLI or GitHub required for family.
3. **Connect private sign-in.** Guided steps configure a family-owned Google OAuth Web client (current provider), exact origin and callback; put client ID/secret in Secrets Manager in their AWS account, **not** stack parameters, screenshots, app logs or a Being There service. Future alternative OIDC/passkey support is independent work; no project's shared OAuth client.
4. **Claim ownership safely.** An authorized AWS owner uses a scoped one-time provisioning action to issue a first organizer invitation to a *verified* recipient. This action must not appear as a publicly callable bootstrap endpoint or first-visitor-wins admin. Do not log the one-use invite token into central systems.
5. **First-minute family experience.** Organizer invites family; adds a photo/video or imports photos; family uses tablet mode for enjoyable, pressure-free browsing and optional independent stories. No clinical or cognitive setup.
6. **Backup check before real import.** Show a human-readable backup status, storage destination, last successful *verified* backup and a restore walkthrough. Warn clearly until the first valid off-device backup exists.
7. **Maintain and leave.** Clear account-level cost view, update/pause controls, key rotation/revocation guidance, explicit export + restore in another environment, and a **separate** retention-aware deletion process. Normal stack deletion must not silently destroy original memories.

### Identity and access truth

A **family account** is the authenticated contributor, distinct from the person enjoying memories and any speaker named on a story. Tablet view is a presentation mode and **does not** grant login rights. All data access remains invite-only and server-authorized. Multiple family/person profiles are supported. Never use a person selector, family name or browser flag as an authorization mechanism.

## Privacy / control contract

- **Private by default:** S3 public access blocked; public ACLs disabled, TLS enforced; access from only owner-authorized identities. No public family data, tracking SDKs, telemetry of stories, default vendor access or mandatory paid AI.
- **At-rest protection:** encrypted EBS and bucket default SSE-KMS, preferably customer-managed KMS key(s) in the family's account. The family controls IAM and KMS policies and can rotate/revoke keys. **This is not zero-knowledge encryption**: AWS services and application runtime can process plaintext where permissions allow. Separate application/client-side encryption would be an additional advanced design with key-loss risks.
- **Least privilege:** no long-lived AWS access keys in app or repository; instance role for precise bucket prefix, Secrets Manager secret and KMS operations; no open SSH, SSM for operator work; no blanket cross-account trusted principal or project backdoor. Avoid inserting OAuth secrets into EC2 UserData, CloudFormation outputs, or logs.
- **Archive:** immutable originals and validated manifest metadata preserved independently of SQLite; versioned private S3 backups, optional bounded retention/Object Lock only when lifecycle/offboarding and cost effects are explained. No false promises from a copied folder on the same disk. Never delete original S3/EBS stores on routine stack teardown.
- **Recoverability:** backup includes SQLite-consistent state or complete validated independent original+snapshot material, with hashes. Prove restore with the original compute unavailable, in a **new** installation, and re-verify access grants. Deny imported logins/sessions/tokens.
- **No lock-in:** export and restore must work outside AWS using the public format and standard filesystem tools. A family's AWS account, Google configuration and data remain independently controlled.

## Release gates (must have before calling it 'one click')

**M1 — Package and template:** pinned application/runtime artifact; repeatable Linux service on EC2; reviewed CDK source; synthesized template and trust/provenance check; restricted networking; boot success/health/HTTPS after reboots. Prove ordinary user can see all deployed resources/costs.

**M2 — Guided owner onboarding:** separate safe steps for Google OAuth, Secrets Manager, domain+HTTPS and first invite; never a first-visitor admin. Real provider identity verified for organizer and second contributor. Empty/incorrect credentials fail closed and explain remediation without secrets.

**M3 — Backup/recovery (release blocking):** encrypted versioned off-volume S3 backup with status, budget/retention controls, alarming for failure/expiry, original-byte verification; destructive simulated machine loss; cross-provider restore from downloaded backup; revoke old access; key-loss and quota/permission failure rehearsals. S3 retention must not block family offboarding unintentionally.

**M4 — Life-cycle safety:** pinned upgrade and rollback with database migration tests; safe server replacement preserving EBS/S3; no auto-update from main; clear rotate/revoke/export/delete instructions; no surprise billing; cloud resources retained or explicitly destroyed with informed confirmation.

**M5 — Usability + independent review:** guided AWS console installation by someone unfamiliar with code (target: no CLI/GitHub and first private memory without unexplained steps); separate tablet/contributor walkthrough; real-device/screen reader tests; security review. Pilot with a *fresh family-owned AWS account* and no production private family data.

**M6 — Portable installer:** Docker Compose path and documented migration from AWS backup to non-AWS host, not another mandatory provider.

### Success measures

- Zero Being There-held secrets, AWS credentials, family originals or required vendor-hosted account.
- One reviewed release link plus necessary AWS/domain/Google steps, **not** a hidden operator script run by project maintainers.
- No use of real family data until identity, access, backup and restoration pass live checks.
- Fresh owner can restore all photos/video/audio with attribution on a second host after losing the original server.
- Understandable monthly bill preview, operator-free everyday interaction, documented updates and offboarding.

## Explicitly not shipping yet

No live AWS CDK stack, CloudFormation quick-create URL, S3 backup adapter, automated certificate/domain installation, third-party OAuth connection wizard, novice-tested setup, real-account pilot, or independent security certification currently exists. The manual self-hosted Node app is a technical preview only. Do not represent this plan as a deployment service.
