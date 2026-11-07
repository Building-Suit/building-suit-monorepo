# Product logo family update

Owner request: crop Shop logo whitespace without altering artwork; generate Ledger sibling artwork following Doctor and Shop.

Worktree: `/workspace/product-brand-family`, branch `codex/shared/product-brand-family`, parent `origin/stg` at `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d`. No active shared parent existed; Doctor PR435 and its open stack are preserved separately.

Shop changes only the root SVG canvas/viewBox and intrinsic dimensions of both wordmarks. Painted nodes, transforms, text, colors and gradients remain byte-identical; marks and email art remain unchanged. Original measured painted bounds are x53.44, y49.44, width759.7944, height220.48. New canvas x48,y44,772×232 retains the strokes and modest padding. Drawing payload hashes are retained in shop-crop.json.

Ledger's generated open-ledger/L artwork now occupies both canonical wordmarks and mark variants. Canonical app-icon and logo-mark SVG aliases use that same contrast-safe mark; the PNG fallback is a 512×512 raster of it. The artwork follows Doctor and Shop's charcoal/gold tile family. All new Ledger text is outlined vector artwork with no external font/image dependency.

Validation:

- Shop and Ledger production builds pass (two tasks). Three maintained source brand checks and the maintained built-asset check pass.
- Eleven affected production asset responses match source bytes and SVG/PNG MIME types exactly.
- Sixteen auth-page states pass in EN/AR, light/dark and 390/1280px; four public landing states also pass with narrow owned loopback read-only empty public catalogue fixtures. Unknown/private/write routes return 503. This proves brand rendering, not business/provider acceptance.
- The first landing probe without a backend returned Shop HTTP 500 after ECONNREFUSED and a pre-existing non-POJO error serialization path. No application code was changed or guard weakened to mask it; providing only the public synthetic catalogue read allowed isolated branding verification. Hosted outage handling is not claimed fixed.
- SVG drawing payloads remain byte-identical after cropping. Browser occupied pixel bounds are preserved; raster antialias/gradient differences after viewport translation are recorded rather than claiming exact PNG identity.
- Exact-candidate release coverage passes against staging parent `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d`; the shared PR remains a separate root on `stg`.
- Workspace boundaries pass for six Suits and 114 route templates. Full repository/financial suites were not repeated for asset-only changes. The inherited 54 Shop failures and prior shared-settings failures remain disclosed; no full CI pass is claimed.

Runtime observations are in runtime-verification.json, landing-verification.json and shop-pixel-verification.json. Public preview screenshots are in ignored test-results/brand-family and test-results/brand-family-landing; no credentials/account data were entered.

Shop/Ledger preview: start their root dev commands from this shared feature worktree, or explicitly select `codex/shared/product-brand-family`. Doctor's newer M3/auth source remains in its own stack; preview it from `/workspace/doctor-m4-001` with `pnpm dev:doctor --worktree codex/doctor-suit/m4-001-platform-decision`. Independent worktrees are not implicitly combined. No hosted branding/email configuration, financial behavior, product activation, deployment or merge is included.
