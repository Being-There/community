# Ways families can use Being There

**Principle:** one private web application, several ownership choices. Technical provider-specific details are welcome as community contributions, but families should not be asked to understand them.

## Primary family-facing options

| Family need | Experience | Current status |
| --- | --- | --- |
| **Just use the app** | Hosted website, Google sign-in, private family invites, connect family Drive storage | **Design priority; no hosted service or native Drive API connector shipped** |
| **Use the app with other storage** | Same website, choose S3 / OneDrive / local archive when supported | Planned adapters, not separate applications |
| **Keep the entire installation in our account** | AWS guided setup, NAS/home-server installation or a trusted helper | Advanced manual Node install exists; guided installers not shipped |
| **Try before setup** | Disposable, fictional local preview run by a technical helper | Existing: [preview instructions](../../README.md#try-the-actual-interface-locally) |

## How to open it

The **secure HTTPS web app** is the default. Add a home-screen icon / lightweight PWA so tablets feel like an app. A family may link from Google Sites, a family portal or a private invitation. A direct link is safer and simpler than embedding authenticated content in an iframe. The simplified Tablet view and contributor Family space use the same server-enforced permissions. No anonymous link to private memories.

## Two decisions for the project

**Authentication:** Can a family organizer sign in, invite someone, recover access and revoke a session without technical support? Google OAuth works in the existing technical preview but is not yet a public hosted service. Additional Microsoft/other OIDC or passwordless methods are optional. An approved tablet device/session is not the same as a profile for the storyteller.

**Storage:** Can a family choose a private destination, know who has access, export originals and verify recovery independently? First test Google Drive as an owner-controlled folder; next offer one simple object-storage choice. Drive files are *not* a replacement for the current SQLite transactions until a new adapter is proven. The application may still retain account/index metadata. Server-held refresh tokens and operational access are part of the consent/trust disclosure.

## Hosting is an implementation detail for most families

Community engineers can package the same app for Docker/Compose, AWS, NAS, VPS or managed-volume hosting; none should turn into a separate product. Cloudflare Workers, static Sites and similar serverless platforms cannot run the current Node/SQLite filesystem backend without a rewrite. Provider-specific security, costs, backups and operational details live in the optional [AWS](AWS.md), [home/NAS](HOME_SERVER.md) and [Google](GOOGLE.md) guides, and issues [#13](https://github.com/Being-There/community/issues/13), [#19](https://github.com/Being-There/community/issues/19) and [#20](https://github.com/Being-There/community/issues/20).

**Go/no-go for any option:** An invited family can access photos/audio/videos; an outsider cannot; an owner can stop paying or lose the original host and still restore exact media and attribution onto another installation, with previous sessions/invitations disabled. Nothing called "one click" is production-ready before that test.
