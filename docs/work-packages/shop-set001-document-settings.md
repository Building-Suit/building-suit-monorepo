# Shop SET-001 document presentation

Status: implemented; native database validation pending in disposable GitHub CI.

Shop child of #308, branch `codex/shop-suit/set001-document-settings`, committed parent `58bb6704bafe0de4543a576b98bdb9a7800d708e`. Merge order is #308 before this child. No merge or hosted deployment is included.

The forward migration extends existing receipt settings with a document title, document-number label, default language (Arabic/English), direction (follow language/LTR/RTL), description visibility, optional notes and an embedded PNG/JPEG logo (128 KiB maximum). Shared presentation remains in `packages/ui`; bounded raster-file reading is in `packages/ux`; authorized settings orchestration remains in Shop. Existing `save_receipt_settings` callers stay compatible and preserve the additional fields.

At invoice issuance, the existing immutable snapshot captures all these settings plus product/service descriptions. Later settlement reads the issued snapshot. Old snapshots without presentation metadata retain their legacy locale, title, SKU description and footer behavior. Embedded logo bytes avoid a mutable remote URL. Preview, print and share use the captured label/notes/description policy; share defaults to captured language and follows an explicit preview-language choice. Switching display language keeps an explicitly captured direction. Tax/compliance copy stays unchanged and no tax/ETA controls or claims are added.

Validation:

- 316 Shop/raster unit tests passed; frozen dependency install changed no lockfile.
- All six workspace typechecks passed after regenerating the documentation catalogue.
- Shop lint passed with two existing attribute-order warnings outside changed files.
- Shop production build and strict workspace ownership/boundary checks passed.
- 19 synthetic SSR browser cases passed: two settings editors (EN desktop/AR mobile) including embedded-logo upload; captured label/locale/direction/logo/notes with descriptions hidden/shown; existing currency-precision, legacy receipt, thermal/A4, print isolation and unavailable-state matrix.
- Added native rollback tests for authorized persistence, invalid language, remote/invalid logo rejection, issued/settled snapshot preservation and outsider denial, plus existing profile/receipt regressions. These run through `tooling/database/test-shop-settings-local.mjs` in the existing disposable account workflow.

Exact local SQL blocker: the selected environment's Docker daemon uses `vfs`; pulling Supabase Postgres fails at layer registration with `no space left on device`. The task-owned CLI retry was stopped. No Docker pruning, cleanup, hosted SQL, production/main change, billing/offline change, UI PRO redesign, Arch, n8n, Penpot or personal-network access occurred. This is an infrastructure failure, not an automatic approval denial. CI native execution and schema-generation artifacts remain pending.
