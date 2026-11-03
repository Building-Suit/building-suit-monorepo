# Current live-operation blockers

The founder requested the usable website, real CEO conversations and task handling on 3 November 2026, and selected these immutable Supabase refs:

| Environment | Selected ref | Verification |
|---|---|---|
| Staging | `lwecnmsosfwovlzxauml` | Current connection denies project/table access. Monorepo environment evidence records this ref as Super Admin staging; ownership/use must be resolved before HQ mutation. |
| Production | `dfeiuxsqhgzontefmrjc` | Current connection denies project/table access; current identity, plan, scope and schema unknown. |

The adapter and forward migration are prepared and tested in disposable PostgreSQL, not applied to either hosted project. No existing product tables, Auth users, keys or policies are read/copied/reset. The migration adds HQ-prefixed objects only and grants access only to server service identities. Hosted configuration fails closed until exact ref, scope and cost gates are verified; environment credentials remain independent.

Staging setup, when access exists: read actual project/organization/schema/advisor state and resolve the existing Super Admin mapping; verify Free capacity and intended project isolation; review and apply the HQ migration once; check tables, grants and API adapters; configure founder password hash, exact app origin and separate CEO/HR bridge hashes via protected provider secrets. Never paste secret keys into chat or logs. Run authenticated browser/API/DB checks on synthetic staging data before production. Apply the reviewed migration to the verified production ref, configure its independent secrets and deploy the tested build only after the $0 hosting/model path is actually established.

The standalone cloud source is `/workspace/company-hq`, branch `codex/office-design`. GitHub repository creation for `Building-Suit/company-hq` was rejected by the available integration (`createRepository` permission missing). An empty private repository and write access are required to push/open the standalone PR. The old monorepo branch has the extraction commit `b893a4203d3907f48c56467b6f55df1c7bf8c7c6` and no longer contains the HQ app/assets/shared additions; staging/main were not changed.

The website exposes `/api/mcp` and role-scoped REST bridge endpoints for an authorized assistant. MCP lets CEO read founder messages, reply, propose tasks for founder approval, delegate approved work to HR and record real progress. HR gets only its report/progress tools and authorized records. This is a usable integration surface, not an AI model or automatic reply engine. Website-only simulations are never marked real work.

A synthetic cloud Codex CLI test was attempted using the existing ChatGPT login. The CLI's status reported signed in, but the actual request failed 401 and refresh failed with a stale-login error; no model response was obtained. No company data was submitted in the probe, no paid API fallback activated and no worker is running. Refresh the authorized cloud login and verify allowance/tool scope before connecting real company messages. A model plan cannot approve itself or mark its own output independently reviewed.

The accessible Vercel connection exposes the Building Suit team, but does not establish a verified $0 HQ deployment target or a running company-HQ project. No deployment/provisioning/billing was performed. A source build, synthetic bridge reply or current workspace port must never be presented as a live production CEO website.
