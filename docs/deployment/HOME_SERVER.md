# Home server and NAS — self-owned deployment route

**Status: future low-friction installer, not shipped.** The existing app supports an advanced Linux/Node setup; a tested Docker Compose distribution, prebuilt signed image, home-router/security setup wizard and no-CLI installer do **not** exist yet. See [current operator guide](../../packages/app/README.md).

## Target user

A family with a dedicated mini PC/NAS, or a trusted family helper, who prefers their content on their own hardware. The **same family data and archive format** must be importable/exportable between this and the AWS route.

## Planned guided setup

1. Pick a machine with up-to-date supported Linux/container runtime, enough space for original media and a backup disk/location. Show clearly whether family content can be accessed away from home.
2. Fetch a **pinned reviewed container image** and a small compose configuration; require an isolated host directory for `DATA_DIR`. Do not put actual media in the container image or ephemeral writable layer.
3. Bind app to localhost behind HTTPS reverse proxy. For access over the public internet, require an owned domain, secure DNS and router configuration; alternatively use a carefully documented private remote-access method, **not** an anonymous public tunnel.
4. Create owner-controlled Google OAuth credentials and secret store; configure exact HTTPS callback. Do not bundle a central developer OAuth client. Provision first organizer invitation by authenticated local admin action, never first-visitor-wins.
5. Invite family, load synthetic data first, then verify private image/audio retrieval and that unauthenticated requests cannot access originals.
6. Configure **automatic off-device backups** to a family-owned second storage location (e.g. separately owned NAS, encrypted cloud bucket or offline drive); verify backup integrity and actual recovery on a fresh host before loading valuable content. **Google Drive** is a planned optional remote archive; today's supported mounted/synced-folder photo importer is not itself off-device backup.
7. Show health and backup status without exposure of secrets/photos/story content; document how to update, roll back, export to AWS, and remove an authorized helper.

## Alternative hosting and access

A single pinned OCI image can be reused through Linux Docker Compose, TrueNAS custom app/Compose, Coolify or selected NAS package manifests; every platform still needs its own persistent storage and backup validation. A managed persistent-volume platform is a potential low-maintenance route after the baseline is secure. A private Tailscale Serve access path may help a technically managed household, but family members would need appropriate tailnet participation and it never replaces app invitations. See [host/access options](OPTIONS.md).

## Existing vs missing

| Area | Existing today | Needed before promoting this route |
| --- | --- | --- |
| Node app + persistent SQLite/private archive | Yes | Signed/reproducible container image |
| Local synthetic full-UI demo | Yes | Separate persistent install with full onboarding |
| Invite-only server authorization | Yes | Real account pilot and easy provider configuration |
| Full verified export / fresh family restore | Synthetic tests | Scheduled independent backup and actual host loss drill |
| Media upload + tablet presentation | Yes (with limits) | Tablet/browsers and accessibility review |
| Docker Compose + nonexpert lifecycle | No | Installer, HTTPS, persistence, updates, troubleshooting |

**Google Sites/Drive complement home hosting; they do not replace the backend.** Families may add a Google Site link to a private hosted app, or later connect an owner-selected Drive archive without moving their runtime to Google. See [Google option](GOOGLE.md).

**Home hosting is not automatically more private.** Unsafe port forwarding, missed patches, stolen disks and same-disk backups can expose or erase content. Avoid marketing the DIY path as easier or safer until independently tested.
