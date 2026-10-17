# How a family can start with Being There

**Current public availability:** a **self-hosted technical preview for a technical operator**, not a one-click family installer. The public application is separate from the original family's private setup. Never upload real family stories to a sample/test instance.

## What it is

One private collection of photographs, short videos, recordings and stories. Family members add content; someone using Tablet view can just enjoy it, listen or tell their version. Memories are shared — they do not need to feature or belong to the tablet user. There's no quiz or obligation to remember.

## Choose the right first step

**I just want to see it.** A technically comfortable person can run the temporary example at [the local preview instructions](../README.md#try-the-actual-interface-locally). No Google OAuth required; all sample records are deleted when the local process stops. **Do not put real family content here.**

**We want our own private version.** Today this requires someone comfortable with Linux, domain/HTTPS, Google OAuth configuration and backups. They can use the [advanced host guide](../packages/app/README.md). The family controls the host, access and archives. This has not yet passed a full real-family production pilot.

**We want to click a button and set it up ourselves.** The family-owned AWS launch is **planned, not yet released**. It should deploy in your AWS account, use your Google credentials and your own private backup bucket without giving Being There access. See the [AWS deployment plan](deployment/AWS.md) and [milestone requirements](DEPLOYMENT_ROADMAP.md).

**We already have a home server/NAS.** A simpler Docker Compose path is planned; see [home server plan](deployment/HOME_SERVER.md). A backup on the same box is not enough.

## What you'll need for a real installation

An account you own with your preferred host (initial AWS option or home server), a domain or safe access method, an identity provider (Google for the current version), someone authorized to issue the first private family invitation, and a second location for verified backups. AWS account and domain setup may incur fees; being open-source does not make hosting free.

## Three important privacy questions

**Can Being There see our content?** There is no required vendor-hosted central family service or default sharing with the project. But someone who administers your server/cloud account and its encryption keys may be able to access data. Self-hosting is not the same as end-to-end encryption.

**What if we stop using it?** Exact media originals and portable exports are part of the design; the deployment plan requires independent recovery tests and a way to move to another provider. Do not assume the proposed one-click backup and restore are already built.

**Does the app need someone's diagnosis or answers?** No. Simply enjoying memories is enough. This is not a medical device.

More details: [data, key and restore guide](deployment/DATA_AND_KEYS.md), [privacy guidance](../PRIVACY.md) and [frequently asked questions](../FAQ.md).
