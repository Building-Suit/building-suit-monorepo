# HQ — cloud Brain connection, 4 November 2026

Status: source implemented; owner authorization setup and application acceptance unverified.

The founder authorizes START for the first cloud Brain-to-orb connection phase and explicitly rejects any local Brain connection. This narrowly lifts the prior clarification hold; it does not resume offices, HR-proposal board, staff/model execution or the broader hybrid operational database. The existing primary checkout and `codex/company-hq/office-design` / [PR528](https://github.com/Building-Suit/building-suit-monorepo/pull/528) remain the work location. No new worktree is used.

## Source change and access

The app-owned reader now uses Google Drive directly through a dedicated private read-only service account. It fixes the root to `1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8` / `building-suit-brain`, verifies known descendant parent chains, paginates folder-child reads and bounds metadata/download work. It rejects shortcuts/native/binary objects and excludes hidden/script/secret-like paths. Notes remain escaped untrusted Markdown data. Index/note GET routes keep no-store, opaque IDs, loopback socket/Host, same-origin and custom-header gates. Version and parent chain are rechecked around note download. All filesystem/Insync access and `NUXT_HQ_BRAIN_PATH` are removed, with no local fallback.

Server-only variables are `NUXT_HQ_BRAIN_GOOGLE_CLIENT_EMAIL` and `NUXT_HQ_BRAIN_GOOGLE_PRIVATE_KEY`. Credentials are not supplied; no service account, key or folder grant was created by this work. The owner is following the [private reader setup](../../../apps/company-hq/README.md#private-cloud-reader-setup): enable Drive API, create a dedicated reader with no project roles, share only the Brain root as Viewer, and privately supply authorized key material if organizational policy permits. Never put keys in source/chat/Brain/logs or extract assistant connector tokens. A policy block must be reported, not bypassed. The preview has no hosted-user identity, so the current loopback gate must remain.

## Refresh and ownership

The existing orb/Brain entry points open the shared note browser. App `useCompanyBrain` owns nonoverlapping polling while visible/online, 15 seconds after request completion; focus/online refreshes immediately and failures back off 30/60/120 seconds. Selected-note source-version changes refetch content; cloud failure/offline clears stale content. Drive modification/version and last-successful-cloud-check metadata distinguish setup, authorization, unavailable and partial-result states. This is not a webhook, DB push, guaranteed instantaneous freshness or an agent-context update service.

Shared UI owns `BsHqLayoutPage`, dialog and source/status presentation; UX retains spatial viewport behavior. App server utilities own Google auth/scoped reads. Header business controls remain disabled; no app Brain writes, active agents, tasks, authentication, LLM calls or persistence are added. Existing canonical roster/employee IDs and learning authority remain in the Brain. The broader approved hybrid direction and CEO HR-proposal visibility remain requirements awaiting their own implementation.

## Environment provenance

| Environment | Verified project ref | Provider name / region | Created UTC |
| --- | --- | --- | --- |
| Staging | dpruoncalmwicrqhqelu | Staging / eu-west-1 | 2026-11-04T13:31:18.708786Z |
| Production | nkpvskyugnnnozepbwzb | Production / eu-north-1 | 2026-11-04T14:13:40.678938Z |

Fresh `get_project` metadata after the user's reconnection showed both ACTIVE_HEALTHY in organization `pmrcnkldnnemyfbryybn`; no organization display name or plan was verified. Earlier permission denials are resolved history. Read-only `list_tables(public)` returned [] for both at the observation, without proving all provider-managed schemas/Auth settings or app behavior. No SQL or migration writes occurred. These refs supersede old HQ candidates `lwecnmsosfwovlzxauml` / `dfeiuxsqhgzontefmrjc` for HQ only; Super Admin's mapping is unchanged.

The founder reports these HQ projects are not GitHub-connected yet and describes the usual per-product staging/production workflow. Target HQ integration: `Building-Suit/building-suit-monorepo`, working directory `apps/company-hq`, migrations relative `./supabase`, `stg` for staging and `main` for production, Automatic branching OFF per maintained policy. [Supabase documents app working directories](https://supabase.com/docs/guides/deployment/branching/github-integration); repository documentation is not proof that provider configuration is active. Historical HQ migrations remain intact and must be reviewed before enabling integration. No hosted configuration, merge or production migration is authorized or performed by learning this routine. Current cloud reading uses no Supabase table/runtime.

## Evidence and limits

The implementation report is source evidence only. Owner credentials/root access, successful cloud reads, refresh behavior and application acceptance remain unverified. No tests, builds, lint, typechecks, boundary/release checks, browser/API/runtime verification or tester/reviewer agents were used, following the founder's explicit no-autonomous-testing instruction. Provider metadata inspection is separate from application validation. Earlier static-layout results cover only that earlier scope.

Live Brain learning saved this bounded decision/workflow in existing Infrastructure and Hosting, Development Workspace, HQ Brief, Working Agreement pointer and Conversation Learning, using immediate rereads and exact readback. Decision ID: `FOUNDER-2026-11-04-HQ-CLOUD-CONNECTION-NEW-ENVIRONMENTS`. No hosted mutation, public sharing, new spending, staff activation, merge or deployment is claimed. [Local-reader](HQ-BRAIN-20261104.md), [orb](HQ-ORB-20261104.md) and [static restart](STATIC-RESTART-20261104.md) records remain historical.
