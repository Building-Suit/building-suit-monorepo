# Shop Penpot implementation tracker

Frozen source: 2026-10-13 02:16 UTC, Penpot file `fe2491ad-4519-810e-8008-962ecd861efe`; Library ZIP `libfile_9359e8a23ab88191b9b297257d196aec`, materialized and readable in this executor with identity/version metadata. Five PNGs and all 33 route board IDs are provided; the full state/theme/language/responsive matrix remains unfinished.

Initial verified staging: `266d91dc11cbc07b5e9f3b6d37dd53e541fb70e1`. Existing open root [PR #258](https://github.com/Building-Suit/building-suit-monorepo/pull/258): `fdd0e17973280d3ca8fd76985925a4e4619e0e52`. The earlier UI chain is preserved in that integration tip. No dirty parent files were copied.

| Task | State |
| --- | --- |
| Optional product/service image upload | `codex/shop-suit/catalog-image-upload`, parent #258; implementation complete, final checks before draft publication |
| Foundations/shell | Pending pixel comparison, then child draft PR |
| Approved dashboard | Pending pixel comparison; approved board remains locked |
| POS/sales/receipts | Pending fixed cart, compact catalog and touch-control comparison |
| Catalog/inventory | Pending route export inspection |
| Purchasing/customers | Pending route export inspection |
| Daily operations | Pending route export inspection |
| Admin/settings/billing | Pending route export inspection; preserve authorization and billing |
| Public/auth | Pending route export inspection and consolidated verification |

Upload scope: shared molecule/template and UX upload lifecycle; Shop file validation, tenant-scoped transport and signed projections; private immutable Storage objects; existing atomic authorized catalog saves. See `apps/shop-suit/docs/catalog-images.md` for the separate migration and cleanup gate.

Passing so far: 12 focused unit tests, mandatory `pnpm check`, focused package/scoped Shop lint, Shop typecheck and build. Two focused browser scenarios pass (EN/light/1440 and AR/dark/390), both covering product/service validation, failure/retry, preview, replacement, removal and save payloads. Screenshots inspected against the frozen uploader references; generic dialog titles and broader form spacing remain for the catalog fidelity task. SQL authorization fixtures are prepared but unrun because the local Supabase stacks are stopped and must not be restarted. No hosted migration, deployment, merge, provider/secret change or service restart.

Reference materialization: `/tmp/shop-penpot-handoff/Shop-Suit-Penpot-Handoff-2026-10-13.zip`, Library version 0; extracted PNGs were visually inspected for product/service upload. These executor paths are evidence only, not repository dependencies. A read-only live Penpot inspection did not return and was stopped; no canvas mutation.
