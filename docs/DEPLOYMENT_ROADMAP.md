# Being There — simple family onboarding

**Product direction (not a shipped service):** A family opens a website, signs in, chooses where memories are stored, and starts enjoying them. We want this to work for someone with no knowledge of hosting, GitHub, DNS, databases, Docker or cloud consoles.

**Current reality:** The public Community Edition is a self-hosted technical preview using Node.js, SQLite, a private filesystem archive and manually configured Google OAuth/HTTPS. There is no hosted family service, native Drive storage, single-click installer or completed independent-family privacy review yet. Keep the original private family installation separate.

## Non-negotiable release gate: family-held E2EE only

**[Zero-access privacy and security commitment](SECURITY_PROMISE.md) is now the top architectural requirement.** All sensitive family photos, videos, voice recordings, stories, profiles, tags, derivatives and metadata must be encrypted on an authorized device *before* upload. Only family-authorized devices hold decryption keys. No hosted Being There backend or cloud storage service receives those keys or plaintext. The current public app DOES NOT do this; no hosted launch or real family rollout until full E2EE, shared-device invitations, family-held recovery, exact-byte restore and independent review pass. An AWS KMS key, HTTPS connection or a family-owned Google Drive account is **not sufficient** by itself.

The launch question is therefore **not** "where do we host plaintext?" but "can people enjoy and share E2EE family stories through a simple web app without the operator holding keys?" Existing technical deployment cards are supporting work and may not authorize a lower-security edition.

## The family journey

1. **Open Being There.** A regular web link on a phone, computer or tablet; eventually an installable home-screen shortcut.
2. **Sign in.** Start with Google, with additional identity providers later. One family organizer invites other contributors. A person using Tablet view can enjoy the family collection without technology prompts; device access still requires an appropriately authorized session.
3. **Choose storage.** The organizer connects a private family-owned location. **Google Drive first to evaluate**, then other provider choices such as S3, OneDrive and a local/NAS folder. No one needs to grant individual relatives direct storage-provider access just to use the app.
4. **Enjoy memories.** Add photographs, short videos and recorded stories; invite family; verify that originals and a portable backup belong to the family. A shared memory does not have to feature the tablet user.

Everyday family members should only see **Family space** (contribute/organize) or **Tablet view** (enjoy/listen/optionally tell stories). Technical details belong in advanced help or community documentation.

## Three high-level product options

| Experience | How the family starts | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| **Hosted web app + connected family Drive** | Open site → Google sign-in → authorize private Drive folder → invite family | Easiest onboarding. A hosted backend that keeps storage tokens may be able to read family data. A browser-direct Drive approach could reduce backend custody but needs its own collaboration/auth design. | **Evaluate first** |
| **Same hosted web app + another family-controlled store** | Open site → sign in → connect supported bucket/folder | More choice and portable archives; requires provider-specific permissions, backup and recovery tests | Next, reuse same app |
| **Family-owned deployment** | Use a guided installer or ask a technical helper to deploy into the family's account/home server | More direct infrastructure and key custody, more setup/maintenance | Always an option, community-enabled |

This is **one web app with choices**, not separate Google/AWS/NAS applications. Google Sites may link to the private app but does not host its Node/SQLite API.

## Only two architecture decisions should gate the experience

### 1. Authentication and family authorization

- **Sign-in** identifies a real person: existing implementation supports Google OAuth, with configurable family-owned credentials. Evaluate Microsoft or email/passwordless after the basic web flow works.
- **Invitation** controls family access; only authorized people can see media or contribute. Verified roles, expiry, revocation and account recovery still matter.
- **Tablet use** is a simplified interface, *not* a public URL or permission bypass. A caregiver can set up an approved device or session; patient/storyteller/person profiles remain separate from login identities.

### 2. Storage and data custody

- The organizer selects a family-owned destination. Ideally originals, recordings and a portable history/metadata archive are readable and exportable without a continuing Being There subscription.
- **Drive as a first option**, not a mandatory dependency. Add other stores through adapters once there is demand.
- The existing app has **local SQLite runtime state and filesystem originals**. Moving primary storage to Drive/S3 isn't implemented and cannot be implied by connecting a folder. A web service may still need a secure database for accounts/indexing and a secret store for provider refresh tokens.
- Be explicit about the trust model: if the Being There operator hosts a backend holding Drive OAuth tokens, it has technical ability to access permitted content. A family-owned deployment provides more control. Neither configuration should be called zero-knowledge without a separately verified encryption design.
- **Nonnegotiable:** no cross-family leakage, private-by-default access, a verified independent backup/export, and successful restore on another host without restoring old invitations/sessions.

## Next product validation, not more infrastructure design

- **Proof of the simplest flow:** use *fictional* test content to prototype a hosted web sign-in, invited second person, connected test Drive folder, photo/video/audio contributions and private tablet view. Decide whether a browser-direct Drive model or a small trusted backend is actually maintainable. Record clearly which party can read tokens and content.
- **Proof of family ownership:** verify original-byte export and clean restore with credentials revoked; show the owner where their data lives and how to leave.
- **Usability trial:** someone unfamiliar with servers gets to a first private memory without an operator explaining cloud services. If not, simplify the product rather than add another provider.

Existing work to reuse: [Google Drive option #17](https://github.com/Being-There/community/issues/17), [identity/onboarding #14](https://github.com/Being-There/community/issues/14), [backup/recovery #15](https://github.com/Being-There/community/issues/15), [family usability pilot #16](https://github.com/Being-There/community/issues/16) and [private tablet/PWA access #21](https://github.com/Being-There/community/issues/21).

**Community-led implementation details (not blocking the design decision):** [portable container #19](https://github.com/Being-There/community/issues/19), [AWS guide/deployment #13](https://github.com/Being-There/community/issues/13), [managed hosting evaluation #20](https://github.com/Being-There/community/issues/20), [other deployment choices](deployment/OPTIONS.md), [AWS spec](deployment/AWS.md) and [home server spec](deployment/HOME_SERVER.md). Their existence should not turn a family-facing product into an infrastructure project.
