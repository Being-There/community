# Deployment and access options: one portable app, multiple family choices

**Status: evaluation and implementation order, not an installer catalog.** The Community Edition is a Node.js 24 + SQLite + private filesystem original archive technical preview, and requires real Google OAuth, a private DATA_DIR, HTTPS and a trusted first-family invitation for persistent use. **Only the manual host flow has code today**; Docker packaging, one-click templates, provider storage connectors, production PWA and native mobile distribution are not yet shipped. Do not use real family data in an unreviewed public host.

## Four independent choices, not combinatorial forks

1. **Run it**: a family-owned server, a cloud VM in a family-owned account, a third-party managed app host, or a helper-operated server with explicit delegated access.
2. **Keep it**: the existing **local persistent SQLite + immutable archive** remains the transaction source of truth. Verified *off-host* backups may go to an owner-selected folder/bucket (Google Drive, S3, Cloudflare R2, Backblaze B2 or equivalent) after each connector is independently tested; *native remote originals* requires a stronger storage contract and cannot be presumed from a mount.
3. **Sign in**: the existing owner-configured Google OAuth; planned owner-controlled Cognito/OIDC or comparable issuer, with revocable first-invite access. Do not confuse a storyteller/person profile or tablet display mode with a login grant.
4. **Open it**: ordinary private HTTPS web URL (now), home-screen PWA, simplified tablet launcher, family Sites/portal link, or optionally restricted VPN/private device sharing. The same private API and family authorizations apply across all surfaces.

Each provider must pass the *same* privacy, access, original-byte preservation, backup, restore, onboarding and software-update contract before receiving a "supported" badge.

## Hosting evaluation

| Route | Appropriate owner | Why it might win | Current limitation / risk | Delivery class |
| --- | --- | --- | --- | --- |
| **Portable OCI image + Docker Compose** on Linux, a mini PC or existing VPS | Self-hosters and family helpers | One application package, persistent bind mount, adaptable to many hosts, no cloud lock-in | Image/compose, HTTPS, onboarding, backup and upgrades not yet delivered. Must test Linux filesystem locks, single SQLite writer and persistent permissions. | **Foundation first** |
| **NAS / homelab**: TrueNAS, Synology Container Manager, Unraid, CasaOS-style Docker hosts | Families with existing hardware | Reuse OCI/Compose and mounted private data; low marginal hardware cost | Availability, secure remote HTTPS, vulnerability patching, backup outside NAS, differing platform UIs | **Packaging layer after Compose**, not separate app |
| **Cloud VM templates**: AWS EC2/CloudFormation first; then Azure VM, Google Compute Engine, Lightsail, Hetzner, DigitalOcean Droplets | Families that own cloud billing, keys and account | Local POSIX disk fits SQLite, simple CPU/storage sizing; account and deployment manifest controlled by family | Owner handles recurring bill, account security, HTTPS; one-click isn't account creation; maintenance/recovery remains real work | **AWS one-click in existing #13**, other VM providers after baseline |
| **Managed app with persistent disk**: Render or Railway | Family wanting provider-managed build/HTTPS/VM operations | Paid persistent disk/volumes exist; may reduce server admin burden | Persistent disk is **not** an independent backup; volume limits, cost, provider operator trust, single-instance downtime and export/test requirements | **One managed-host pilot**, after Compose+backup |
| **Platform managers**: Coolify / Cloudron | Existing self-host admin | GUI install/updates, custom OCI package, managed mounted storage / backup options | Still needs a host, DNS, secrets, backups. Cloudron packaging has platform-specific read-only/app data path constraints. | Add-on templates after OCI, not a separate runtime |
| **GCP Cloud Run / DigitalOcean App Platform / Cloudflare Workers / static GitHub Pages/Vercel/Netlify** | Developers favoring serverless | Scalable operation and CDN options | **Not drop-in for SQLite**: stateless/ephemeral files or non-POSIX object mounts; needs a durable DB replacement, distributed sessions and original archive adapter | **Defer** until mature cross-provider API + storage |
| **Third-party managed family-hosting service** | Anyone who cannot manage accounts or hosting | Least setup by user | Shifts data and recovery trust to operator, introduces breach/cost/legal obligations and possibly violates independent family ownership tenet | Not a default path; only explicit opt-in with tenant isolation, export and transparent custody if ever explored |

Current platform evidence:
- [TrueNAS custom Docker Compose apps](https://www.truenas.com/docs/scale/26/apps/installcustomappscreens/)
- [Coolify persistent storage is not a backup](https://coolify.io/docs/applications/configuration/persistent-storage)
- [Cloudron's custom app packaging and read-only container model](https://docs.cloudron.io/packaging/)
- [Render paid persistent disks, single instance and snapshot limits](https://render.com/docs/disks)
- [Railway volumes and backups](https://docs.railway.com/volumes/reference), [scheduled snapshots](https://docs.railway.com/volumes/backups)
- [DigitalOcean App Platform does not support persistent volumes](https://docs.digitalocean.com/products/app-platform/details/limits/)
- [Google Cloud Storage FUSE not POSIX-compliant](https://docs.cloud.google.com/storage/docs/cloud-storage-fuse/overview)

## Archive/storage evaluation

| Family-owned destination | Human browsing | Suitable now | Proposed adapter order | Portability/privacy notes |
| --- | --- | --- | --- | --- |
| Separate local/NAS backup directory | Yes | **Manual** with operator-controlled backups only; app currently preserves originals in a private folder, but same-disk copy is not disaster recovery | Baseline filesystem archive + independent restore proof | Local filesystem originals can be exported; must have second failure domain |
| **Google Drive** owner-chosen folder | **Excellent** for many families | Existing mounted/synced Drive folder is **photo import only**; not native storage/backup | **1st consumer-friendly verified off-device backup**, then optional primary originals | Narrow `drive.file` permissions where feasible; owner can browse exact originals, provider can process data; API scopes, quotas and OAuth verification required |
| **S3 / S3-compatible object store** (AWS S3, R2, B2) | Developer/console oriented | Planned independent backup only | **1st reusable object-store adapter** with provider-specific tested auth/retention + manifest roundtrips | S3-API compatibility is not identical versioning/IAM/key management across providers; test each and never equate bucket with SQLite filesystem |
| **OneDrive / Dropbox** | Familiar to Microsoft/Dropbox families | No connector | Later provider plugins if demand | APIs, refresh grants, quotas, sharing and restore tested independently; not a reason to block first release |
| **Nextcloud / WebDAV** | Familiar to privacy-minded self-hosters | No connector | Later self-hosted storage plugin | Auth, encrypted transport, transaction semantics, idempotent hash checks and operator patching |

The **default** is still a local SQLite metadata/runtime store and independent immutable originals/snapshots. An off-device verified mirror with automatic verification is an earlier and safer milestone than swapping runtime storage. The family can change the backup location without rewriting story/user code.

Reference: [Cloudflare R2 S3-compatible API](https://developers.cloudflare.com/r2/api/), [Google Drive per-file access](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google option](GOOGLE.md).

## Ways a family can consume Being There

| Channel | User experience | Plan |
| --- | --- | --- |
| **Secure HTTPS website** | Any modern browser, organizer or contributor can upload; tablet user can simply browse/tell stories | **Existing**; improve branding and simple onboarding |
| **Home-screen PWA / installed website** | One large Being There icon on iPad, Android tablet or phone, full-screen-ish controls, quick relaunch | **Next**, add manifest/icon service worker as needed; **never cache private API responses or media without separate security design**, no blanket offline download |
| **Dedicated simplified tablet launcher** | Curated family-approved device opens Tablet view directly, large Next/Play/Record; optional session reauth for caregiver | **Next**, device onboarding and expiry/revocation needed; *never* anonymous/public URL or profile-is-login |
| **Family portal / Google Site / homepage link** | Family member opens a link labelled "Open Being There" | **Link works now**, embed only with approved frame origin/cookies/permission testing; Sites is not backend hosting |
| **Private home-only access / Tailscale Serve** | Existing family devices on a controlled private network can open app without opening a public inbound port | **Optional advanced host setting**. Each invited user/device may need tailnet membership; app auth still enforced. Tailscale **Funnel** is internet-public and must not be called private |
| **Printable QR code / invitation link** | Owner shares an easy path to sign-in or an intentionally limited one-time invitation | **Near term** after verified onboarding; never encode unrecoverable secrets into broadly displayed QR codes |
| **Offline read-only portable viewing / native iOS/Android** | Travel and no-network use | **Defer**, because decrypted caches, revoked access and media on unmanaged devices need explicit privacy/recovery controls |

Sources: [Safari Add to Home Screen](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27), [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [Tailscale Funnel vs private sharing](https://tailscale.com/docs/reference/funnel-vs-sharing).

## Priority: maximize family value per adapter, not number of logos

**P0 (shared platform contract)**
- Pin and sign an OCI container; Docker Compose with durable `DATA_DIR`/separate archive, TLS, readiness, one instance/SQLite writer, proper file modes and graceful snapshot/upgrade/rollback. No included family credentials.
- Make a **provider-neutral deployment manifest/config** (run location, public origin, family identity issuer, external archive destination and credentials in secret stores). Add "doctor" preflight to detect invalid mounted storage, unreadable secrets, external accessibility, HTTPS mismatch, empty/old backup and account ownership.
- Deliver **common verified backup + export/restore** contract; test on a truly separate host without original database. Every install path requires it before real families upload.
- Add screen-level in-app **owner setup/health dashboard** that explains who runs this instance, who owns its archive, last verified remote backup, whether Tablet view is private, update version and export/restore route. A familiar contributor never needs the cloud-provider console.

**P1 (lowest-friction choices)**: guided AWS stack (existing #13/#14/#15) **and** simple Docker Compose/Home/NAS install from the **same pinned container**; validate managed-host single-instance option (Render or Railway) using own account/disk plus verified off-host backup; build Drive backup connector (#17) alongside a generic S3-compatible one. Add PWA/tablet homescreen entry experience. Release provider templates only after live credentials, real invite and off-host restore validation.

**P2 (broaden only on proven demand)**: alternative VPS buttons (one from Hetzner/DigitalOcean/Lightsail), NAS import manifests (TrueNAS/Cloudron/Coolify), OneDrive/Nextcloud adapters, optional iframe and selected additional languages. No AWS-only features in core.

**Deferred/research**: purely serverless GCP/Cloudflare/Vercel rewrites, enterprise multi-tenant hosted service and downloadable offline private gallery unless demand and security/maintenance justify them.

## Rule for offering a new deployment badge

A new entry must produce public, synthetic, reproducible evidence: first launch; external HTTPS + exact provider callbacks; independent organizer/contributor access with outsider denied; photo/video/audio originals and attributed story saved; kill the entire application host; restore to a separate instance/provider with byte-exact checks; old tokens and invitations denied; upgrade, revocation, and documented offboarding; explicit monthly costs, ownership and logs privacy. **No new provider merely because it exposes a Deploy button.**

**Cross-provider implementation:** [Portable OCI/Compose #19](https://github.com/Being-There/community/issues/19), [managed persistent-volume candidate #20](https://github.com/Being-There/community/issues/20), [tablet/PWA/secure invite #21](https://github.com/Being-There/community/issues/21).

**Related existing work:** [AWS deployment #13](https://github.com/Being-There/community/issues/13), [Cognito onboarding #14](https://github.com/Being-There/community/issues/14), [S3 backup #15](https://github.com/Being-There/community/issues/15), [portability and novice pilot #16](https://github.com/Being-There/community/issues/16), [Google Drive #17](https://github.com/Being-There/community/issues/17).
