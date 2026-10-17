# Being There contributor instructions

Read [TENETS.md](TENETS.md) and [README.md](README.md). This is a pre-release advanced-host reference, not a verified beginner installer or family-ready release.

Use synthetic fixtures only. Do not fetch private reference code, media, credentials or logs. Adapt existing reviewed modules; scope work to a missing integration delta. Separate account, membership, person profile and contributor attribution. Profiles/display modes never grant access. Deny private reads/writes by default and check family/resource authority on the server, including original/derivative HEAD/Range requests and jobs.

Preserve exact originals, attribution and separate storyteller versions. Do not overwrite voices or remove pending audio before durable server and independent archive acknowledgment. The original archive must remain readable without the database. Unknown export fields must fail rather than silently losing content. Restore into a new family with identity grants disabled.

Run `npm run check`, `node scripts/recovery-drill.mjs` and relevant HTTPS browser acceptance. Report actual results and missing verification. Test cross-family/revoked accounts, invitation replay, concurrent writes and interrupted upload recovery. There is no production test-login fallback. Provider keys/certificates used by fixtures belong exclusively to tests.

Auth, retention, archives, restore, deployment and CI changes require security-oriented review. Use small reviewed PRs. Do not autonomously merge, deploy, publish or change repository visibility. Passing synthetic tests does not replace provider, independent security, accessibility or nontechnical-family acceptance. No mandatory AI, telemetry, memory tests, scores or forced answers.
