# Family-held keys, blind storage and independent recovery

**MANDATORY:** [End-to-end encryption with family-held keys only](../SECURITY_PROMISE.md). This is the product's security bar for every hosting/storage option. The existing public technical preview is **NOT E2EE**, and its database, archive and JSON exports can contain **plaintext**. It is not suitable for real sensitive family stories and must not be marketed as zero-access.

## The simple promise

**Only an approved family device can unlock the family album.** Google Drive, Amazon S3, a NAS and Being There's hosted server can store, copy and restore the locked album, but none of them has the combination. Even a system administrator with the entire database, every stored backup and OAuth storage credentials should not be able to decrypt it. Someone controlling a family device, browser code or an invited person's copies remains a separate risk.

## What a family controls

| Asset | Where it belongs | Who can read it |
| --- | --- | --- |
| Photos, video, original audio, thumbnails, transcripts, captions, people/relationship/location tags and full private archive | **Encrypted before upload** on a family-approved device; ciphertext in family-selected Drive/S3/local storage | Only authorized family devices holding cryptographic keys |
| Family encryption keys | Generated on member device(s), protected with member/device keys and **family-held recovery material** | Authorized family members/devices; never Being There, host administrators or cloud KMS |
| Encrypted key envelopes | May be relayed and stored by backend with verified membership | Backend can route envelopes but cannot decrypt them; server must not silently replace trusted device keys |
| Identity, invitations and minimal routing metadata | Private application service | Backend sees a limited set of identities, token identifiers, opaque album/object IDs, ciphertext sizes and request times; **not zero metadata** |
| Google Drive/S3 OAuth or access token | Prefer authorized client; if server-held, protected and narrowly scoped | May permit ciphertext access, movement or deletion, but **not content decryption** |
| Recovery kit | With the family, outside Being There | Whoever receives recovery material may obtain album keys. No project/admin key escrow |
| Portable encrypted archive | Family-selected storage/offline backup | Restorable and independently integrity-verifiable; decryptable only with family-held keys |

Standard TLS, full-disk encryption, AWS KMS, Google OAuth, private buckets and HTTPS are helpful *additional* controls. **None is a substitute for E2EE**, and cloud-provider KMS must not be entrusted with the only key that unlocks family content.

## Plain-language onboarding

1. Organizer signs in and creates a private album: family key material is generated **on that device**.
2. Show a simple, explicit **Save your recovery key** step with practical options (encrypted recovery kit and a second trusted device); make the risk clear: *if all devices and recovery material are lost, we cannot get the memories back*.
3. Organizer invites another person/device and approves its key. The invitation and authenticated family membership alone are **not** a magic server-side decryption grant; only a trusted device sends an encrypted family key envelope.
4. Dad/Mom/tablet is provisioned securely by a caregiver. After that, they can just see/play stories. A displayed **person profile is not a login or a key**.
5. The app encrypts originals and private metadata locally. Storage provider receives only encrypted data; a Drive user sees files but cannot preview them as ordinary photos without a Being There-capable family device.

## Revoking an invitation and rotating family keys

A family organizer can stop future server access, revoke a lost device and rotate keys for **future content** or re-encrypt content if appropriate. It is **not** possible to make an invited recipient forget an older key or erase already saved copies merely by revoking login. Be explicit about this limit.

## Recovery test before hosting real content

Use fictional data: shared memory without person tag, two contributors, one limited tablet, a photo, short video, audio and transcript.

- Encrypt on each family device. Inspect backend database/logs, remote storage, exports and tokens; no plaintext or decrypting family keys are present.
- Destroy the original server and reinstall on a different provider. Restore **ciphertext** and prove only a family-held recovery kit or enrolled device can decrypt the exact originals and metadata.
- Attempt to restore using backend master/admin credentials, storage OAuth token, KMS access or a removed user. No device key → no plaintext.
- Exercise corrupt data, missing files, key envelope substitution, key-loss, stale backups, revoked storage permissions and incomplete re-encryption.
- Test and document a compromised browser/app update and how our code-release process resists supply-chain tampering.

## Hard truth about privacy and liability

End-to-end encryption protects **stored data** from the service operator. It does not make operating a website risk-free: malicious web code, device malware, social engineering, metadata and formerly authorized family copies remain in scope. No project can guarantee zero legal liability. Promise only what a reviewed and deployed implementation proves.

Reference: [E2EE policy](../SECURITY_PROMISE.md), [OWASP key management](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet), [browser cryptography warnings](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
