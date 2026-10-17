# Contribute to Being There

Being There Community Edition **v0.1.0 technical-preview source is public** in [`packages/app/`](packages/app/). You can clone, build, run synthetic integration tests and contribute code without access to Dad's private app, any family data or Google credentials. The self-hosted app is **not** a hosted public service or a verified beginner installer.

## Get started with the real app code

Requires Git, Linux/macOS or equivalent development environment, **Node.js 22.13+ or 24**, npm, and (for browser tests) Chromium/Playwright.

```sh
git clone https://github.com/Being-There/community.git
cd community/packages/app
npm ci --ignore-scripts
npm run check
node scripts/recovery-drill.mjs
npx playwright install --with-deps chromium --only-shell
npm run test:browser
```

These tests run against **synthetic identities and temporary local storage**; no Google account or cloud server is needed. The browser suite uses an emulated microphone, not real family audio. To try the actual API/UI locally with a disposable synthetic owner and temporary data, see [PR #7](https://github.com/Being-There/community/pull/7) until it merges; that branch changes `npm run dev` to run the functional HTTPS loopback preview. On published `main` before #7 merges, `npm run dev` still starts the fictional page—**it is not the real app**.

For the real persistent app, `npm run family:start` requires a separate HTTPS host and your **own** Google OAuth web client. See the [operator guide](packages/app/README.md). Never send your client secret, real media or invitation tokens to GitHub Issues/PRs.

## How to send code

1. Pick an existing [issue](https://github.com/Being-There/community/issues) (or open one for an observed defect), then **fork** this public repository.
2. Create a small branch for one functionality or bug. Start with a failing regression test where practical, reuse the existing server/model modules, and keep files containing real personal data out of Git.
3. Run `npm run check`, the recovery drill when touching media/storage, and browser acceptance for user-facing changes. Document which checks you actually ran and any failures.
4. Open a pull request to `main` explaining the behavior, the reused implementation, the tests, and security/retention implications. The maintainer reviews it; green CI is required but is not proof of privacy or usability.

Fork PR checks must run without secrets or privileged/self-hosted runners. **Do not** propose a synthetic auth bypass in the persistent/hosted app. The local synthetic preview must remain loopback-only. For a hosted invitation-only Google pilot and isolated expiring trial data, follow [#8](https://github.com/Being-There/community/issues/8); that is a different environment and requires security review.

## Useful contributions

The immediate focus is complete authenticated photo/story/media workflows, safe retries, accessible browsing, independent recovery, simple host setup, privacy-negative tests and accurate setup instructions. The more polished [family journey sample](packages/app/prototypes/family-journey.html) is an **offline design reference**, not proof that invitations, recording or storage work. Avoid adding more demonstration screens or invented controls.

You can also review accessibility, help test fictional scenarios, improve documentation, or suggest community/nonprofit work. Please follow [our privacy guidance](PRIVACY.md) and [tenets](packages/app/TENETS.md). **GitHub activity is public and indexed:** do not share diagnoses, accounts, email addresses, personal memories, photographs, voices, secrets, private links, or exploit details in public issues. Use private vulnerability reporting if enabled.
