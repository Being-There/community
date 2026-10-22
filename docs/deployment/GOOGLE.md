# Google identity and family-owned Google Drive

**Design, not a completed native integration.** Being There Community's current Node/SQLite technical preview has Google OAuth sign-in and a host-folder photo importer, but no native Google Drive API writer/reader and no supported Cloudflare Pages/Workers runtime adapter. [Google integration issue #17](https://github.com/Being-There/community/issues/17).

## Default family design

- **Identity:** Google sign-in using the organizer's family-owned OAuth client and callback in their private Being There installation. Verify Google's subject and authenticated ID token; never treat an email string or Google account alone as a family membership.
- **Family authorization:** Only verified invitation recipients may accept a single-use invite. Every private read/write checks active membership for the exact family and relevant role/scope; anonymous or uninvited users are denied. A revoked member loses future access even while signed in.
- **Storage:** Organizer independently consents to the relevant Google Drive API scopes and chooses a visible, private family archive folder. Use least privilege, ideally `drive.file` with Google Picker and provider-tested folder/file selection. Google sign-in does **not** automatically grant Drive access. An API key alone cannot authorize private Drive content.
- **Private calls only:** Google Drive access/refresh tokens never leave the family's server-side secret storage; never expose them to browser JavaScript, media links, logs, Being There project infrastructure or source control. Verify a requester is authenticated **and currently authorized for that family and specific operation before any Drive credential access, download, list, upload, delete, job or API call**.
- **Google sharing:** Do not create public or 'anyone with link' permissions or render direct sharable Drive media URLs. Serve authorized reads through the family's own API with no-store/private cache behavior and checked permissions. Protect all media formats, previews, thumbnails, HEAD and Range requests.
- **No custom encryption keys:** Require HTTPS/TLS and Google's built-in encryption at rest, but do not add Being There content encryption, recovery secrets or opaque ciphertext vaults. Backed-up photos/audio must remain viewable/exportable in normal formats outside Being There. **This is not end-to-end encryption**; Google and sufficiently privileged family administrators may access content.
- **Do not alter sources:** Never modify, delete, rename or encrypt pre-existing originals in place. Owners should be able to inspect, download and move the app-created archive independently. New stories and database metadata need versioned, independently verified backups too.

## Permission model

**Unauthenticated visitor:** may view only explicitly public introductory pages and begin Google sign-in, but cannot read any family record or cause a Drive operation.

**Google-signed-in account, not invited:** may finish authentication and see an empty personal family list, but cannot enumerate family names or objects, fetch private media or call Drive. It cannot accept another person's invite.

**Invited recipient before acceptance:** may preview only a recipient-bound invitation; family data remains forbidden until acceptance.

**Active contributor:** may read/add within granted family scope, but cannot issue/revoke invitations or export/administer the family.

**Active organizer:** may manage invitations, roles, export and configure Drive with fresh verification for sensitive actions. Revocation immediately blocks further API and Drive activity on that membership.

## OAuth and API design acceptance

1. Family-created OAuth app/client, exact HTTPS callback, browser PKCE/state/nonce and verified Google ID tokens. Provider approval and consent-screen requirements must be tested and documented. Don't claim setup is zero-click without verified automation.
2. Separate Google Drive OAuth grant issued only after explicit organizer action; disclose requested scope and account. Refresh tokens are family-owned server secrets, not a Being There shared token broker.
3. Authenticate and authorize every Google Drive operation **before** loading any credential, contacting Google or queuing delegated work. Treat background job authority as an expiring, owner-initiated, narrowly scoped capability. Never authorize an untrusted client simply because the family account previously consented.
4. Automated negative tests must assert **zero Drive API calls** and no content/token disclosure for logged-out, Google-only nonmembers, expired/incorrect/replayed invite, revoked user, cross-family IDs, wrong role, CSRF failure, content HEAD/Range, cache and public-link attempts.
5. Validate source preservation, readback/checksums, permissions, quota/rate limits, token revocation, empty/lost folders and clean-host restoration with synthetic media.

## Hosting choices

Cloudflare can provide family-owned hosting after an independently validated compatible application/runtime and durable storage design; it does **not** eliminate Google OAuth configuration. Google Sites may link to the app; it does not run the private backend. Home servers and other cloud hosts must enforce the same privacy and authorization rules. No Being There-operated OAuth callback, app server, Drive data relay or support upload is allowed.

See [no custody](../NO_CUSTODY.md), [security](../SECURITY_PROMISE.md) and [roadmap](../DEPLOYMENT_ROADMAP.md).
