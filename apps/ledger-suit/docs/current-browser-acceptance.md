# Current Ledger browser acceptance

LS-BROWSER-001 updates the remaining foundation/core fixtures and verifies the current atomic screen matrix. Use the pinned workspace Node/pnpm and a production build. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is optional; omit it to use Playwright's installed browser. The 2026-10-26 managed run explicitly uses system Chromium 154 at `/usr/bin/chromium`; no executable or browser version is impersonated.

```sh
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1
pnpm --filter @building-suit/ledger-suit exec playwright test -c playwright.acceptance.config.ts --workers=2
LEDGER_BROWSER_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/native-browser-runtime.mjs prepare
LEDGER_BROWSER_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/native-browser-runtime.mjs start
LEDGER_BROWSER_DISPOSABLE_TEST=1 pnpm --filter @building-suit/ledger-suit exec playwright test -c playwright.native-core.config.ts
LEDGER_BROWSER_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/native-browser-runtime.mjs stop
```

The foundation and atomic scenarios intercept synthetic API responses; they assert UI commands, exact payloads, permissions, contexts and English/Arabic, theme and viewport behavior. The native core scenarios use the separate guarded backend on API/DB/UI ports 61021/61022/61030 and real seeded password login, account creation and navigation. Their existing custom-role-limit scenario intercepts only that RPC error. The exact seed has four preconfirmed identities and two empty organizations; this does not test signup confirmation or a full financial working cycle. Native signup/billing and integrated accounting-cycle evidence remain separate packages.

The native runtime requires its fixed task/project marker, local Docker endpoint, exact workdir/ports/migrations/seed and newly owned volume timestamps. Preparation/start/stop offer no reset or deletion path. It creates private local signing keys valid for one week, keeps service credentials out of frontend configuration, sends no external mail and preserves all fixtures. Logs/keys remain ignored and owner-readable only. Stop preserves the database volume and is not an offsite backup.

Actual interface repairs are [recorded in the work package](accountant-system/work-packages/LS-BROWSER-001.md): administrative nested-value sorting and mobile navigation focus while CSS visibility is transitioning. A fixed frame delay was insufficient in the real browser; focus now checks visibility and cancels after close/disposal. No accounting function, migration or authorization contract changes.

Run heavy compilation and full browser phases separately on constrained hosts. The managed worker has two CPUs. An earlier overlapping run produced timeout/auth-transition failures and was interrupted; it does not supply complete acceptance evidence. Interrupted Nuxt builds can leave both output and nested `nuxt.lock` metadata. Inspect the exact recorded PID, state and workdir before removing an owned stale lock; never bypass a live build or ignore lock checks. Likewise stop only a verified owned orphan preview when its port is occupied. Successful task runs keep normal exclusive preview startup.

The shared receipt unit browser test also accepts the optional executable override. Its system Chromium 154 comparison on this host differs from the reviewed receipt PNG baseline (about 2.7–2.9%). Neither renderer, font/token source nor baseline was changed, and the visual threshold remains intact. Parent GitHub CI passes both receipt tests with exact baseline error zero. This local result is recorded separately from Ledger acceptance; it is not relabelled as passing.

Broader legacy seeded-browser files are not implied to pass by the current 17-file atomic selection. Full repository CI, hosted identity/configuration, actual operating backups, live Automation reconciliation and named accountant acceptance remain explicit gates. Staging integration is separately authorized and requires its exact combined candidate checks.
