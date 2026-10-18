# The Being There Trust Commitment

**Your memories. Your home. Your future.**

Being There is free, open-source software to help families preserve and enjoy their stories. We publish the software. **You operate your family space, control its storage and keys, and decide who can participate.** We will never run a service that receives, relays, stores, analyzes or backs up your family content—not even encrypted copies.

## What we commit to

- **No ads, ever in the software.** No sponsored placements, ad networks, advertising identifiers or advertising SDKs.
- **No data business.** No selling, licensing, profiling or training AI on family memories. No project-operated analytics or mandatory telemetry of family use.
- **No custody.** No project-controlled accounts, private APIs, OAuth callbacks, content relays, key escrow, support uploads or backups. Private installations and approved code versions belong to families.
- **No hidden access.** Family-held encryption keys; family-approved invitations and devices. Do not ship backdoors or undisclosed remote-control features. No automatic remote scripts that allow project maintainers to read content.
- **Built to outlive the app.** Documented portable encrypted archives, unmodified imported originals, independently verified backup copies, family-held recovery methods and a standalone open-source offline restore/decrypt tool.
- **Honest communication.** Public code, documented permissions, transparent limitations, clear security reporting and no claims ahead of independent verification.

## What this does not mean

**We cannot promise “no data leaks.”** A vulnerable family device, compromised hosting provider, stolen recovery key, malicious software update or an authorized recipient copying content could expose memories. Encryption cannot erase copies already seen. Third-party providers selected by families have their own terms and may observe metadata. An unencrypted original in a family's pre-existing Drive remains under its existing permissions. If all family-held keys and recovery methods are lost, encrypted-only stories may become unrecoverable.

**We cannot promise forever.** Storage providers can fail, accounts can close, backup copies can be corrupted and formats can age. We can design for independent preservation and test restoration, but the family must maintain backups and recovery material. We cannot guarantee zero legal liability or absolute protection.

## Proof before any family-ready release

1. No real-family content, ciphertext, identity/token, logs or telemetry ever routes to project-controlled infrastructure. Audit network calls and build artifacts.
2. End-to-end encryption on approved devices for photos, recordings, transcripts, tags, thumbnails and archives. No project or family-hosting server holds decrypting keys.
3. No ads, tracking libraries, analytics beacons, remote executable scripts or undisclosed support access.
4. Import leaves pre-existing originals unchanged. New stories are verified in at least two independent encrypted backup locations with versioned restore points.
5. A family can restore exact media bytes, story attribution and private metadata **offline**, using only its own keys, without Being There or the original hosting provider.
6. Independent security review, reproducible/version-pinned software delivery, key recovery/loss drills and a novice-friendly family installation trial with fictional data.
7. A plain-language privacy notice states what the family-selected cloud provider can see, what we cannot see, costs, retention/deletion behavior, and the limits above.

**Current status: NOT YET VERIFIED.** The public Community v0.1.0 technical preview is not end-to-end encrypted and lacks the completed family-owned beginner installer and independently tested offline recovery path. Use fictional data only. This document is a binding **project design and release standard**, not a certification that the existing software already meets it.

See [No Custody](NO_CUSTODY.md), [Security Promise](SECURITY_PROMISE.md), and [Deployment Roadmap](DEPLOYMENT_ROADMAP.md).
