# LS-ACC-001 — optional accountant client-health portfolio

Status: **implemented locally; type/browser verification pending** on 2026-09-27. No migration, hosted database write, deployment, publication, commit, or accountant UAT occurred.

## Bounded implementation

`/clients` is a read-only portfolio over the active organization memberships already loaded by `useTenant`. It does not create a client entity, copy accounting records, or replace the organization switcher. The navigation entry appears when the user has more than one authorized organization; opening a row calls the existing `setOrganization` flow and then opens the existing dashboard.

Each organization is read independently through its existing `my_capabilities` result. The page requests only signals the member can already read:

- the current row in `accounting_periods` for `periods.read`;
- `reconcile_control_accounts` for `controls.reconcile`;
- the newest result from `search_transactions` for `transactions.read`.

An absent capability, failed read, unconfigured reconciliation provider, or absent reconciliation rows is displayed as **Unavailable**, never as zero or reconciled. A successfully read absence of a current period is a real **Needs attention** signal. Latest activity is informational and cannot by itself classify a client as healthy. The portfolio does not request or calculate monetary data, so it introduces no `bigint`-to-`Number` conversion.

Search covers organization/display name, legal name, currency, and role. Filters cover all, healthy, needs-attention, and unavailable states. Labels, failure/empty states, table semantics, logical spacing, and date presentation are supplied independently in English/LTR and Arabic/RTL.

## Isolation and switching

Portfolio results remain paired with the organization ID used for each request. A user-plus-membership scope key and monotonically increasing request version discard a response after identity or membership scope changes. The existing switcher was hardened with its own version guard: an older capability/role request cannot overwrite a newer rapid organization selection, and tenant-scoped Nuxt data is cleared before the selected organization is published.

Database authorization and RLS remain authoritative. Client capability checks only avoid irrelevant requests and do not grant access.

## Acceptance traceability

| Acceptance criterion | Local evidence | Remaining evidence |
|---|---|---|
| Existing organization access and switcher are reused | `/clients` consumes `useTenant().organizations` and calls `setOrganization`; no membership or tenant schema change | Native browser run with a multi-organization accountant |
| Every metric is a real module signal; missing signals are unavailable | Period, Control reconciliation, and latest transaction use the existing table/RPC contracts; focused unit assertions cover missing providers and no false zero/success | Native backend/browser responses across configured and unconfigured client modules |
| No cross-client cached data leaks during rapid switching | Portfolio scope/version guard and switcher version guard; focused delayed-response unit assertion | Native rapid multi-client browser exercise |
| Useful accessible EN/AR search/filter without accounting duplication | `BsDataTable`, labeled search/filter/retry/open actions, independent EN/AR copy, pure search/filter unit assertions; no monetary query or copied ledger | Nuxt typecheck/build and Playwright EN/AR/RTL run |

## Local verification

- BLOCKED — `pnpm agent:preflight` exited 1 because GitHub/fetch state could not be verified; local branch/worktree/ancestry fallback inspection completed, and integrated PR #52 provides the required V2-equivalent history.
- PASS — `node --test apps/ledger-suit/tests/unit/*.test.mjs` (21 files, including the focused client-health contract).
- PASS — both locale JSON files parse.
- PASS — canonical design-token check, workspace boundaries, protection of all 80 historical migrations, and `git diff --check`.
- BLOCKED — `pnpm install --frozen-lockfile --offline --ignore-scripts` failed before dependency linking because the configured store rejected project registration with `EROFS`.
- BLOCKED — the same install with an isolated writable `--store-dir` failed with `ERR_PNPM_NO_OFFLINE_TARBALL` for `@fontsource-variable/manrope@5.3.0`. The partial ignored install directory was removed.
- NOT RUN — Ledger lint, Nuxt typecheck/build, and Playwright because their workspace dependencies remain absent. No network/provider workaround or hosted test was used.

CORE-05 remains preserved: this is an accounting-only, tenant-authorized read view over the shared ledger and existing module contracts. For VAL-06, code and focused unit evidence are separate from native backend/browser execution, deployment, and accountant acceptance; none of the latter is claimed here.
