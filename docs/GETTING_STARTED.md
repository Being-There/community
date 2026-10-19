# Getting started with Being There

**Our family trust commitment:** [No ads, no tracking, no project access to memories, and recovery independent of Being There](TRUST_COMMITMENT.md). These protections are mandatory release goals; the current technical preview has not yet passed verification.

**Our direction:** Being There will give families software for **their own private web app**. Being There itself will **not** host, relay, store or handle anyone's memories—even encrypted files—and will not receive family access tokens or recovery keys. Read [what no custody means](NO_CUSTODY.md).

**Today:** The public Community app is an **advanced technical preview**, not a novice-ready or independently security-verified installation. Do not upload real family photos or stories to the Community preview.

## How it should work

1. **Choose a family-owned installation.** A guided cloud installer in an account you own, or a trusted helper using your home/NAS. The public Being There site provides instructions and software, **not** accounts or storage.
2. **Open your family's private web link.** The application you use runs in **your account**, not ours.
3. **Sign in and invite family.** Your own installation uses Google sign-in with a separate, verified family invitation; logging into Google alone never grants family data access. Authorized relatives can contribute; Tablet view helps someone simply enjoy memories.
4. **Choose where your archive lives.** Google Drive is our preferred family-owned option. The organizer explicitly authorizes limited Drive access in addition to Google sign-in. Existing originals remain unchanged and normal readable media; project-specific encryption keys are not required.
5. **Check your backups.** Keep separately verified, versioned copies of new stories, recordings and metadata; export readable files that survive the application's shutdown. Google/provider account recovery applies, not a Being There-specific decryption key.

No clinical questions, quizzes or need to remember names. Enjoying a photo is enough.

### Can Being There staff see my memories?

The **goal is that our project never handles family media, even encrypted data**, and never receives your login/storage tokens. Your own chosen cloud/storage provider operates under its own terms and may have privileged access. Being There requires HTTPS/TLS in transit and provider-managed encryption at rest; it does **not** add end-to-end encryption or special family recovery keys. App data is available only through authenticated, active, invitation-authorized private endpoints.

New recordings and stories may have no previous copies. Make and test independent, readable backups; losing an account or provider can still cause data loss.

### Can I try it right now?

A technically comfortable helper may run the [synthetic local interface preview](../README.md#try-the-actual-interface-locally). It is **fictional and disposable**, and its server-readable storage is **not yet Level 3 E2EE**. Do not enter real memories.

For advanced private testing, see [operator reference](../packages/app/README.md). The [roadmap](DEPLOYMENT_ROADMAP.md) and [installer options](deployment/OPTIONS.md) describe future family-ready choices. We will not host another family's live installation on the project site.
