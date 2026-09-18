# App Icon Guide

> **Status:** Complete (initial). How to build the Building Suit app icon and related small marks from the approved logo. Read with `02_LOGO_USAGE_RULES.md` and `04_LOGO_DOS_AND_DONTS.md`.

---

## Icon concept
The app icon is **not** the full tall logo dropped into a square. It is the **building-B mark, centered and optically balanced inside a square**, sitting on a solid brand background so the gold windows read clearly at small sizes.

- **Recommended default:** the **light (white/silver) building-B on a brand-navy background** — maximum contrast, premium, and the gold windows glow. *(This is the hero combination from the logo analysis.)*
- Keep the 3D mark intact; only the framing (square + background + padding) is added.
- Do not add text to the icon.

`[Insert app icon mockup]`

---

## iOS app icon guidance
- **Master size:** 1024 × 1024 px, square, **no transparency**, no pre-rounded corners (iOS applies the mask).
- **Shape:** iOS uses a superellipse ("squircle") mask — keep the mark within the safe area (see below) so corners never clip it.
- **Background:** solid brand navy (default). Avoid photographic or gradient-heavy backgrounds.
- **Single layer:** iOS icons are flat (no separate fore/background layers).
- Provide the required size set via the asset catalog (Xcode generates from 1024 master, or supply per-size as needed).

| Use | Size |
|---|---|
| App Store / master | 1024 × 1024 px |
| iPhone app | 180 × 180 (60pt @3x), 120 × 120 (@2x) |
| Settings / Spotlight / Notifications | down to 40 × 40 px (use simplified mark — see small-size) |

`[Insert iOS app icon mockup]`

---

## Android app icon guidance
- Use **adaptive icons:** separate **foreground** (the building-B mark) and **background** (solid brand navy) layers, each **108 × 108 dp**, delivered on a **512 × 512 px** master for Play.
- The system applies various masks (circle, squircle, rounded square), so keep the mark within the inner **safe zone** (see below).
- Foreground mark should occupy roughly the central ~66 dp of the 108 dp layer.
- Provide a **monochrome layer** for Android 13+ themed icons (use the flat single-colour companion mark once produced).
- Also supply a legacy square/round fallback for older devices.

| Layer | Size | Notes |
|---|---|---|
| Adaptive foreground | 108 × 108 dp | Mark only, transparent around it |
| Adaptive background | 108 × 108 dp | Solid brand navy |
| Play Store master | 512 × 512 px | Full-bleed, no transparency |
| Monochrome (Android 13+) | 108 × 108 dp | Flat companion mark |

`[Insert Android adaptive icon mockup]`

---

## Rounded square safe area
Because every platform crops differently, keep all essential detail inside a central safe zone.

| Canvas | Keep mark within | Edge margin (each side) |
|---|---|---|
| iOS 1024 master | central ~80% | ~10% padding |
| Android 108 dp adaptive | central ~66 dp circle/square | outer ~21 dp may be masked |

- Center the mark **optically**, not just mathematically (the building stem can pull the visual center).
- Never let windows or the door touch the icon edge or fall in the maskable margin.
- Test against circle, squircle, and rounded-square masks before shipping.

`[Insert rounded-square safe-area diagram]`

---

## Dark app icon version
- **Default icon is already dark-background** (navy), so it sits comfortably in most contexts.
- For platforms supporting **dark/tinted icon variants** (iOS dark/tinted, Android themed), provide:
  - **Dark variant:** light/silver mark on a deeper navy/near-black background.
  - Ensure the gold windows remain visible and the mark keeps contrast.
- Don't invert the mark's own colours — only adjust the background tone within brand navy/charcoal.

`[Insert dark app icon version]`

---

## Light app icon version
- Provide a **light-background variant** where a light icon is required (e.g. light themed icons, certain marketing contexts):
  - **Dark (navy) building-B on a white / light-silver background.**
  - Keep gold windows their approved gold; ensure navy has clear separation from the light background.
- Use the light version only where the platform/context calls for it; the **navy-background icon remains the primary**.

`[Insert light app icon version]`

---

## Small-size readability
At small sizes the full window grid can muddy. Maintain a **size-stepped approach**:

| Size range | Treatment |
|---|---|
| ≥ 180 px | Full detailed building-B (all windows, door, 3D) |
| 80–180 px | Building-B with slightly simplified shading |
| 40–80 px | Simplified flat building-B; reduce window detail, keep silhouette + a few gold accents |
| < 40 px | Minimal mark — bold "B" silhouette with a single gold accent (see favicon) |

- Prioritise the **recognisable building-B silhouette** over fine detail.
- This requires the **flat single-colour / simplified companion mark** (currently an outstanding asset — see `assets/logos/logo-source-notes.md`). Do not hand-shrink the 3D logo for tiny sizes.

`[Insert small-size readability comparison]`

---

## Splash screen guidance
- **Background:** solid brand navy (matches the default icon for a seamless launch).
- **Logo:** the **light (white/silver) full logo** or the building-B mark, centered, within clear space; keep it small-to-medium, never edge-to-edge.
- Respect device **safe areas** (notches, status bars, home indicator).
- Keep it calm and brief — no animation that delays first use; a subtle fade is enough.
- Provide assets for all densities/resolutions and both orientations.

`[Insert splash screen mockup]`

---

## Notification icon guidance
- **Android requires a flat, single-colour, transparent notification icon** (the system tints it). Supply a **white silhouette of the building-B** on transparency — **no gold, no 3D, no background**.
- Keep it bold and simple so it reads in the status bar (24 × 24 dp baseline, with density variants).
- **iOS** uses the app icon for notifications (no separate monochrome icon needed).
- Use the silhouette/flat companion mark for this — never a colour or 3D version.

| Platform | Notification icon |
|---|---|
| Android | Flat white building-B silhouette on transparent, system-tinted |
| iOS | Uses app icon |

`[Insert notification icon mockup]`

---

## Favicon guidance
- Use the **simplified building-B mark**, not the full tall logo.
- Provide a multi-size `.ico` plus PNGs: **16, 32, 48 px**, and a **180 px** apple-touch-icon, plus a **512 px** maskable PWA icon and a `site.webmanifest`.
- **16 px:** use the minimal mark (bold B silhouette + single gold accent); detail will not survive — prioritise the silhouette.
- Background: brand navy for maskable/touch icons; transparent acceptable for classic favicons where the host background is light.
- Verify legibility in a real browser tab (light and dark browser themes).

| Asset | Size | Notes |
|---|---|---|
| Classic favicon | 16, 32, 48 px (`.ico`/PNG) | Minimal mark at 16 px |
| Apple touch icon | 180 × 180 px | Navy background, no transparency |
| PWA maskable | 512 × 512 px | Respect maskable safe zone |

`[Insert favicon size set mockup]`

---

## Export checklist
- [ ] iOS 1024 master (square, no alpha, no pre-rounded corners).
- [ ] Android adaptive foreground + background (108 dp) and 512 px Play master.
- [ ] Android monochrome layer + notification silhouette (flat, transparent).
- [ ] Mark within each platform's safe area; tested against circle/squircle/rounded-square masks.
- [ ] Dark and light icon variants produced where supported.
- [ ] Small-size/simplified mark used below 40 px; favicon set generated.
- [ ] Splash assets for all densities and orientations.
- [ ] Gold and navy match the colour-system values; contrast verified.
- [ ] Flat/simplified companion mark obtained for small + monochrome needs.

`[Insert app icon export sheet mockup]`
