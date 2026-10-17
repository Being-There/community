# Frequently asked questions

### Can my family use Being There now?
The [Community Edition application](packages/app/) is public as a **self-hosted technical preview** for technically experienced operators. A disposable fictional full-UI local demo exists. There is no one-click AWS installer, verified nontechnical-family setup, operated central family-hosting service or completed independent production security review. Please do not upload real private family content to a demo or an unreviewed host.

### Can I try the interface without creating an account?
A technical user can run `cd packages/app && npm ci --ignore-scripts && npm run dev` locally, then open https://localhost:3000. It uses synthetic login and data, listens only on the local machine, and deletes local sample files at shutdown. Do not use real content.

### Will I be able to deploy it in my own AWS account?
**Planned, not yet available.** We intend to publish a reviewed and immutable CloudFormation template authored in AWS CDK, with a **Deploy to AWS** console link, backed by the family's own EC2, encrypted EBS and private S3 backup storage. It will still need a family-owned AWS account and DNS/domain; planned Cognito sign-in should be provisioned in the account without extra Google OAuth setup. The current app is still Google-only and requires a new, audited OIDC adapter before this flow ships. Optional Google sign-in would require owner-configured credentials. No shared Being There AWS credential or secret is required. See [the milestone plan](docs/DEPLOYMENT_ROADMAP.md) and [AWS guide](docs/deployment/AWS.md).

### Can I use Google Sites or Google Drive?
A family can put a **link to its private hosted Being There app** on a Google Site right now. Google Sites cannot run the existing Node/SQLite backend or automatically replace its login/security boundary. The app currently imports photos from a mounted/synced folder, but **does not yet connect directly to the Drive API or persist new originals to Drive**. We plan an owner-selected, visible Drive folder for verified archives and eventually a native storage option alongside S3/NAS. A private Drive folder is not an invitation or an authenticated Being There account. See [Google integration design](docs/deployment/GOOGLE.md).

### Could we host it on a home server or NAS?
This is planned as a separate portable installer. The currently shipped Node app can be operated manually by someone comfortable with Linux and HTTPS; a validated Docker Compose quickstart is not yet delivered. All routes must use the same family-owned export/recovery format.

### Is this open source?
Yes. The public Community Edition code is under Apache-2.0, with documented third-party dependencies. The original private family's app, archives and credentials are **not** part of the release. Automated testing of a technical preview is not an independent security audit.

### Who controls family data and encryption keys?
The family's host/account owns the data, login provider (planned AWS Cognito default or independently configured Google OAuth) and backups. In the proposed AWS route, the family would manage KMS key policy and IAM in its own AWS account. **AWS KMS encryption is not zero-knowledge**: an authorized runtime can decrypt data to serve it to users. The project does not need administrator privileges or a private archive copy. See [data/keys/restore](docs/deployment/DATA_AND_KEYS.md).

### Can someone using Tablet view enjoy photos even if they're not pictured?
Yes. Memories belong to the shared family collection; a person tag isn't required and isn't a login or permission. Tablet view simplifies browsing and allows optional independent stories. Family space is for adding memories and managing them. Private access still requires an invitation and verified account in a real deployment.

### How do families back up and leave?
The app has a verified portable archive model and synthetic restore tests, but automatic independent backups and real offsite disaster drills are still gates before marketing a turnkey installer. On their own host, the family is responsible for backup/recovery. Destroying a cloud stack must not silently delete original memories.

### Do I need a GitHub account?
To interact through public Issues or PRs, yes. Reading source and docs does not require one. The planned AWS console deployment should not require GitHub or local developer tools.

### Do I need to share family stories to help?
No. Never post real family photos, recordings, contact information or medical information to public GitHub. Synthetic bug reports and general feedback are welcome.

### Is Being There a nonprofit? Can I donate?
We are exploring fiscal sponsorship or a nonprofit structure but are not currently soliciting donations or claiming tax-exempt status.

### Does this diagnose, treat or measure dementia?
No. Being There supports connection and enjoyment and does not substitute for care or clinical advice.
