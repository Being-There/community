# Frequently asked questions

### Can my family use Being There now?

The [Community Edition v0.1.0 technical-preview source](packages/app/) is public and can be self-hosted by someone comfortable with Linux, HTTPS, private storage and Google OAuth configuration. It is **not** a hosted public service, a verified beginner installer, or a family-ready release. Do not use an unreviewed deployment with sensitive real family archives.

### Can I try it without a Google account?

Automated unit, browser and recovery tests use invented identities and content. From `packages/app`, `npm run dev` starts the functional real-API local preview using **synthetic, disposable** credentials, bound to loopback only ([implementation PR #7](https://github.com/Being-There/community/pull/7)). The older fictional page remains available with `npm run demo`. A persistent hosted instance instead uses verified Google OAuth and invitations, not a fake login.

### Could we try a temporary hosted preview with real Google sign-in?

Yes, but not by exposing the synthetic local preview. The proposed invitation-only pilot uses a **separate Google OAuth client and HTTPS deployment**, distinct private storage for each trial, and explicit expiration/cleanup safeguards. See [the hosted preview issue](https://github.com/Being-There/community/issues/8). It is not online or verified yet. Do not share client secrets in GitHub or chat.

### How do developers contribute code?

Clone or fork [this public repository](https://github.com/Being-There/community), work under `packages/app/`, run `npm run check` and the browser/recovery tests, and open a small PR. No private family repo or production login credentials are required. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Do I need to share family memories to help?

No. Use only fictional test data. Do not post diagnoses, personal details, real family media or account credentials in public GitHub material.

### Do I need a GitHub account?

To comment, open GitHub issues or send PRs, yes. You can browse source and instructions publicly without an account.

### Is Being There a nonprofit? Can I donate?

We are exploring fiscal sponsorship or a nonprofit structure. We are not currently accepting donations or claiming tax-exempt status.

### Does this diagnose, treat, or measure dementia?

No. Being There is for sharing and enjoying memories together; it does not test or diagnose cognition.

### Who owns the data?

The software is designed for family-owned storage, private access, preserved originals and portable archives. Users of a self-hosted installation are responsible for securing and backing up their host. A disposable preview must disclose that trial content is temporary; pilot deletion and cross-tenant isolation still require independent validation.
