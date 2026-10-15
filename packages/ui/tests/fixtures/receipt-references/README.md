# Receipt design references

The supplied English and Arabic JPGs are photographed specimens. They are retained
as test inputs, not runtime assets. Their merchant names, payment data and personal
footer are sample content only. Runtime content comes from the issued Shop snapshot.

`packages/ui/tests/receipt-browser.test.mjs` renders both directions in Chromium,
compares generated PNGs to preview pixels, checks full image dimensions and long
receipts, and creates original-reference / clean-render / difference triptychs plus
numeric comparison reports under `test-results/receipt/`.

Reference comparisons crop the photographed background (x=103, width=694) and
normalize to a common image size. Lighting, photographic distortion, font and
canonical brand-mark differences remain measurable. These reports do not certify
pixel-perfect matching. Golden clean renders in the sibling `receipt-baselines`
directory protect reviewed layout from future changes. Clean-baseline comparison
logs unaligned error and the best offset within one pixel to accommodate fractional
80 mm screenshot cropping; its 1% error threshold is unchanged.

Run with `node --test packages/ui/tests/receipt-browser.test.mjs` after installing
the repository-pinned Playwright Chromium. Set `UPDATE_RECEIPT_BASELINES=1` only
when intentionally reviewing and accepting a visual change.
