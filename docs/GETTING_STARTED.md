# Getting started with Being There

**Today:** Being There is a public, self-hosted **technical preview**. There is no hosted family web service, native Google Drive storage integration or one-click family installer yet. The separate private family application and real family media are not included.

**Our privacy requirement:** Only family members and their approved devices get the keys to decrypt memories; the Being There service doesn't hold them. See the [zero-access security promise and current implementation gap](SECURITY_PROMISE.md). This is **not yet true** of the existing Community technical preview. The plan to sign in and connect Google Drive must include encryption **on the device, before upload** and easy family-held key recovery.

## What we're working toward

1. **Open a website** on a phone, computer or tablet. No software installation, GitHub or cloud-console account.
2. **Sign in and invite family.** Google sign-in is the initial technical foundation; future choices can include other common identities. Organizers approve who contributes. Tablet view lets someone simply enjoy photos and stories, without questions or pressure.
3. **Choose where memories live.** Start by evaluating a private folder in **your own Google Drive**, then add other storage choices. Families can browse, export and back up their originals. No need for every invited person to access the underlying Drive folder.
4. **Use it.** Share photos, videos and audio stories. A memory is part of the family collection—it doesn't have to feature or belong to the tablet user.

One web app supports these experiences. Google Sites and other family homepages can provide a link; they do not need to run the app.

### Who has access to the data?

We will explain this clearly during setup. Connecting a personal Drive folder does not automatically give end-to-end encryption. If a future hosted backend stores Drive tokens, it may access or delete the **encrypted** files and see limited metadata, but must not hold the keys that reveal the memories. The site supplying the viewing code and the family devices are also important trust points. Sign-in and invitations must protect who receives encrypted keys, and portable ciphertext backup and family-held recovery must work independently.

## What can I try now?

**See the interface:** A technical helper can launch a **fictional, temporary** preview using [the local run instructions](../README.md#try-the-actual-interface-locally). Never upload real family media to this sandbox.

**Run your own private instance:** An experienced Linux operator can follow the [advanced technical-preview guide](../packages/app/README.md). Google OAuth, HTTPS, private storage, backup and verification are currently the operator's responsibility. A real independent-family installation has not been fully verified.

**Want simpler installation?** The guided AWS setup, Docker/NAS packaging and other platforms are for the community to implement. [High-level direction](DEPLOYMENT_ROADMAP.md) · [Optional implementations](deployment/OPTIONS.md) · [Google/Drive approach](deployment/GOOGLE.md).

Being There supports connection and enjoyment; it is not a diagnostic test or medical device. Please never post family photos, recordings, credentials or medical information on public GitHub.
