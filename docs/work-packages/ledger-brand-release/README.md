# Ledger family logo and consolidated release — 2026-10-29

The owner requested Ledger family artwork, one consolidated Ledger staging candidate, staging verification before main, and marketing only after release readiness.

## Artwork and references

Adopt the already generated Ledger open-ledger/L artwork from shared PR #437, SHA `613177246eb05eda4e7458fd5d5d212062e03f5e`. The white L/book, gold ruled rows and charcoal/gold rounded tile match the accepted Shop and Doctor concept. Outlined SVG wordmarks require no external fonts. Seven stable Ledger paths in `packages/brand/assets/ledger-suit-*` now use that artwork, including the 512px PNG fallback. `asset-verification.json` retains exact source hashes.

Actual comparison references: `packages/brand/assets/shop-suit-wordmark-{light,dark}.svg` and `packages/brand/assets/doctor-suit-wordmark-{light,dark}.svg` from Doctor leaf `8bef8ebd24cb07da3ba4ef09e1ff6c5ad6cafd21`. These references were rendered in Chromium and visually inspected; neither accepted logo is regenerated or changed. See `family-preview.png`, `login-light-mobile.png`, and `login-dark-mobile.png`.

## PR inventory and integration

- #439, `codex/ledger-suit/accountant-readiness`, is the sole Ledger root into `stg`, inspected at `079a274bfc69700c1502913ec45a8a303fdd40c2`. Its 21 source task PRs through #511 are already consolidated with history preserved. Its existing required branch-policy/review/verify checks passed before this logo update.
- #512, `codex/ledger-suit/brand-release`, starts at that exact committed parent and contains only the logo, provenance and this evidence. Incorporate it with a merge commit into #439 and run full combined CI; old green checks do not validate the updated root.
- #437 remains a separate shared root with Shop crop and Ledger artwork; only its seven Ledger assets are adopted. #440 includes multi-product access migrations and operations and is not merged wholesale into Ledger. Existing accepted shared provenance and histories are preserved.
- #408 is the current `stg` → `main` PR. Current staging has other previously merged Shop/Doctor/shared work; it cannot be treated as a Ledger-only production promotion. Do not merge #408 blindly. Resolve selective-release scope through the maintained stg-only main workflow before production.

Worktree `/workspace/ledger-brand`, branch `codex/ledger-suit/brand-release`. Staging base observed `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d`. No dirty parent changes existed or were copied.

## Actual verification

- Frozen-lockfile install with repository pnpm 10.33.0 passes. Cloud dependencies and browser cache stay in `/workspace/scratch`; no user home machine is used.
- Token generation check and workspace boundary checks pass (six Suits, 114 full route templates, zero migration debt).
- Ledger Nuxt production build and typecheck pass. Missing backend configuration warnings are expected for this cloud-local build; synthetic public test configuration is used only when running it.
- All 130 Ledger unit tests pass; financial SQL/hosted authenticated acceptance was not rerun for asset-only edits.
- Seven actual built HTTP asset responses return 200, correct SVG/PNG MIME types and exact canonical bytes.
- Eight actual Chromium login states pass: EN/AR × light/dark × 390/1280px. Visible canonical marks decode; Arabic direction is RTL. No account is entered. `production-verification.json` records the results.
- Same-stack PR check passes for #512. Task and main-to-candidate release provenance checks pass after registering internal consumers without inventing operational activation or a public Ledger version baseline.

## Release hold

The staging provider check `120018638314` on `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d` remains failed. Its GitHub output was read directly: “Remote migration versions not found in local migrations directory.” Target Ledger staging project: `yqculoltqsyfastmihmu`. The prior task records a retry denied with HTTP 403; no retry or hosted mutation was attempted here.

The provider-state rule in `docs/shared/git-workflow.md` blocks staging integration while that deployment is failed. No configured hosted Supabase identity is available in this runtime. Required action: inspect actual applied migration history using authorized cloud access and reconcile through the existing CI/deployer workflow; do not repair hosted history blindly, reset a database, apply manual hosted migrations, alter secrets or bypass checks.

No staging/main merge, hosted deployment, provider settings change, paid service, approval review or marketing publication is claimed. Staging journeys and accountant/sale-readiness gates remain unverified; inherited baseline Shop marketing/website failures remain distinct from the logo tests.
