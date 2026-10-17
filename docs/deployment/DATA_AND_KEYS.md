# Family ownership, credentials and disaster recovery

**Guidance for future installers and operators.** These are intended guarantees and verified implementation requirements, not a claim the cloud workflow is already operating.

## What the family controls

| Asset | Owner | Important limitation |
| --- | --- | --- |
| Photos, videos, original audio and transcripts | Family, in their instance/archive | Application runtime can read content to serve it to authorized people |
| SQLite family metadata and account permissions | Family's EBS/local filesystem | Do not treat copied WAL files as a backup without consistency checks |
| AWS S3 backup bucket, KMS key policy and IAM | Family's AWS account | AWS and identities granted KMS/use privileges are within the trust model |
| Optional Google Drive originals/archive folder (planned) | Family's Google account or authorized Workspace drive | Drive OAuth grants and the family-hosted runtime can access allowed files; Google can process the data under its service terms; Drive does not make the data end-to-end encrypted |
| OIDC identity directory/client | Family's AWS Cognito User Pool by default on planned AWS installer; optional Google client in family's Google project | Authentication identifies accounts; it does **not** encrypt memories. Current runtime only supports Google. |
| HTTPS domain and DNS | Family | Renewal/DNS outage can make the app unavailable |
| Family invite URLs | Only intended invite recipients | Invite tokens are credentials; don't put in logs or publicly indexed documents |
| Archive export | Family, only authorized organizer with recent sign-in | Downloaded JSON archive is not app-encrypted: store and transfer privately |
| Code and deployment manifest | Public open-source project | No family secrets or private material in the repo/release artifacts |

**Storage choice does not change app authorization.** Google Sites, Drive folder permissions and sign-in accounts are separate layers: only server-enforced invite/membership checks may authorize private memories. The family should be able to revoke a storage token, rotate it and export everything without giving the project access. See [Google option](GOOGLE.md).

**Customer-managed AWS KMS keys are not equivalent to end-to-end encryption.** They provide account-level encryption control, IAM governance and audit paths. If an operator or service has decrypt rights, it may read data. Losing/disabled keys can make recovery impossible. Do not require families to invent or manually carry raw keys for the basic flow. An optional app/client-side zero-knowledge mode would need independent design, recovery and accessibility review.

## Before first real upload

- Understand who owns and is authorized to access AWS, DNS and Google credentials. Use multi-factor authentication for administrator accounts.
- See exact recurring cost categories, storage limits, backup retention and contact for billing incidents.
- Confirm family-only access and test with a real uninvited identity (must be denied).
- Verify first off-device backup includes every original and metadata snapshot, with hashes and restore instructions.
- Locate at least one offline or separately controlled archive and the family recovery instructions. Account lockout or key loss should not be the single point of failure.

## Recovery test: the bar for a real deployment

1. Use fictional sample content with a photo, video, audio story, two contributors, optional named storyteller and a shared memory with no named person.
2. Record checksums and attribution, take independent backup, then assume the original app server/database is **gone**.
3. Create a clean instance on another host (non-AWS is preferred for portability), import the private verified archive, confirm exact-byte matches, family/person/story relationships and that **no previous login session/invite** is trusted.
4. Re-verify intended organizer ownership and issue a **new one-use invite**. Verify uninvolved users cannot open the restored content.
5. Record duration, missing originals, backup failure alerts, and how to recover if cloud access or key permission fails. Repeat after any backup/migration change.

### Key rotation and exit

Provide explicit instructions for rotating OAuth secrets and KMS key configuration, revoking users, and disabling retired app instances. Before deletion, export a portable archive to a separately controlled device, test restore, confirm retention/lifecycle costs and only then opt in to permanent destruction. **Deleting a CloudFormation stack must never be used as an undocumented data-deletion button.** Keep deletion of retained EBS/S3 originals as a separate, clearly destructive action.

### No hidden project access

The Being There maintainers do not need customer IAM roles, AWS access keys, Google OAuth secrets, DNS credentials, or read access to family archives. A volunteered helper should receive revocable, least-privilege permissions and a handoff checklist. Logs may contain operational error codes but must never include media bytes, transcripts, invite links, OAuth secrets or other family content.
