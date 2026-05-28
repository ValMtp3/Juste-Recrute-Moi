# Privacy Policy

**Effective date:** 2026-05-29
**Applies to:** the JustHireMe desktop application ("the Software") and the JustHireMe website/download pages ("the Site").

> **Note for the maintainer:** Complete the `[BRACKETED]` items (legal entity, contact email, hosting regions) before publishing. This template reflects how JustHireMe actually handles data today; verify it against your deployment and have it reviewed by a lawyer.

---

## 1. Our privacy model in one sentence

JustHireMe is **local-first**: the Software keeps your personal and job-search data on **your own device**, and the Site collects only minimal, mostly anonymized information needed to run download counters and a feedback channel.

## 2. Data the Software stores (on your device, not with us)

When you use the desktop Software, the following are stored **locally** on your machine and are **not transmitted to the maintainer**:

| Data | Where it lives |
| --- | --- |
| Your profile / identity graph (resume, skills, projects, experience) | Local files + local Kùzu graph |
| Job leads and CRM history | Local SQLite database |
| Vector embeddings for matching | Local LanceDB store + local ONNX model |
| Generated resumes, cover letters, outreach drafts | Local files |
| Settings, including any API keys you enter | Local application settings |
| Activity / logs | Local |

We do not have a server that receives, stores, or has access to this data. Deleting the app and its local data removes it.

## 3. Data sent to third parties **because you chose to**

The Software only sends data off your device when a feature you use requires it:

- **AI/LLM providers (your keys).** If you configure a provider (OpenAI, Anthropic, Azure OpenAI, a custom endpoint, or a local Ollama instance), the relevant job text and profile context are sent to **that provider** to produce scores or documents. This is governed by **that provider's** privacy policy and your account with them. With a local provider (Ollama), this data stays on your machine.
- **Job sources and APIs.** When you scan sources, the Software contacts the public job boards, feeds, or APIs you configured to retrieve postings.
- **Runtime pack + updates.** On first run and during updates, the Software downloads runtime components and release metadata over HTTPS from the official release host (GitHub). These are standard file/version requests.

We (the maintainer) do not receive copies of any of the above.

## 4. Data the Site processes

The Site (marketing/download pages) processes a small amount of data to operate:

- **Anonymous visit and download counts.** The Site increments view/download counters. A per-visitor identifier is **salted and hashed (HMAC)** before storage and is used only to de-duplicate counts (so the same visitor is not counted repeatedly). We do not use it to identify you, and we do not store raw IP addresses for analytics purposes.
- **Public GitHub data.** The Site may read public repository data (such as star counts) from GitHub's API.
- **Feedback you submit.** If you use the feedback form, your message is forwarded to create a GitHub issue in the project repository. An automated step attempts to **redact obvious personal data and secrets** from the public issue, but you should not submit sensitive personal information, credentials, or other people's data. Anything you submit may become publicly visible in the issue tracker.

The Site does **not** use advertising trackers, does **not** sell data, and does **not** require an account.

## 5. Cookies and local storage

The Site uses minimal browser storage only where needed for functionality (for example, a local cache of public counts and your theme preference). It does not use third-party advertising or cross-site tracking cookies.

## 6. Legal bases for processing (GDPR/UK GDPR)

Where GDPR/UK GDPR applies, our limited processing relies on:

- **Legitimate interests** — operating download/visit counters and understanding aggregate, anonymized usage; running a public feedback channel.
- **Consent** — when you voluntarily submit feedback or enter information into a form.
- **Contract / your request** — performing an action you asked for (for example, fetching a download or release metadata).

You can object to legitimate-interest processing; because Site analytics are anonymized aggregates, opting out is generally a matter of not using the Site.

## 7. Sub-processors / service providers

The Site relies on a small set of providers to function. Depending on deployment these may include: a static/edge host (for example, Vercel), a key-value/counter store (for example, Upstash Redis), and GitHub (release hosting and the feedback issue tracker). These providers process data on our behalf under their own terms. `[Confirm the exact providers and regions for your deployment.]`

## 8. International transfers

Service providers above may process data in regions including `[REGIONS — e.g., EU, US]`. Where required, transfers rely on appropriate safeguards (such as Standard Contractual Clauses) offered by those providers.

## 9. Data retention

- **Local Software data:** retained on your device until you delete it; we have no copy.
- **Site counters:** stored as aggregate counts and salted-hashed de-dup keys; retained for as long as the counters operate.
- **Feedback:** retained in the public GitHub issue tracker until removed; request removal via the contact below.

## 10. Your rights

Depending on your location (GDPR/UK GDPR, CCPA/CPRA, and similar laws), you may have rights to access, correct, delete, port, or restrict processing of your personal data, and to object or withdraw consent. Because we hold almost no personal data about you:

- For **Software data**, you exercise these rights directly on your device (edit/delete locally).
- For **feedback or Site data** that may identify you, contact us using Section 13 and we will respond as required by applicable law (for example, within one month under GDPR/UK GDPR).

## 11. Security

We aim to follow reasonable security practices: HTTPS for downloads and Site traffic, hashing of visitor identifiers, and redaction on the public feedback path. No method of transmission or storage is 100% secure. Protect your own device, local data, and API keys. Report vulnerabilities per `SECURITY.md`.

## 12. Children's privacy

JustHireMe is not directed to children under 16 and we do not knowingly collect their personal data. If you believe a child provided personal data through the feedback channel, contact us for removal.

## 13. Contact

Privacy questions or data-subject requests (access, correction, deletion): email `[PRIVACY CONTACT EMAIL]`, open an issue at https://github.com/vasu-devs/JustHireMe, or follow `SECURITY.md` for sensitive reports. For local Software data, the fastest path is to manage or delete it directly in the app on your device.

## 14. Changes

We may update this Policy; the "Effective date" will change and material updates will be noted in release notes or the changelog.
