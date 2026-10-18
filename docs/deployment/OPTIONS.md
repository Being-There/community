# Ways families can run Being There

**One private web app, operated by each family.** [No project custody](../NO_CUSTODY.md) means the open-source project never hosts or relays anybody else's media, ciphertext, identities, OAuth tokens, backups or keys. [Client-side E2EE](../SECURITY_PROMISE.md) is mandatory for family-ready installers.

| Family's choice | What it feels like | Who runs the private app |
| --- | --- | --- |
| Guided cloud install | Follow a few steps, open your new family web address | Family's Google/AWS/other provider account |
| Home or NAS | A technical relative/helper sets it up, then family uses a web link | Family-controlled computer/NAS |
| Advanced own hosting | Developer deploys same open-source package | Family-controlled VM/provider |

**No centrally hosted Being There account or backend.** A familiar Google Sites page may *link to the family's app URL*, but does not host the Node/SQLite private API. The project's public site hosts only source, guides and fictional demos.

**Sign-in:** Google/OIDC can authenticate relatives when the account/client and callback belong to the family's installed instance, never project-operated OAuth. API keys do not authorize private Drive contents. We must automate legitimate provider setup as far as possible without central token custody.

**Storage:** Family selects separate E2EE vault on its own Drive, S3 or NAS. Imported source files remain untouched; new family stories need independent backups and family-held recovery. Device-side encryption keeps the hosting/storage provider from learning private contents, though identity/access metadata and the owner's pre-existing plaintext sources have separate exposure.

**Software-delivery boundary:** Family owns its installed app origin and verifiable pinned client release, with updates it approves. If the project serves alterable JavaScript to approved devices, it could read plaintext during viewing; that is **not an acceptable route** for an unconditional no-access promise.

**Community:** Provider guides and packaged templates can vary. Security, no-project-custody and full offline restore cannot vary by tier. This list is a design comparison, **not yet a set of delivered beginner installers**.
