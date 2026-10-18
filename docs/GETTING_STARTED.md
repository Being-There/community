# Getting started with Being There

**Our family trust commitment:** [No ads, no tracking, no project access to memories, and recovery independent of Being There](TRUST_COMMITMENT.md). These protections are mandatory release goals; the current technical preview has not yet passed verification.

**Our direction:** Being There will give families software for **their own private web app**. Being There itself will **not** host, relay, store or handle anyone's memories—even encrypted files—and will not receive family access tokens or recovery keys. Read [what no custody means](NO_CUSTODY.md).

**Today:** The public Community app is an **advanced technical preview**, not a novice-ready installation or an end-to-end encrypted release. Do not upload real family photos or stories to the Community preview.

## How it should work

1. **Choose a family-owned installation.** A guided cloud installer in an account you own, or a trusted helper using your home/NAS. The public Being There site provides instructions and software, **not** accounts or storage.
2. **Open your family's private web link.** The application you use runs in **your account**, not ours.
3. **Sign in and invite family.** Your own installation uses Google or a supported login provider and keeps all permissions and keys separate from the open-source project. Authorized relatives can contribute; Tablet view helps someone simply enjoy memories.
4. **Choose where your vault lives.** Google Drive or another supported private destination in your account. On-device encryption creates *new encrypted Being There copies*; imported originals in your existing folders are not moved, overwritten or encrypted in place.
5. **Save family recovery.** A second trusted device plus an offline recovery kit, and independent encrypted backups, keep new stories recoverable without us.

No clinical questions, quizzes or need to remember names. Enjoying a photo is enough.

### Can Being There staff see my memories?

The **goal of this new architecture is that our project never handles family media, even encrypted data**, and never has your login/storage tokens or decryption keys. Your own chosen cloud/storage provider still stores data under its own terms. A pre-existing unencrypted Google Drive photo remains readable to the people who already have access. The Being There encrypted copies can only be opened on approved family devices.

Even with encryption, losing **all** family-held keys would make new protected stories unrecoverable. We must make recovery easy and test it before declaring this ready.

### Can I try it right now?

A technically comfortable helper may run the [synthetic local interface preview](../README.md#try-the-actual-interface-locally). It is **fictional and disposable**, and its server-readable storage is **not yet Level 3 E2EE**. Do not enter real memories.

For advanced private testing, see [operator reference](../packages/app/README.md). The [roadmap](DEPLOYMENT_ROADMAP.md) and [installer options](deployment/OPTIONS.md) describe future family-ready choices. We will not host another family's live installation on the project site.
