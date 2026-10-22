# Product logo family update

Owner request: crop Shop logo whitespace without altering artwork; generate Ledger sibling artwork following Doctor and Shop.

Worktree: `/workspace/product-brand-family`, branch `codex/shared/product-brand-family`, parent `origin/stg` at `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d`. No active shared parent existed; Doctor PR435 and its open stack are preserved separately.

Shop changes only the root SVG canvas/viewBox and intrinsic dimensions of both wordmarks. Painted nodes, transforms, text, colors and gradients remain byte-identical; marks and email art remain unchanged. Original measured painted bounds are x53.44, y49.44, width759.7944, height220.48. New canvas x48,y44,772×232 retains the strokes and modest padding. Drawing payload hashes are retained in shop-crop.json.

Ledger artwork generation and validation: in progress. No hosted branding/email configuration, financial behavior, product activation, deployment or merge is included.
