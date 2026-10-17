# G0 family experience walkthrough (offline prototype)

**This is a fictional, disposable design prototype, not an installable Being There application.**

Open `family-journey.html` in a browser on your own device. It requires no server or account and works offline. The three tabs simulate:
1. **Set up family:** an organizer begins a private family space, sees two people's example profiles and an invented invitation.
2. **Share a memory:** an invited contributor previews sharing a synthetic illustrated garden memory.
3. **Enjoy memories:** a person browses large illustrations, sees example story text, and can simply enjoy a moment without answering anything.

Try it on a phone and with keyboard navigation. The target is for nontechnical people to understand where to go without explanation.

## What is deliberately not implemented

- No real accounts, invitations, restricted sessions or access controls.
- No microphone access, file upload, playback of actual audio, or recording.
- No server, network request, persistence, backup, storage or export.
- No provider setup, costs or deployment decisions.
- No real family data; do not enter any.

The browser does not save or transmit state. The Content Security Policy denies network connections. A lightweight Node test checks those choices, but **this is not an independent browser accessibility or security audit**.

## Evaluation prompts

Ask three nontechnical participants to try the organizer, contributor and person experiences. Observe whether they know what to do without technical language, whether they mistake an example action for a real upload, whether 'just enjoy' feels like a full experience, and whether the 3 audience transitions are clear. Record confusion and accessibility issues using invented details only; never include private family stories in public issues.

## Acceptance to advance

The next G0 iteration should resolve any high-friction screen, capture the family permissions and consent contract, and agree on a first privately testable implementation slice. Do not merge or deploy the prototype as a real application.

See `docs/g0-beginner-walkthrough.md` and issue #6 (onboarding contract).
