# Being There — guiding tenets

> **More meaningful moments together. No pressure to remember.**

These principles guide product decisions, contributor proposals, code reviews, and releases. They are commitments and design requirements, **not** a claim that the unfinished Community Edition already satisfies every requirement. When priorities conflict, favor the person's dignity, privacy, and a reliable experience over engagement, growth, convenience, or architectural novelty.

## 1. Connection over cognition
Create meaningful moments, not memory tests. Never require recall, correct someone's account of a memory, award scores or streaks, or pressure participation. Simply enjoying a photo is enough.

## 2. Dignity and autonomy first
People may browse, listen, tell stories, repeat, or do nothing. The experience adapts to their needs and choices. Avoid infantilizing language, forced prompts, and unwanted interruptions.

## 3. Families create the meaning
Technology supports relationships rather than replacing them. Preserve different storytellers' perspectives, voices, context, and attribution. Do not overwrite someone else's account to produce a single supposedly authoritative story.

> **Security requirement update:** Family-held end-to-end encryption is the only acceptable final architecture, not a premium tier. All sensitive content including originals, derived previews, story text and tags must be encrypted client-side, with no operator/server recovery keys. The current backend is a technical preview and not compliant; see [the zero-access security promise](../../docs/SECURITY_PROMISE.md). Never weaken this to TLS-only, at-rest provider encryption, shared server keys or an optional "privacy mode".

## 4. Privacy is a promise, not a setting
Deny access by default. Sharing requires explicit family-controlled permission, enforced server-side for every private operation. No advertising, sale of personal information, or undisclosed use of private memories for AI training. Avoid collecting unnecessary data.

## 5. Memories should outlive the software
Preserve originals, attribution, and history. Treat derivatives as replaceable. Support verifiable backup, export, and restore so families can leave a provider or stop using Being There without losing their memories.

## 6. Simplicity is an accessibility requirement
Make the primary experience understandable without instructions. Favor legible controls, generous touch targets, accessible contrast, large responsive media, predictable navigation, and independent use when possible. Validate with real users before claiming accessibility is solved.

## 7. Technology should be invisible
Use transcription, tagging, recommendations, and AI only when they genuinely help. Keep them optional, understandable, and correctable. Never present inferred or generated content as a person's actual memory.

## 8. Family ownership without technical dependency
Make setup, operation, and recovery achievable by ordinary families. Keep provider choices replaceable, costs understandable, and family data independently controllable. Do not make a paid AI service or a central Being There account mandatory.

## 9. Build on what works
Prefer adapting proven, sanitized functionality to rewriting it. Keep changes small, maintainable, testable, and safe. Protect the existing private family deployment; never expose its code, secrets, history, or personal content through community work.

## 10. Build for people, not profit
Prioritize quality of life, openness, transparency, accessibility, and sustainable stewardship over commercialization, engagement metrics, or scale. Growth is not the definition of success.

## Applying the tenets

- **Feature proposals:** Explain whose experience improves and which tenets the change serves. If a proposal adds pressure, complexity, or unnecessary data collection, redesign it.
- **Architecture:** Preserve original media, verify integrity, enforce family isolation on the server, and make providers optional. A client-side family filter is not authorization.
- **AI:** Ask whether the feature is useful without AI and whether inferred details could be mistaken for a person's words. Provide a human correction path.
- **Agentic development:** Read these tenets alongside `AGENTS.md`, the technical blueprint, and the approved issue scope. Reuse existing work, test negative security cases, and stop at maintainer-only boundaries.
- **Release decisions:** Passing CI does not substitute for a privacy review, real accessibility testing, backup/restore proof, and a safe installation path. Never publish private family data or the private reference implementation.

**North-star measure:** Not how many memories we collect, but how many meaningful moments we help families share.
