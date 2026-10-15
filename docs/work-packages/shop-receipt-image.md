# Shop receipt image implementation

Status: implemented; PR/CI verification in progress.

Base: `ecd74b1f5e3f6758bb618e67ca930b5f5f3eadd4` (PR318 merged into stg).
Branch/worktree: `codex/shop-suit/receipt-image`, `/workspace/shop-receipt`.
Parent: no active Shop parent at the verified preflight; this is the Shop staging root.
The parent performs the eventual single history-preserving staging merge.

## Behavior and ownership

Shop projects the immutable issued receipt snapshot into preformatted values.
Shared UI owns `renderReceiptDocument` and `BsSaleReceipt`; the receipt page,
print and image use the same markup and layout rules. Shop owns language,
configuration, translation, financial projection and commands. Merchant names and
branch names come from the snapshot. Optional merchant notes/footer remain
configurable; reference personal text appears only in the visual test fixture.
The current canonical Shop mark is used in monochrome rather than recreating the
older bars mark visible in the references.

Copy starts `ClipboardItem`/`clipboard.write` in the original click call stack,
with a PNG promise. Success feedback follows the resolved browser write. There is
no text fallback. Unsupported/denied copying exposes a separate image-download
action on both receipt and sale-detail screens. Rendering occurs inside the
browser, uses self-hosted fonts and inline/same-origin assets, and sends no receipt
data to an image service. It waits for fonts and image decoding, embeds font bytes,
and rasterizes complete SVG foreignObject content onto a 3x white PNG canvas.
Very large images fail explicitly before exceeding browser canvas limits.

Thermal and A4 named print sizes remain intact. Print actions are outside the
receipt content. Financial rows retain discounts, tax, actual payment allocations
and references; exceptional allocation totals also show the invoice total and
outstanding balance. Issued snapshots do not contain later return/refund events;
those existing sale-detail panels are unchanged. The receipt remains original
proof of sale, not a fabricated current refund statement or ETA document.

## References and visual evidence

Both supplied Library JPGs were successfully materialized and visually inspected:
`libfile_1a60466da1108191a0960f62026ee2e4` (Arabic),
`libfile_566d500f4a048191bb71fdf09bd250c8` (English).
Original reference inputs are committed under
`packages/ui/tests/fixtures/receipt-references/`. Clean golden renders are in the
sibling `receipt-baselines` directory. `receipt-browser.test.mjs` automatically
creates previews, copied PNGs, original/render/difference triptychs and numeric
comparison reports under ignored `test-results/receipt/`.

The photographed references are cropped at x=103, width=694 and normalized for
comparison. Their lighting, perspective and background differ from clean output.
The output is **not certified pixel-perfect**: typography, spacing and the current
canonical brand mark retain measurable differences. Do not interpret comparison
error as a perceptual similarity percentage. Manual staging review belongs to the
user after the parent's merge.

## Verification

- Focused issued-currency, projection, escaping, clipboard lifecycle and failure regressions.
- Chromium AR/EN clean-baseline comparison, preview/PNG pixel comparison with
  antialiasing tolerance, no external asset requests, PNG dimensions and 30-line
  receipts. The PNG regression caught font/line-height drift before publication.
- `pnpm check`, `pnpm release:check`, `pnpm test`, all-app `pnpm lint`
  and Shop production build passed. Lint retains two pre-existing owner-invitation
  attribute-order warnings.
- All-app typecheck initially lacked the generated docs index; generated the
  maintained catalogue and reran with concurrency 2: all six apps passed.
- Real built-Shop Chromium coverage verifies an actual PNG clipboard write/read,
  denied-permission download, dark-mode white receipt, print invocation and A4
  selection in both languages. Only synthetic fixture services run in the cloud.
- Initial CI found system-heading-font differences in clean baselines. Headings
  now use self-hosted Manrope; body uses self-hosted Roboto Condensed and IBM Plex
  Sans Arabic. Further CI inspection identified LCD subpixel antialiasing rather
  than geometry drift: CI images had colored text edges, local images were gray.
  Chromium's deterministic fixture now sets `--disable-lcd-text`; baseline and
  preview/PNG thresholds remain unchanged. Temporary diagnostic logging and
  alignment allowances were removed. Reference and preview/PNG comparisons passed.
- CI and exact PR/head results are recorded in PR #321; no hosted database writes,
  direct stg/main pushes or manual deployments are part of this change.
