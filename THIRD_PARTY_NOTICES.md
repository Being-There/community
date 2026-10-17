# Third-party software notices — Community Edition v0.1.0

The Being There application source is released under [Apache License 2.0](LICENSE). Its Node.js dependencies are separate third-party works, governed by their own licenses. No `node_modules` content is committed in this repository.

Dependencies declared in `packages/app/package.json`:

| Package | Version | License |
| --- | --- | --- |
| `google-auth-library` | 11.3.1 | Apache-2.0 |
| `sharp` | 0.35.5 | Apache-2.0 |
| `playwright` (developer test dependency) | 1.62.1 | Apache-2.0 |

The committed npm lockfile contains transitive packages under MIT, Apache-2.0, BSD-3-Clause, ISC, 0BSD, and LGPL-3.0-or-later (including multi-license combinations). In particular, `@img/sharp-libvips-*` platform packages use LGPL-3.0-or-later, and some optional `@img/sharp-*` binaries have LGPL terms alongside other licenses. They are not relicensed by the application's Apache-2.0 license.

For the exact dependency set, see `packages/app/package-lock.json` and the license metadata and license files distributed with each installed dependency. Operators redistributing dependency binaries, containers or assembled installations must preserve the applicable notices, license text and any source-code/relinking obligations required by those third-party licenses.

This is a source technical preview, not a bundled third-party binary distribution.
