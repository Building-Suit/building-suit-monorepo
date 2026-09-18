# Repository Design System Manifest

**Status:** Indexed (approved for prototype use)
**Index date:** 2026-06-20
**Approved by:** User (repository-native design-system index task)

## Canonical repository sources

| Field | Value |
|---|---|
| Root | `.docs/building-suit-brand-guidelines/` |
| Canonical tokens | `07-design-tokens/design-tokens.json` |
| Component rules | `04-ui-system/02_COMPONENT_STYLE_GUIDE.md` |
| Final guidelines | `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md` |
| Assets/evidence | `assets/` and `exports/` |
| Last successful index | 2026-06-20 |

## Indexed design-system evidence

| System item | Repository source | Type | Purpose | Theme/direction | Approval status |
|---|---|---|---|---|---|
| Canonical tokens | `07-design-tokens/design-tokens.json` | Tokens (JSON) | Exact color/type/spacing/radius/shadow/component values | Light + dark roles | Approved |
| Generated color vars | `07-design-tokens/colors.css` | Tokens (CSS) | Platform mirror of JSON colors | — | Reference only (JSON wins) |
| Generated Tailwind colors | `07-design-tokens/tailwind.colors.js` | Tokens (JS) | Platform mirror | — | Reference only (JSON wins) |
| Generated Flutter colors | `07-design-tokens/flutter_colors.dart` | Tokens (Dart) | Platform mirror for Flutter target | — | Reference only (JSON wins) |
| Color system | `03-visual-identity/01_COLOR_SYSTEM.md` | Rule doc | Named palette, roles, semantics, contrast | Light + dark | Approved |
| Typography system | `03-visual-identity/02_TYPOGRAPHY_SYSTEM.md` | Rule doc | Type families, scale, weights, RTL | LTR + RTL | Approved |
| Visual language | `03-visual-identity/03_VISUAL_LANGUAGE.md` | Rule doc | Depth, gold discipline, shadows, 3D vs flat | — | Approved |
| Layout and spacing | `03-visual-identity/04_LAYOUT_AND_SPACING.md` | Rule doc | 8px grid, radii, page/section spacing | Mobile-first | Approved |
| Iconography style | `03-visual-identity/05_ICONOGRAPHY_STYLE.md` | Rule doc | Hugeicons Stroke Rounded, states, RTL mirroring | — | Approved |
| Imagery style | `03-visual-identity/06_IMAGERY_STYLE.md` | Rule doc | Imagery/motif rules | — | Approved |
| UI style guide | `04-ui-system/01_UI_STYLE_GUIDE.md` | Rule doc | UI personality, layout, navigation, forms | Light + dark | Approved |
| Component style guide | `04-ui-system/02_COMPONENT_STYLE_GUIDE.md` | Rule doc | Component anatomy, variants, states | Light + dark | Approved |
| Dark mode guide | `04-ui-system/03_DARK_MODE_GUIDE.md` | Rule doc | Dark theme surfaces, gold, logo, a11y | Dark | Approved |
| Light mode guide | `04-ui-system/04_LIGHT_MODE_GUIDE.md` | Rule doc | Light theme surfaces, gold, logo, a11y | Light | Approved |
| Final brand document | `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md` | Rule doc | Consolidated final rules | — | Approved |
| Logo assets | `assets/logos/building-suit-logo-{dark,light}.png` | Asset | Light/dark logo artwork | Light + dark | Approved |
| Visual exports | `exports/*.png` | Evidence | Color/type/logo/UI reference boards | — | Approved (reference) |
| Claude Design source pack | `06-claude-design/` | Prompt/source | External-tool prompts only | — | Reference only (non-canonical) |
| Pre-designed product screens | — | — | None exist in repository | — | Absent (by design) |

## Visual system summary

| Area | Approved evidence | Canonical source | Notes |
|---|---|---|---|
| Color roles | Color/light/dark mode guides | `design-tokens.json` → `color.role.{light,dark}` | Primary action flips: Navy on light, Gold on dark |
| Typography | Typography system | `design-tokens.json` → `typography` | Manrope (Latin) / IBM Plex Sans Arabic; Arabic line-height +10–15% |
| Spacing/layout | Layout and spacing guide | `design-tokens.json` → `spacing` | 8px base scale (0,4,8,12,16,24,32,48,64,96); 4px half-step allowed |
| Radius/elevation | Layout guide + UI guides | `design-tokens.json` → `radius`, `shadow` | Radii 8/12/16/24 + full; 3 elevation steps per mode (see D-02 re: 20px dialog) |
| Iconography | Iconography guide | Iconography style doc | Hugeicons Stroke Rounded only; 24×24 grid, 2px default stroke; directional icons mirror in RTL |
| Imagery/motif | Visual language + imagery guides | Visual language doc | Window-grid motif used restrained; 3D for brand moments, flat for product UI |
| Motion | UX specification (governs) | `02_COMPONENT_STYLE_GUIDE.md` | 120–200ms ease; reduced-motion support required |

## Supported modes

- [x] Mobile 390 × 844 (canonical breakpoints: ≤599dp mobile, 4-col, 16dp margin/gutter)
- [x] Light mode
- [x] Dark mode
- [x] English LTR
- [x] Arabic RTL
- [x] Reduced motion (UX spec governs)

## Index approval gate

- [x] Canonical repository sources are readable.
- [x] Exact source paths and index date recorded.
- [x] Canonical tokens parsed without replacement.
- [x] Source documents and assets preserved unchanged.
- [x] Components inventoried (see `02_COMPONENT_CATALOGUE.md`).
- [x] Absence of pre-designed product screens recorded and understood (see `03_SCREEN_DESIGN_APPROVAL_INDEX.md`).
- [x] Token conflicts recorded (see `04_DISCREPANCY_LOG.md`).
- [x] Missing modes/states recorded (see `04_DISCREPANCY_LOG.md`).
- [x] User approved this repository design-system manifest for prototype use.
