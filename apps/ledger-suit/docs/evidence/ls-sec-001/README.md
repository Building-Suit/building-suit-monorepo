# LS-SEC-001 — release security and tenant-boundary evidence

Status: **locally reviewed; release verification blocked on native and hosted evidence**. Review date: 2026-09-27. Candidate before this uncommitted task delta: `4db6880b5fb178e74694170f53b5a8591a499205`. No hosted database write, provider change, deployment, push, merge, or commit was performed.

The candidate contains merge `07dd278d8f9acb477662155031a2bcea67412026` and integrated V2 tip `17c2c1306cc48d6a4a1ecbd21452e2bcb20243eb`. The reviewed V2-IMP-015 tip `2e3c26bfe051d243f404caf952f67f1af2b167a5` is not a literal ancestor, but both feature tips have stable patch ID `b294426478cfabed8b6c68aad50a01193b8daffc`. This satisfies the task's equivalent-integrated-history prerequisite.

## Delta conclusion

No critical source-level release security finding was identified in the reviewed boundaries. No runtime or migration was changed. The review retained the existing RLS, capability, posted-history, export, attachment, and Paymob evidence and added only missing negative assertions:

- `02_tenant_isolation_test.sql` now creates a real private attachment and requires a foreign tenant to see neither its metadata nor its `storage.objects` row. The latter is the RLS boundary used before Storage can create a signed download URL.
- `42_bank_reconciliation_test.sql` now requires a non-member to see no reconciliation rows and receive `TENANT_ACCESS_DENIED` from the workspace RPC.
- `release-security-boundaries.test.mjs` rejects server-secret identifiers in browser-reachable Ledger source, restricts public environment examples to the publishable Supabase contract, pins the five Edge Function JWT settings, and checks that JWT-exempt workers retain service-role authorization while the public webhook retains HMAC, signed-metadata, and payload-redaction boundaries.

These assertions supplement rather than replace the retained negative coverage: tenant reads/writes and viewer posting (`02`), attachment reservation/quota/worker privileges (`18`), viewer and foreign-tenant exports (`22`), posting idempotency (`32`), period races (`36`), AR/AP (`40`/`42`), assets (`43`), dimensions (`44`), VAT (`45`), Inventory source actor and tenant isolation (`46`), posted identity/history (`47`/`48`/`49`), and RLS-aware dashboard reads (`50`). Prior evidence is not relabelled as an LS-SEC-001 execution.

## Reviewed release boundaries

| Boundary | Source result |
|---|---|
| Financial exports | `export_financial_report_csv` requires `reports.export` and the `exports` entitlement; suite `22` contains viewer and foreign-tenant denials and CSV-injection checks. |
| Attachments | The bucket is private. Metadata requires `attachments.read`; object selection additionally derives the organization from the first key segment and requires membership plus `attachments.read`. Upload/delete use controlled reservations and service-only cleanup claims. |
| New V2 modules | AR/AP, assets, dimensions, VAT, and Inventory have role and foreign-tenant negative assertions. Inventory ingestion additionally binds the configured source actor. This delta closes the missing bank-workspace outsider assertion. |
| Browser configuration | Only Supabase URL, publishable key, and environment-specific cookie prefix are public. No service-role, Paymob, Resend, or Vault secret identifier exists under `app/`. No diagnostic-export feature exists in the browser app. |
| Paymob/auth | Checkout and invitations require platform JWT verification and authenticated user lookup. The public webhook verifies provider HMAC plus server-signed checkout identity before its service-role fulfillment call; stored callback payloads pass through credential redaction. Scheduled notification and storage cleanup endpoints compare the request bearer token with the server-only service-role value. |

## Commands actually run

| Command/check | Result |
|---|---|
| `pnpm agent:preflight` | Failed, exit 1; fetch/GitHub state was not verified. |
| Local ancestry and stable patch-ID comparison | Passed; the candidate contains the equivalent integrated V2-015 history. |
| `pnpm --filter @building-suit/ledger-suit test:unit` | Passed 17 files, zero failed/skipped, including the new release-security source/config regression. |
| Focused Deno tests for Paymob HMAC, checkout contract, and payment payload/confirmation | Passed 9 tests, zero failed. |
| `node apps/ledger-suit/scripts/verify-v2-acceptance-artifacts.mjs` | Passed 138 distinct requirement states and the exact independent worksheet; database/browser/deployment/accountant states remain unverified. |
| `pnpm check` | Passed token outputs, workspace boundaries, and preservation of 80 protected historical migrations. |
| `pnpm db:test:ledger` | Failed before reset or SQL execution: `supabase` executable not found. The new and retained pgTAP assertions did not run. |
| `pnpm --filter @building-suit/ledger-suit build` | Failed before compilation: `nuxt` executable not found because workspace dependencies are absent. No browser bundle was generated or inspected. |
| `pnpm audit --prod` | Could not reach the npm advisory endpoint (`EAI_AGAIN`); current dependency advisories remain unverified. |
| `git diff --check` | Passed after the focused delta. |

## Remaining release-specific checks

Only the following security checks remain; the wider V2 accounting/accountant matrix stays owned by LS-REL-001:

1. On an explicitly owned disposable Ledger backend, run native suites `02`, `18`, `22`, `32`, `36`, `40`, both `42` suites, and `43`–`50`, preserving TAP output and concurrent-session outcomes. The added attachment and bank assertions must pass without policy or assertion weakening.
2. Build the exact release artifact with pinned workspace dependencies and scan its generated client files and source maps for service-role, Paymob, Resend, Vault, and real environment secret values. Source-only scanning is not bundle evidence.
3. Run the package-manager production advisory audit against the live registry and disposition every critical/high advisory against the shipped client/server graph.
4. Read-only verify the hosted candidate SHA, Supabase project/ref, Edge Function JWT settings, private attachment bucket/policies, Vault secret **names only**, and negative two-user tenant/export/attachment/integration probes. Do not capture secret values or customer data.

Until those four checks produce evidence for the same candidate, the statements “no cross-tenant access succeeds in the release candidate,” “server secrets are absent from the shipped bundle,” and “no critical unresolved release finding remains” are not promoted to release acceptance.
