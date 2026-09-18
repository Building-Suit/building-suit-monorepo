# Local verification checkpoint — 2026-09-19

## Passing checks

| Check | Result |
|---|---|
| Frozen offline dependency install | Passed with one workspace lockfile |
| Production builds | Ledger, Shop and documentation apps passed |
| Typecheck | All three apps and imported shared code passed |
| Lint | All apps, shared packages and tooling passed |
| Workspace/token checks | Boundaries pass; canonical outputs match; all 80 historical migrations unchanged |
| Infrastructure invariant tests | 5 passed: token references/cycles, radius values, export escaping, redirects and cache scope |
| Ledger pgTAP, pristine local seed | 678 assertions across 27 files passed |
| Current Shop transactional SQL | 5 suites passed, fixtures rolled back |
| Ledger selected browser journeys | 13 passed: core shell/account/role flows, landing-to-signup, OTP signup, recovery and account switching |
| Shared browser checks | 4 passed across all three apps: layouts, Arabic/RTL, dark mode, mobile, docs, table search/selection model updates, wizard, confirmations and dirty-modal focus behavior |
| Shop browser backend journey | 1 passed: signup, real local email OTP, shop provisioning, product modal save and persistence after reload |
| Platform generator | Generated temporary app passed prepare, typecheck and production build; temporary app removed |
| Original source preservation | All 502 tracked source hashes match; all three source Git trees remain clean at their original commits |
| Agent guidance | Reviewed against current paths/scripts and future-development scope; see `agent-guidance-review.md` |

The final browser runs used production artifacts and the disposable backend at `127.0.0.1:59321`. `BUILDING_TEST_BACKEND=1 pnpm test:e2e` includes the real Shop mutation journey; ordinary CI omits that journey when no initialized backend is available. Visual captures were reviewed locally for the shared catalogue, product marketing and Shop product page.

A fresh install exposed an undeclared `h3` import in the pinned Supabase Nuxt module resolving to an incompatible development-tool dependency. `pnpm-workspace.yaml` adds the module's dependency on the same h3 1.15.11 API used by the pinned Nuxt/Nitro runtime. Browser checks were rerun successfully afterward. The shared table now reads forwarded attributes during each render so native model updates stay current; its selection regression check passes. Turbo inputs exclude generated/dependency/output directories and include shared source/configuration changes. Upstream ESLint peer-range warnings remain; the actual configured lint checks pass.

The Ledger SQL fixtures assume an unmodified seed. A repeat after browser writes failed quota/count assumptions; a reset of only this disposable database restored the expected fixture state, and the full 678-assertion run passed before final browser writes. SQL runners do not silently reset databases. See `local-rehearsal.md` for the Shop snapshot and excluded historical test limitations.

## Not verified or applied

- Hosted Ledger production/STG refs, live schema/history, backup/restore and release access.
- Private `ledger_suit` / `shop_suit` plus API schemas and converted callers.
- Transfer of Shop customer data/Auth identities, Storage, Realtime, functions/jobs and production cutover.
- Cross-origin shared login, identity conflicts, deployed callbacks, logout/revocation and unified onboarding.
- Full hosted Shop recovery equivalence; the local snapshot has documented historical grant/test limitations.
- Unrelated source-product roadmap features and external payment/email-provider operations.

No hosted database changes or application deployments occurred. Passing these local checks is not a completion claim for the blocked work packages or a guarantee that every source-product feature is finished.
