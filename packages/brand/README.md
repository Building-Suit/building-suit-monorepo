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

## Doctor asset slots

Doctor follows the same canonical folder and four SVG filenames as Shop/Ledger.
Add or replace these files, commit them, and use the ordinary CI build/deployment:

| File in `packages/brand/assets/` | Public URL | Preferred artwork canvas |
| --- | --- | --- |
| `doctor-suit-wordmark-light.svg` | `/brand/doctor-suit-wordmark-light.svg` | 1200 × 320, following Shop |
| `doctor-suit-wordmark-dark.svg` | `/brand/doctor-suit-wordmark-dark.svg` | 1200 × 320, following Shop |
| `doctor-suit-mark-light.svg` | `/brand/doctor-suit-mark-light.svg` | 512 × 512 |
| `doctor-suit-mark-dark.svg` | `/brand/doctor-suit-mark-dark.svg` | 512 × 512 |

SVG is resolution independent: a valid `viewBox` with the intended aspect ratio
matters more than matching pixel dimensions. Use outlined text/embedded vector
artwork with no external font/image dependency. Keep transparent backgrounds
where intended. In the existing shared convention, **light** is artwork for a
dark background and **dark** is artwork for a light background. Provide both
variants for intentional contrast; do not simply rename an unsuitable version.

`brands.doctor.assetPrefix` is `/brand/doctor-suit`. Doctor's build discovers the
actual files in this directory; its single runtime brand adapter feeds landing
header/footer, sign-in/signup/verification/recovery, onboarding, and normal or
collapsed workspace navigation. A normal fresh build detects newly committed
files without future code edits or a separate asset-copy command. The shared
Nuxt layer includes exact source bytes in production output under `/brand`.

Doctor now supplies generated family artwork: a stethoscope/D inside the charcoal
and gold tile, with outlined Doctor Suit wordmarks. Artwork was generated with
image generation, then vector traced with VTracer 0.6.15 (alpha mask, spline paths;
no external fonts or raster dependencies). Light is for dark backgrounds; dark
is for light backgrounds. Both marks use the same self-contained contrast-safe
tile. The mark also supplies the discovered SVG favicon. If no SVGs are present,
Doctor retains its D monogram/name fallback and emits no missing favicon link. If one
variant fails, the shared logo uses the available sibling; if both variants of
that kind fail, it restores the monogram. A missing wordmark does not invent a
wordmark from a mark. Shared rendered sizing remains unchanged (intrinsic
1600 × 420 wordmark / 1024 × 1024 mark, responsive `object-fit: contain`), and
accessible naming remains on the logo wrapper while decorative images use
empty alt text.

Optional favicon files use existing Ledger/Shop conventions:

- `doctor-suit-app-icon.svg` is preferred when supplied; otherwise the build
  selects `doctor-suit-mark-light.svg`, then `doctor-suit-mark-dark.svg`.
- `doctor-suit-app-icon.png` (512 × 512) is an optional PNG fallback; if absent,
  `doctor-suit-email-mark.png` (512 × 512, Shop convention) can fill that slot.

Only supplied files produce icon links. There is **no automatic favicon/PNG
rasterization or social-card generation**. Doctor currently has no configured
outgoing email-logo consumer; adding a PNG does not configure hosted templates
or send mail. Public sharing metadata stays limited to the existing public
preview routes; private routes retain their metadata/privacy restrictions.

After replacement, CI should verify SVG/PNG MIME types and exact production
bytes, correct light/dark and mobile/collapsed rendering, accessible names,
and missing-variant fallback. The Doctor CI fixture also proves that dropping
synthetic SVGs into these slots is picked up by a fresh build; it never commits
those fixture files or deploys them.

## Ledger family artwork

Ledger's canonical mark is a white open ledger/L with gold ruled rows inside a
charcoal tile with a gold border, following the accepted Shop and Doctor family.
Both wordmark tones are outlined vectors without external font or image dependencies.
All existing Ledger public URLs remain stable, including app-icon/logo-mark aliases
and the 512 × 512 PNG fallback. The generated artwork is adopted from shared PR
#437 at `613177246eb05eda4e7458fd5d5d212062e03f5e`; Shop and Doctor assets are unchanged.
