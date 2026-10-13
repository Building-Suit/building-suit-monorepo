# Shop Penpot implementation tracker

Frozen source: 2026-10-13 02:16 UTC, Penpot file `fe2491ad-4519-810e-8008-962ecd861efe`; Library ZIP `libfile_9359e8a23ab88191b9b297257d196aec`, materialized and readable in this executor with identity/version metadata. Five PNGs and all 33 route board IDs are provided; the full state/theme/language/responsive matrix remains unfinished.

Initial verified staging: `266d91dc11cbc07b5e9f3b6d37dd53e541fb70e1`. Existing open root [PR #258](https://github.com/Building-Suit/building-suit-monorepo/pull/258): `fdd0e17973280d3ca8fd76985925a4e4619e0e52`. The earlier UI chain is preserved in that integration tip. No dirty parent files were copied.

| Task | State |
| --- | --- |
| Optional product/service image upload | [Draft PR #259](https://github.com/Building-Suit/building-suit-monorepo/pull/259), `0e25d129be2d79e049752ad7a000aba6da7bfc2b`; parent #258; focused checks and child review CI pass |
| Foundations/shell | [Draft PR #260](https://github.com/Building-Suit/building-suit-monorepo/pull/260), parent #259; desktop context-gap, flat 64px header and 184px scope alignment complete; canonical Manrope face mismatch corrected at `40ddbc093ebf01036a0f3204b2b9c0585fc600bd`; 3 token tests and loaded-face browser checks pass; two browser scenarios, build, lint and `pnpm check` pass |
| Approved dashboard | `codex/shop-suit/penpot-dashboard`, parent #260 (`40ddbc0`); [Draft PR #261](https://github.com/Building-Suit/building-suit-monorepo/pull/261), `71fd032448060198be6549d4539a0fb9ac6c907e`; metrics/filter/chart alignment complete; 2 browser scenarios, typecheck, lint, Shop/docs builds and `pnpm check` pass; approved Penpot board remains unchanged |
| POS | `codex/shop-suit/penpot-pos`, parent #261; shared cart, ≥44px quantity controls, compact image fallback and panel navigation implemented; focused verification complete before publication |
| Sales/receipts | Separate child after POS; sales, sale-detail and receipt main exports inspected read-only |
| Catalog/inventory | Pending route export inspection |
| Purchasing/customers | Pending route export inspection |
| Daily operations | Pending route export inspection |
| Admin/settings/billing | Pending route export inspection; preserve authorization and billing |
| Public/auth | Pending route export inspection and consolidated verification |

Upload scope: shared molecule/template and UX upload lifecycle; Shop file validation, tenant-scoped transport and signed projections; private immutable Storage objects; existing atomic authorized catalog saves. See `apps/shop-suit/docs/catalog-images.md` for the separate migration and cleanup gate.

Passing so far: 12 focused unit tests, mandatory `pnpm check`, focused package/scoped Shop lint, Shop typecheck and build. Two focused browser scenarios pass (EN/light/1440 and AR/dark/390), both covering product/service validation, failure/retry, preview, replacement, removal and save payloads. Screenshots inspected against the frozen uploader references; generic dialog titles and broader form spacing remain for the catalog fidelity task. SQL authorization fixtures are prepared but unrun because the local Supabase stacks are stopped and must not be restarted. No hosted migration, deployment, merge, provider/secret change or service restart.

Reference materialization: `/tmp/shop-penpot-handoff/Shop-Suit-Penpot-Handoff-2026-10-13.zip`, Library version 0; extracted PNGs were visually inspected for product/service upload. These executor paths are evidence only, not repository dependencies. The live shell board export was inspected and matches the frozen PNG; read-only exports are now responding. No canvas mutation.

Shell validation: EN/light/1440 and AR/dark/390; official SVG wordmark/mark selection and aspect ratio, 248/72px sidebar, 64px header, 184px selectors, collapse and mobile Escape/focus return, and no horizontal overflow. Source board `9d8c9265-2366-809c-8008-c7d70d192616`. Broader visual/state matrix remains pending.

Dashboard evidence: frozen PNG and live file/board geometry verified (`fe2491ad-4519-810e-8008-962ecd861efe`, locked board `9d8c9265-2366-809c-8008-c7d82686d944`, 1440×2870). Matched specimen data exists only in synthetic browser fixtures. Production monetary formatting and full financial notice are retained, so text wrapping differs from the illustrative design. AR/dark/mobile has behavior coverage but no complete native variant reference; no pixel-perfect claim.

POS evidence: frozen 1440×900 main inspected against browser output. Ten focused unit tests include SSR appointment customer locks, fractional inventory and service quantity behavior. Sixteen existing bilingual customer/checkout scenarios pass (12 desktop/checkout/error and 4 mobile cases); mobile fixtures use F2/F4 to navigate panels. Cart line-list scroll preserves payment/footer position above mobile navigation at EN/light/1440 and AR/dark/390. Native variants remain incomplete; under 700px viewport height the cart uses document flow to avoid clipping controls. Synthetic fixtures are not production data.
