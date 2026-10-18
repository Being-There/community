# Frequently asked questions

### Does Being There host my family's memories?

**No—that is the permanent product direction.** We will publish open-source software and guided installers, not operate a central family service. Your installed instance, login identity provider, encrypted vault and backups live in systems **your family owns or chooses**. We will not receive ciphertext, plaintext, OAuth storage credentials or decryption keys. This is a **target for family-ready releases**, not a claim that the current technical preview has finished E2EE review. [No custody design](docs/NO_CUSTODY.md).

### Can Being There administrators read our photos or stories?

The design explicitly forbids any project-operated storage, proxies, keys or account system for family content. The installed app will also enforce family-held end-to-end encryption before upload. However, an authorized family device or malicious app update can expose plaintext; families need to approve software updates. Independent review is required before this becomes a verified security claim.

### Do I need a Google developer account or API key?

**Not an API key** for private Drive access; OAuth permissions are needed. For this no-custody design, the Google callback/tokens **must stay with your installation or device**, not with Being There. We'll explore a guided setup/owned identity tenant so a regular family isn't forced through a developer console. **That frictionless path has not been built or verified.** Existing advanced installs require a family-owned Google OAuth client.

### What if we use Google Drive?

The software creates a separate encrypted vault in your own Drive. It must never encrypt/overwrite/move/delete your existing photos in place. Old source photos keep their ordinary Google permissions; your Being There vault contains new encrypted copies, stories and archives.

### If we lose a tablet or stop using Being There, will the memories survive?

Planned family-ready installs must support a second approved recovery device, offline recovery kit, independent encrypted backups and a portable offline decryption/restore tool. If **all** keys are lost, vault-only encrypted stories cannot be recovered, so safeguarding keys is essential.

### Can I use a phone, tablet or web browser without knowing anything technical?

That's the goal. Open the private web link belonging to **your family installation**, sign in and enjoy shared memories. The software may be installed by a cloud guided flow or trusted technical helper. The public project site is not a family login portal or photo-upload service.

### Is the Community Edition ready for real family data?

**No.** The v0.1.0 public app is a technical preview, **not yet end-to-end encrypted**, and has not passed full real-provider, independent security, recovery or novice onboarding gates. Please use only fictional content in tests.

### Can the project guarantee no legal liability or zero possible security incidents?

No. This project can make a strict verifiable **no project custody** design commitment, but software risk, third-party hosting, law, and compromise of an authorized client remain real.

### Does Being There diagnose dementia or require medical information?

No. It's for enjoying family memories and sharing stories, not clinical testing. No diagnosis is necessary.

### Can I contribute to the public code?

Yes. [GitHub participation](CONTRIBUTING.md) is public. Do not put personal memories, recordings, account details, diagnoses, credentials or family URLs in issues or PRs. Use fictional examples.
