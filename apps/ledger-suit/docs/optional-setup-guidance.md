# LS-ONB-001 — optional setup guidance, chart starting points and synthetic demo

Status: implemented locally; browser/type verification pending dependency setup. No database migration, hosted write, deployment, commit or publication was performed.

## Scope and preserved behavior

- The Dashboard now exposes an optional, collapsed setup checklist. It reads organization details, active accounts and mappings, periods, accepted opening batches, members and invitations under the current user's existing capabilities. An unavailable read is reported as unavailable, not as incomplete.
- Every checklist action links to the existing Accounts, Periods, Opening Balances or Team workflow. It has no mutation action and does not reproduce organization creation, invitations, fiscal-year settings, CSV mapping, approval, posting, locking or correction.
- Accounts can display product-reviewed Services and Trading starting points. They are previews only: no account is created, renamed, classified or overwritten, and no mapping is inferred. The interface explicitly requires organization-specific accountant review.
- Opening Balances adds prerequisite guidance and links while preserving the existing explicit CSV mapping, normalized validation/preview, approval, locking and linked-reversal flow unchanged.
- Users without an organization may open a synthetic EGP example inside `OrganizationSetup`. It has the literal scope `isolated_synthetic_demo`, always has `organizationId: null`, uses exact string/BigInt minor units, and has no Supabase client. Receipt and reset operations fail closed outside that scope, so reset cannot target a real tenant.

This is a UI guidance delta for COA-01, COA-07 and OPEN-01–08. It does not change their accounting engine or promote deployment/accountant-acceptance states.

## Acceptance traceability

| Task acceptance | Local evidence | Remaining evidence |
|---|---|---|
| Existing organization/invitation and opening flows are reused unchanged | Existing write functions remain in `OrganizationSetup.vue` and `opening-balances.vue`; the new checklist/template/demo components expose no replacement write path | Native bilingual browser regression |
| Checklist links to existing actions and reports configuration state | `SetupChecklist.vue`; tenant-scoped reads and `buildSetupChecklist` unit cases, including unavailable permissions | Browser run against a disposable Ledger backend |
| Templates require review and never overwrite used accounts or invent mappings | `reviewedChartTemplates`; read-only `ChartTemplateReview.vue`; source contract test rejects Supabase/apply actions | Accountant suitability review remains independent |
| Demo is synthetic/isolated and reset cannot reach real organizations | `SyntheticDemo.vue`; `createSyntheticDemo`, `addSyntheticReceipt`, `resetSyntheticDemo`; real-tenant-shaped reset rejection | Browser interaction/responsive evidence |
| Setup is usable in EN/AR without a new accounting engine | Matching EN/AR keys, localized routes/guidance, unchanged existing accounting RPC paths | Nuxt typecheck/build and EN/AR browser run |

## Checks actually run

| Command | Result |
|---|---|
| `pnpm agent:preflight` | Failed before GitHub/fetch verification; live remote state unavailable. Local ancestry then proved merged PR `07dd278` is an ancestor and its Ledger tree is equivalent to required reviewed tip `2e3c26b` through integrated commit `17c2c13`. |
| Locale JSON parse for `en.json` and `ar.json` | Passed. |
| `node --test apps/ledger-suit/tests/unit/setup-experience.test.mjs` | Passed. |
| `node --test apps/ledger-suit/tests/unit/*.test.mjs` | Passed all 19 test files, zero failed/skipped. |
| `pnpm check` | Passed design-token comparison, workspace boundaries and preservation of 80 historical migrations after replacing preview tables with `BsDataTable`. |
| `node apps/ledger-suit/scripts/verify-v2-acceptance-artifacts.mjs` | Passed: 138 distinct requirement states and the independent eight-journal worksheet still reconcile; runtime/accountant states remain unchanged. |
| `git diff --check` | Passed before documentation updates; rerun at handoff. |
| Ledger `lint` | Did not start: `eslint` executable absent because this worktree has no `node_modules`. |
| Ledger `typecheck` | Did not start: `nuxt` executable absent because this worktree has no `node_modules`. |

No SQL or database test is required by this guidance-only delta, and none was run. Browser tests/build remain unrun because the pinned dependencies are not installed. No previous runtime evidence is relabelled as this task's evidence.
