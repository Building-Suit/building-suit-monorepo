# Canonical brand assets

`assets/` is the only source of product logos and marks. The shared Nuxt layer
mounts this directory at `/brand` and includes it in Nitro's production public
output. Keep these paths stable: transactional email may reference older URLs.

Shop assets:

| Use | Public path |
| --- | --- |
| Browser favicon / canonical mark | `/brand/shop-suit-mark-light.svg` |
| Email logo / PNG favicon fallback | `/brand/shop-suit-email-mark.png` |
| Wordmarks | `/brand/shop-suit-wordmark-light.svg`, `/brand/shop-suit-wordmark-dark.svg` |
| Alternate mark | `/brand/shop-suit-mark-dark.svg` |

`brands.shop.icon` and `brands.shop.emailLogo` export the favicon and email paths.
The email PNG is a transparent 512 × 512 raster of `shop-suit-mark-light.svg`,
with no font dependency. Its dark tile preserves contrast on light/dark email
backgrounds. Regenerate from that SVG when the canonical mark changes:

```sh
magick -background none packages/brand/assets/shop-suit-mark-light.svg -strip PNG32:packages/brand/assets/shop-suit-email-mark.png
```

Email templates must prepend the intended environment's publicly reachable
HTTPS Shop origin; relative URLs do not work in email. For example (replace
the illustrative origin with the verified Shop deployment origin):

```html
<img src="https://shop.example.com/brand/shop-suit-email-mark.png" width="64" height="64" alt="Shop Suit" style="display:block;border:0" />
```

This task provides assets and paths; it does not configure hosted templates or
deploy them. After deployment, verify anonymous HTTPS GET returns `image/png`
from the intended origin before using it in outgoing email.

The Shop task tests require a current production build and check asset responses
and rendered favicon head output through Nitro's in-process request pipeline,
without requiring a TCP listener:

```sh
pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit
node --test apps/shop-suit/tests/unit/ss-launch-brand-001-1.test.mjs
node --test apps/shop-suit/tests/unit/ss-launch-brand-001-2.test.mjs
```

Production acceptance runs with `pnpm test:built-assets` after `pnpm build` (or a Shop build). It checks the compiled HTTP pipeline for all six canonical assets, exact bytes/MIME types and rendered favicon links. CI review checks validate source images without requiring stale build output; the full CI job runs production acceptance after its build.

## Product family artwork, October 2026

Shop wordmarks retain the exact existing drawing payload. Their SVG viewport is
now `48 44 772 232`, removing unused canvas at the right and around the logo.
This is a crop of the SVG canvas; no path, text, transform, color or gradient
was redrawn. The Shop mark and email PNG are unchanged.

Ledger now uses a white open ledger/L with gold ruled rows inside the same
charcoal/gold tile family as Shop and Doctor. Both wordmark tones are outlined
vectors without font/raster dependencies. The shared contrast-safe tile supplies
both mark variants, `ledger-suit-app-icon.svg`, `ledger-suit-logo-mark.svg` and the
512 × 512 PNG app-icon fallback. Existing public paths remain stable. The
artwork was generated with image generation and converted to spline SVG paths
with VTracer 0.6.15; the PNG is a raster of that canonical mark. No app logic,
financial behavior, hosted email configuration or operational registration changed.

See [the task record](../../docs/work-packages/brand-family/README.md) for
canvas payload hashes, production asset checks and rendered states.
