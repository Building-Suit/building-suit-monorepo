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
no text fallback. Pending image results and download fallbacks are invalidated
when the merchant, branch or receipt changes or the page unmounts. Unsupported/denied copying exposes a separate image-download
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

The photographed references are cropped at x=103, width=694 and compared at
equal paper width with aspect ratios preserved and white padding. Earlier
full-height normalization distorted vertical spacing, so its scores are not
directly comparable to the current report. Their lighting, perspective and background differ from clean output.
The output is **not certified pixel-perfect**: typography, spacing and the current
canonical brand mark retain measurable differences. Do not interpret comparison
error as a perceptual similarity percentage. Manual staging review belongs to the
user after the parent's merge.

## Verification

- Reference-review follow-up uses regular self-hosted Roboto for body text,
  retaining condensed table text to preserve column fit. Shop/branch headings use regular Roboto to match reference widths. Detail glyphs are 18 px
  with stronger strokes; English footer spacing and thank-you width were adjusted.
  Aspect-preserving photograph comparison error is EN 0.09808 / AR 0.10148,
  with 689/701 px clean heights at 304 px paper width. These values include photo
  lighting and remaining layout/type differences; pixel-perfect matching remains
  unverified. Arabic date/time uses an isolated LTR numeric group with localized
  meridiem, verified through actual browser text-range positions.
- Focused issued-currency, projection, escaping, clipboard lifecycle and failure regressions.
- Chromium AR/EN clean-baseline comparison, preview/PNG pixel comparison with
  antialiasing tolerance, no external asset requests, PNG dimensions and 30-line
  receipts. The PNG regression caught font/line-height drift before publication.
- `pnpm check`, `pnpm release:check`, `pnpm test`, all-app `pnpm lint`
  and Shop production build passed. Lint retains two pre-existing owner-invitation
  attribute-order warnings.
- All-app typecheck initially lacked the generated docs index; generated the
  maintained catalogue and reran with concurrency 2: all six apps passed.
- Existing receipt suites were updated for PNG semantics and the shared receipt
  table: 12 locale/theme/viewport cases and 15 currency/print-isolation cases passed.
- Real built-Shop Chromium coverage verifies an actual PNG clipboard write/read,
  denied-permission download, dark-mode white receipt, print invocation and A4
  selection in both languages. Only synthetic fixture services run in the cloud.
- Initial CI found system-heading-font differences in clean baselines. Headings
  initially used self-hosted Manrope, then reference review selected Roboto; body uses self-hosted Roboto and IBM Plex Sans Arabic; compact table
  text uses Roboto Condensed. Further CI inspection identified LCD subpixel antialiasing rather
  than geometry drift: CI images had colored text edges, local images were gray.
  Chromium's deterministic fixture now sets `--disable-lcd-text`; baseline and
  preview/PNG thresholds remain unchanged. Temporary diagnostic logging and
  alignment allowances were removed. Reference and preview/PNG comparisons passed.
- CI and exact PR/head results are recorded in PR #321; no hosted database writes,
  direct stg/main pushes or manual deployments are part of this change.

### Privacy CI fixture shutdown

The exact-head privacy failure on `1c0e5749` occurred while a synthetic forwarder
still held a fetched APIResponse during browser-context teardown. The fixture now
materializes the response body, awaits fulfillment and disposes the response,
then drains active forwards before closing the context. New prefetches are
aborted during shutdown while interception remains installed. No consent/product
logic or privacy assertions changed; retries remain zero. A gated regression
proves that context close waits for fulfillment: it fails without the drain and
passes with it. All nine privacy tests passed twice (18/18) locally. Exact-head
CI results are tracked on PR #321.
