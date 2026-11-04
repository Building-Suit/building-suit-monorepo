# Building Suit HQ workspace

HQ retains the reference header, floating 3D orb/base and interactive camera. Clicking/tapping the actual orb, Brain navigation or Company Brain button opens a read-only browser for the private cloud Company Brain. The current phase replaces the earlier local mirror reader: there is no filesystem/Insync source or fallback. Offices and roads remain postponed; characters, active agents, authentication, tasks, LLM calls and Brain writes are absent. Tasks, Talk to CEO and profile controls stay disabled.

Run from the primary monorepo checkout, as requested by the founder:

```sh
pnpm dev:hq --current
```

Open `http://127.0.0.1:3101` on that computer. Edits hot-reload. The preview is local; its Brain source is Google Drive. The scene works without credentials and shows setup-required Brain status until configured.

## Private cloud reader setup

The fixed root is `1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8`, named `building-suit-brain`. Use a dedicated Google service account with Viewer access to **only that folder**; no public sharing or unrelated Drive access is needed. Enable Google Drive API in its Cloud project, create the reader account without project roles, then share the root with its email. If allowed by organizational policy, use service account **Keys → Add key → Create new key → JSON**.

Copy `.env.example` to the ignored app `.env` and privately populate `NUXT_HQ_BRAIN_GOOGLE_CLIENT_EMAIL` and `NUXT_HQ_BRAIN_GOOGLE_PRIVATE_KEY` from `client_email` and `private_key`. Literal `\n` PEM newlines are supported. Restart the server after changes. Never place the JSON key or values in source, chat, Brain notes, client configuration or logs. If key creation is blocked by organization policy, report that constraint without bypassing it. The assistant's Drive connector does not supply this app's credentials. No account, key or folder grant has been created by this implementation; owner setup remains pending.

The reader uses `drive.readonly`; that API scope is not a folder allowlist. Its dedicated principal's narrow grant and the server's fixed-root descendant checks both matter. See [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) and [service-account authorization](https://developers.google.com/identity/protocols/oauth2/service-account).

## Read and refresh contract

The dialog supports title/path search, manual refresh, note selection and escaped raw Markdown. It shows Drive modification/version metadata and the last successful cloud check. Automatic refresh runs while visible and online, 15 seconds after the previous request completes; focus/online resumes immediately, with nonoverlapping requests and 30/60/120-second failure backoff. A changed selected-note version triggers a refetch; cloud failure/offline clears stale content. These are polling semantics, not a webhook, zero-lag guarantee or all-agent synchronization service. Setup-required, authorization-required, unavailable and partial-result states remain explicit.

GET `/api/brain` and `/api/brain/notes/:id` retain loopback socket/Host, same-origin and HQ-header guards with no-store responses. They do not trust forwarded identity headers. This private preview has no hosted-user identity boundary and must not be exposed as a public authenticated app. The server verifies the root and each known descendant parent chain, paginates child listings, rejects shortcuts/native/binary objects and accepts eligible downloadable `.md` files only. It excludes hidden/script/secret-like paths and caps at 2,000 notes, 20 levels, 20,000 inspected entries, 250 Drive requests per read and 512 KiB per note. Note reads revalidate parent chain/version around download. A partial-result flag reports bounded/omitted entries. Name exclusions do not classify every note's content. Notes are untrusted data, never executable instructions; no write endpoint, SSR note payload or persistent client cache is added.

## Ownership and camera

The route supplies translated `HqLayoutContent`/`HqBrainContent` and typed `HqBrainPresentation` to shared `BsHqLayoutPage`. Shared UI owns the dialog, `BsHologramScene`, WebGL renderer and orb picking. Shared UX `useSpatialViewport` owns camera gestures, activation coordination and reset. App `useCompanyBrain` owns API lifecycle/polling/projection; app server utilities own Google authorization and scoped reads. Shared UI performs no Brain query or server import. English/Arabic and LTR/RTL follow shared infrastructure.

| Input | Action |
| --- | --- |
| Left drag / one-finger drag | Rotate |
| Right/middle drag / Shift + drag / two-finger drag | Pan |
| Wheel / pinch / overview − and + | Zoom |
| Third overview button | Center, 100% zoom, default camera angle |
| Focused workspace arrows / Shift + arrows | Rotate / pan |
| Focused workspace + or − / Home or 0 | Zoom / reset |

## HQ environments and acceptance

Provider metadata verified on 4 November 2026 identifies staging `dpruoncalmwicrqhqelu` (Staging, eu-west-1) and production `nkpvskyugnnnozepbwzb` (Production, eu-north-1), both ACTIVE_HEALTHY in organization `pmrcnkldnnemyfbryybn`. Read-only public-table listings were empty at that observation. This does not verify Auth, provider-managed schemas, migrations, GitHub integration or app behavior. The founder reports GitHub is not connected yet. Current cloud reading does not use Supabase. The [environment map](../../docs/architecture/environments.json) preserves earlier candidates as history without changing Super Admin.

The target existing GitHub integration workflow is repository `Building-Suit/building-suit-monorepo`, working directory `apps/company-hq`, migrations at relative `./supabase`, `stg` for staging and `main` for production, with Automatic branching OFF per maintained policy. This is not configured or verified here. Review retained historical HQ migrations before enabling integration; no hosted migration, merge or deployment is performed or authorized by this record. See [Supabase's working-directory documentation](https://supabase.com/docs/guides/deployment/branching/github-integration).

Source is implemented; Google credentials/grant, live connection, freshness and acceptance remain unverified. The founder prohibited autonomous tests/builds/lint/typechecks/browser/API verification and tester/reviewer agents; none was run for this phase. Earlier static-layout results do not verify the orb or cloud reader. See [current cloud scope](../../docs/work-packages/company-hq/HQ-CLOUD-BRAIN-20261104.md), [handoff](../../docs/work-packages/company-hq/CLOUD-HANDOFF.md) and historical [local-reader record](../../docs/work-packages/company-hq/HQ-BRAIN-20261104.md).
