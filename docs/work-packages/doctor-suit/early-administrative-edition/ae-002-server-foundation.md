# DOS-AE-002 — server and context foundation

Based on PR369 `800071c8c450e009955e066a1e8d90547d3d9e45`. This is the server/context part of the new administrative edition, not completed edition acceptance or a real-user release. UI reason selectors and capability presentation follow before candidate admission. Original plans and clinical review #366 remain unchanged.

## Implemented behavior

The CLI-created forward migration adds a singleton, versioned Doctor edition policy and append-only configuration events. Client and service API roles cannot read or mutate configuration tables. Forced RLS has an explicit database-owner policy; narrow private definer helpers have fixed empty search paths and explicit grants. The authenticated edition projection requires a current verified session and always reports synthetic data and unavailable live activation. There is no live mode, paid activation or public configuration command.

`synthetic_preview` preserves existing M1 behavior. `administrative_candidate` intersects current access with the administrative feature set, before owner/delegated access is considered. Document read/write is denied through both direct RPC and verified service-mediated upload paths. Static stored-grant constraints and historical grants are retained; the effective projection removes excluded capabilities without rewriting memberships. Missing policy fails closed. Existing unknown clinical capabilities remain denied.

Candidate appointment cancellation/rescheduling requires one of four fixed administrative codes. Its history projection keeps the allowed administrative snapshot/state fields and fixed codes, omits unknown/nested note payloads, and withholds historical free-text reasons. Stored history, event counts, actor/location/version attribution and historical source records remain intact. Raw table reads cannot bypass the projection. Audit projections retain their existing safe field allowlist.

Trusted contexts carry edition and policy revision. The app validates the pair and includes it in protected cache identity. A same-user edition transition clears private draft/projection state and rejects a previously in-flight read. Legacy synthetic fixtures without metadata remain compatible. These are context/cache mechanics, not authorization decisions; server checks remain authoritative.

## Verification

- 50 new SQL assertions plus all 679 inherited assertions pass: **729 total**, with all **39 inherited real transaction races** passing.
- 33 focused context/appointment units pass. Full repository units: **1,857 passed**, 23 explicit optional infrastructure skips.
- Doctor lint/typecheck and strict 105-template/80-historical-migration boundaries pass.
- Public schema types were regenerated from the migrated isolated database through the CLI-pinned PostgreSQL Meta service. Only the two new tables and the authenticated projection RPC extend the public schema contract.
- Pinned Supabase CLI 2.116.0 security advisors (`--level warn --fail-on error`) report **No issues found**. The root-lockfile-verified musl binary ran inside the owned PostgreSQL container against its own `127.0.0.1`; the container has no external networking. This is a local catalog advisory, not independent or hosted security acceptance.
- SQL/Auth/Storage interfaces in the fallback runner are scaffolding. Actual new-candidate provider/browser checks, UI bindings, independent assurance and hosted recovery/activation remain separate obligations. Exact-head CI and local advisor status are reported in the PR.

No hosted database, provider connection, credential, DNS/security setting, deployment, protected branch, commercial value or Shop history is changed. Candidate UI, real-user admission, subscription policy and all live approval gates must be completed before treating this as an available commercial edition. Synthetic behavior cannot establish privacy/legal, financial, security or recovery approval.
