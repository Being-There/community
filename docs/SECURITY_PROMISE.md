# Being There security and privacy commitment

**Approved product requirement: Level 3 only.** The intended Community Edition shall be **end-to-end encrypted (E2EE) by default for all family memory content**. No hosted or self-hosted route is allowed to weaken this to storage encryption alone. **This is a release requirement, not a currently verified capability.** The existing public technical preview stores recoverable plaintext originals, family metadata and archive data in its private server storage. It must **not** be represented as having end-to-end encryption or zero operator access. No real family content should be introduced to an unreviewed Community deployment.

## What we want Mom to be able to rely on

> Your memories are encrypted on your device before we store them. Only people your family authorizes receive the keys to read them. Being There's backend does not have those keys and cannot open or recover your memories for you. Your family can keep its encrypted originals and archive in storage it controls. If you lose all your recovery methods, we cannot restore your memories.

This statement becomes a **publishable capability claim only after independently reviewed, adversarially tested E2EE implementation and verified deployed client artifacts**. Say **"designed so our servers cannot read your memories"** until proof exists; don't say "impossible under any circumstances" or "zero risk."

**Non-negotiable:** No vendor/operator/developer, analytics service, transcription vendor, backend role, shared OAuth app, cloud KMS key or service-held recovery secret may decrypt a family's memory contents. Zero-knowledge excludes server-managed copies of the user encryption key. Avoid "zero liability": the project can minimize access/risk but cannot promise that legal/security responsibilities vanish. Consult counsel before shipping Terms/Privacy policies.

## What is encrypted

Encrypt **before upload**, on an authorized family device:

- Photo, video and audio originals; generated thumbnails, preview renditions and voice clips.
- Story text, transcripts, notes, titles, captions, reactions, people/location tags, associations, family/person profiles, comments and personalized prompts.
- Full export/archive manifests, indexes and private filenames/labels (encrypt or replace with opaque IDs; no confidential information in URLs/logs).
- Any extracted/AI-derived outputs. AI/transcription should run on-device, or only with a deliberately separate per-use disclosure and client-enforced opt-in. No silent plaintext sent to a vendor.

Server may need minimal routing metadata: opaque family/item IDs, encrypted object lengths, encrypted blob version, access-grant routing, ciphertext hashes, limited timestamps, account identifiers and consent/audit events. **This metadata can reveal relationships, activity, file sizes, IP addresses and who logs in**; we cannot honestly claim complete anonymity, no data collection, or that Google/host providers see nothing. Minimize retention, document logs and never include plaintext in operational telemetry.

## Simple family flow

1. **Sign in** with Google or another identity provider. Identity proves *who is requesting access*, not who holds encryption keys. Google OAuth/Drive permissions cannot decrypt content by themselves.
2. **Create family album.** A strong family encryption key is generated locally on an approved device. Encrypt the album key for each approved contributor/device using audited key-wrapping primitives; the backend stores **encrypted key envelopes only**, never the underlying private keys.
3. **Invite family.** Authorized member verifies a new recipient/device and shares the family key through an E2EE device-to-device invitation, with the private key remaining on that recipient's device. Never email the master secret or place it in a QR/link that can be publicly copied. The application enforces invitation/membership *and* E2EE key possession.
4. **Enjoy memories on tablet.** An organizer securely provisions the tablet with a limited device grant and encrypted key envelope. The person using the simplified view does not need to manage secrets. A lost tablet can be denied future access; previously downloaded or viewed copies can't magically be taken back.
5. **Save/recover.** The family receives a clearly labeled **offline recovery key or securely encrypted recovery kit** and is encouraged to have a second trusted device/guardian. A lost device can be re-enrolled with a valid recovery method; **lost all devices and recovery material = no Being There recovery**.
6. **Move storage.** Store only ciphertext and encrypted manifests in Google Drive (owner-selected folder), S3 or another destination. A family can export encrypted files independently. Local decryption/export is possible **only on a family-authorized device**. Drive itself should not be expected to preview arbitrary encrypted app files as normal photos.

## Architecture constraints

- **Device encryption:** Browser-side Web Crypto or an independently audited E2EE library on HTTPS, with standard authenticated encryption, distinct random encryption nonces, random per-object keys, strict authentication of ciphertext and versioned formats. Specify key lifecycle, rollback/replay defense, tamper detection, rotation and recovery before implementation. Do not invent homegrown cryptography or assume a password/passkey *alone* is a family encryption key.
- **Family key sharing:** Device/member public keys and wrapped family/content keys; invitations with verified fingerprints/trust binding, protection against server swapping public keys, account recovery and device revocation. Do not silently let an organizer, service or project operator recover plaintext from encrypted blobs.
- **Backend is blind to content:** Backend validates family membership, routes opaque ciphertext and envelopes, enforces quotas, and never logs content, passwords, plaintext images, decrypted keys or unencrypted archive manifests. A malicious backend must not be able to impersonate a recipient without detection. Cloud IAM/KMS/SSE and HTTPS remain useful defense-in-depth **but not the E2EE mechanism**.
- **Same policy on every deployment:** central hosted service, AWS, local/NAS, Google Drive and S3 all use the same client-side encryption format and keys. No "unencrypted fast mode", server-side legacy compatibility mode or downgrade allowed for sensitive family data.
- **Client-code trust:** A web app can decrypt in a browser, so a compromised website/update, malicious extension or infected device can steal plaintext while it is displayed. Use reproducible/versioned/signed client releases where feasible, restrictive CSP, no unnecessary third-party scripts, dependency pinning, audited deployment and code review. Provide a verifiable standalone client path for families requiring stronger assurance than just trusting a live website. **Never claim the hosted operator is physically incapable of pushing malicious code**—the promise is a verified architecture and an operational commitment, not a mathematical proof of trustworthy future JavaScript.
- **Storage:** Google Drive authorization `drive.file` should grant narrow access to selected/created *ciphertext* files. Drive tokens still grant ability to read/change/delete ciphertext and metadata, so least privilege, token lifecycle, integrity verification and independent backups remain required. Server-side OAuth token storage should be avoided where practical; if needed, explain it does not confer decryption ability but can disrupt or remove encrypted files.
- **Recovery, removal and deletion:** Revoke server grants and rotate keys on removal where appropriate; recognize a removed contributor may keep earlier content/keys. Encrypted backups need verified integrity and robust user-held recovery. Differentiate stop displaying, archive retention, and permanent deletion including provider version history and backups.

## Hard release blockers

No real-family hosted deployment, public one-click button or stronger privacy claim until all these are true:

1. Real encrypted upload **and** encrypted download of photo, video, audio, story text, derived previews and metadata. Backend/database/archive/media responses are ciphertext only; inspected with synthetic secrets and traffic capture.
2. Negative tests: an attacker with **complete backend database, admin/storage permissions, OAuth refresh tokens, encrypted exports and server logs** cannot recover plaintext or a usable decryption key. Server cannot mint a fake trusted member/device without a detectable verification failure.
3. Invite, multi-person contributor, limited tablet device enrollment, lost-device revocation and per-recipient key delivery all work. New family account isn't assigned keys because of a display profile name.
4. Lose server, restore ciphertext from an independent family-selected provider, recover using **only family-held** keys, verify exact original bytes and story attribution. Confirm operator cannot perform recovery alone.
5. Recovery-kit loss scenario explained honestly; repeated recovery and member removal/rotation tests; real mobile-browser accessibility. Metadata exposure described in accessible language.
6. Independent cryptographic architecture review and app/browser client release-supply-chain security review. Passing test CI is not enough.

## Commitment versus guarantee

**Can commit:** We won't request or retain plaintext or the keys to decrypt family memories on our servers; we won't sell or train AI on family content; we'll give families encryption and independent recovery controls; we'll be transparent about data/metadata, incidents, limitations and updates.

**Cannot promise:** No vulnerability, no legal liability, zero observable metadata, no compromise of family devices, that approved relatives won't save copies, or that code delivered from our website could never be modified or compromised. A third-party hosting/storage operator also has separate legal and operational responsibilities.

### Reference material

- [MDN Web Crypto API and cryptographic implementation risks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Google Drive narrow-per-file access](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [OWASP key lifecycle and recoverability](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet)
- [Google's browser-code threat model](https://github.com/google/end-to-end/wiki/Threat-model)

**Implementation priorities:** replace all existing plaintext upload, archive, derived media and metadata paths, then validate E2EE key sharing/recovery and blind hosted storage. Keep the project-family's private installation out of scope unless separately approved.
