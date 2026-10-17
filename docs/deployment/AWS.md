# AWS self-owned deployment — proposed guide and implementation specification

**Not deployable yet.** There is currently no CloudFormation template, CDK stack or "Deploy to AWS" button in this repository. This page defines the first supported provider-specific installer and the steps a future family-facing guide must automate. The existing application is a Node.js/SQLite/localhost service; do not run real family data on an unreviewed deployment.

## What an AWS owner should expect

**You own:** the AWS account and bill, domain/DNS, Google OAuth web client and credentials, S3 originals/backups, EBS database volume, KMS key policies, CloudFormation stack and ability to export/delete. Being There does **not** receive these credentials or a shared administrative role.

**You need initially:** AWS account with billing controls, domain or subdomain you administer (Route 53 is simplest for the guided v1), an organizer's email for the future AWS-owned Cognito sign-in (or a Google Cloud project if opting into current Google OAuth), and permission to approve the first private invitation. A family helper may administer the account under revocable IAM/Identity Center permissions. Domain purchase, Cognito User Pool and managed login can be provisioned in the family's AWS stack **once the not-yet-implemented OIDC integration exists**. Optional Google OAuth still requires external setup. Neither domain purchase nor account creation is literally one click.

**You will pay AWS directly** for running compute, disk, snapshots, stored backups, encryption/key usage, Secrets Manager, DNS/domain, internet transfer and optional monitoring. Display the selected-region line-item estimate **before** launch. No default claim that AWS is free.

## Expected future click path

1. Open a **versioned** Deploy to AWS link from an audited Being There release. It opens the family's AWS CloudFormation console, not a Being There sign-in page.
2. Review exact template hash/source, costs and resources. Select AWS region and domain; confirm a **private backup destination** and explicit data-retention policy.
3. Approve stack launch in their account. CloudFormation provisions one EC2 server, separate encrypted EBS data volume, private encrypted/versioned S3 backup bucket, customer-managed KMS policies, narrowly scoped instance role, SSM access, DNS and an HTTPS reverse proxy. It outputs **nonsensitive** status, public HTTPS app URL and the exact sign-in callback URL for the family's provider.
4. **Default after adapter is built:** use the automatically provisioned family-owned Amazon Cognito user pool and managed login (passwordless email OTP/passkeys on supported paid feature plans); CDK configures an OIDC callback into the private app. No Google Cloud Console required. The **current Google-only backend must be extended and independently tested** to support this securely. Optional Google route stores the family's client ID/secret in their own Secrets Manager (never CloudFormation parameters or plaintext boot scripts). Verify the HTTPS callback, provider issuer/audience, nonce/PKCE, and account isolation.
5. Run a limited, authenticated **first-organizer invitation** action, bound to a verified recipient. Do not auto-assign the first visitor or print invitation tokens to centralized logs.
6. Sign in as organizer; invite contributor and optionally a person to use Tablet view; upload a **fictional** test memory, verify contributor/tablet segregation and check the first off-volume backup.
7. Only after valid live backup and restore evidence, start adding private memories. Export a private archive to another owned device, and rehearse recovery/offboarding.

### Proposed infrastructure implementation

```text
Family's domain + HTTPS (Caddy or similarly reviewed reverse proxy)
                    |
              EC2 (single host)
              - Node 24 application (loopback only)
              - SSM maintenance, no SSH ingress
              - identity role, read Google OAuth secret
                    |
    encrypted EBS data volume: DATA_DIR + original-archive
                    |
      verified scheduled off-volume backup operation
                    |
    private S3 bucket (versioning + encryption + lifecycle)
       using account-owner controlled KMS permissions
```

**Why not S3 live storage immediately?** The current SQLite adapter commits records and bytes to a local database and synchronously flushes immutable original files and snapshots to a private directory. A direct S3 adapter must be separately built and tested; a mounted or synced S3 path does not have local transactional guarantees. S3 is initially an *independent recovery destination*.

**Why not ECS/RDS/ALB?** More services, operating cost, credentials and failure modes for an early single-family instance without proven horizontal-scaling need. The simple architecture should still accept later replacement by another provider.

### Security/operations acceptance tests

- EC2 app listener reachable only from local HTTPS proxy; ports exposed only as needed for 443 and ACME challenge; SSH ingress denied. SSM with narrowly scoped IAM.
- Public S3 access and ACLs blocked; object encryption with a family account customer-managed KMS key where appropriate; versioning and chosen retention enabled; **no default compliance-mode object lock** that makes offboarding irrevocable.
- No secrets in code, GitHub, CloudFormation parameters/outputs, UserData logs or CI logs. Protect Cognito app client credentials (if confidential), OIDC provider metadata and intended invite recipients; use server-side, verified OIDC subject as identity key rather than merely an email address. No cross-account role trusted to the Being There organization.
- Public source and pinned release/source digest reviewed and included in deployment manifests; upgrades use explicit signed/reviewed revisions and tested database migrations.
- Health and backup freshness available to owner; failure alarms without logging media, text stories, identities or access tokens. Budget alerts surfaced before install.
- Machine termination followed by a verified restore of images, audio, video, attribution and separate access grants. Test wrong KMS key, revoked IAM, truncated backup and missing media.
- Ordinary **stack deletion must retain** precious media/backup resources; offboarding is an explicit, confirmed process with backup export instructions. Restore from AWS must also work on a non-AWS machine.

### What engineers can build now

- Version-locked CDK IaC plus reviewed CloudFormation synth with a release-specific immutable S3 template URL and SHA-256.
- Instance install/bootstrap preserving an encrypted EBS volume, pinned Node app, HTTPS and startup checks.
- Storage-consistent full snapshot/archive to S3 with verification and retention, plus user-visible health.
- Cognito/OIDC verifier integration plus optional Google provider support, safe first-organizer invitation and AWS-owned sign-in/DNS wizard. Document Cognito tier costs and email delivery behavior.
- Zero-data sandbox deployment and cross-provider restore drills.

**References:** [CloudFormation quick-create](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stacks-quick-create-links.html), [CDK prerequisites](https://docs.aws.amazon.com/cdk/v2/guide/deploy.html), [EBS encryption](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html), [S3 SSE-KMS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html), [Secrets in CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html), [SSM Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html), [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).
