# Frequently asked questions

### Does Being There host my family's memories?

**No.** We publish open-source software and installer guidance. Your private Being There app, identity, Google Drive archive and backups are operated in systems your family controls. The Being There project never receives your content, tokens or backups, even if encrypted. This is a release design commitment, **not a verified claim that the technical preview is family-ready**. [No custody](docs/NO_CUSTODY.md).

### Can Being There administrators read our photos or stories?

Project administrators should have **no route to your independently installed family app or Drive files**. Family administrators and the selected cloud/Google providers may have technical access under their own policies, because we do **not** add application-managed end-to-end encryption. We require TLS, provider-managed encryption at rest, private invited-only APIs and strong separation from project infrastructure. This cannot promise zero possible incidents. [Security](docs/SECURITY_PROMISE.md).

### Is having a Google account enough to open our family's memories?

**No.** Each person must sign in with Google **and** accept a verified, organizer-issued invitation to that specific family. Every private API call checks an active membership and appropriate role. Signed-in strangers cannot view photos, stories, thumbnails or metadata or trigger Drive file operations. Revoking a relative blocks subsequent access; it cannot erase copies they previously downloaded.

### Does every relative need a Google OAuth developer project?

No. The **organizer** must currently configure their family's OAuth client once for the advanced reference. Relatives just use their own Google sign-in and invitation. A guided setup to reduce organizer configuration is a planned feature, not yet completed.

### Is a Google API key enough for private Drive access?

**No.** The family organizer must explicitly grant the appropriate Google Drive OAuth permissions separately from sign-in. Those credentials stay in the family's deployment. There is no Being There-operated shared OAuth relay.

### What happens with Google Drive?

We aim to store normal, readable family files in a private folder the organizer chooses, using narrowly scoped access. Existing Drive photos must never be modified, encrypted or deleted in place. The current preview does **not** have a native Drive API adapter yet. No file is publicly shareable just because someone knows the URL.

### If we lose our tablet or Being There goes away, can we recover?

We will preserve standard-format originals and metadata with independent, verified backups and portable exports. There is **no special Being There recovery key** to lose. A family's ability to recover its Google/provider account and actual backups remains important.

### Can nontechnical people use it?

That's the objective: organizer-guided setup, then a family link, Google sign-in and a verified invitation. A caregiver may enroll a loved one's tablet. The released technical preview still requires a technical operator.

### Is the Community Edition safe for real family data today?

**Not yet verified.** v0.1.0 is a technical preview without a native Google Drive API connector, a tested Cloudflare deployment, or completed real-provider, independent security and novice-onboarding review. Use fictional content in tests.

### Can you guarantee zero incidents or legal liability?

No. No software can. We can commit to verifiable *no project custody* and deny-by-default permissions without claiming that Google, an authorized family administrator or attackers can never access data.

### Does Being There diagnose dementia?

No. The app is for enjoying family memories, not testing or clinical diagnosis.

### How can I contribute?

Use [public GitHub participation](CONTRIBUTING.md) with **fictional** examples. Never post family photos, stories, medical information, account details or credentials.
