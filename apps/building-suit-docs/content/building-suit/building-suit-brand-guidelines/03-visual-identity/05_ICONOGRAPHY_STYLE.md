# Iconography Style

> **Status:** Complete (initial). The style and rules for icons across Building Suit. Icons are primarily flat (per `03_VISUAL_LANGUAGE.md`), clean, and consistent — supporting the structured, premium feel.

---

## Icon style
- **Flat, line-first (outline) icons** with a geometric-humanist feel that matches the typography (Manrope/Inter).
- Clean, modern, and **calm** — not playful, not heavily detailed, not skeuomorphic.
- Consistent visual weight and proportions across the whole set.
- **Required icon library: [Hugeicons](https://hugeicons.com/).** Use **Hugeicons Stroke Rounded only** from the free library. Solid, Duotone, Twotone, Bulk, and other paid styles are out of scope and must not be used until a paid license is approved.
- Do not substitute or mix Lucide, Phosphor, or other icon families.
- Use a custom domain icon only when Hugeicons does not provide a clear product-specific glyph. Custom icons (unit, building, ledger, vote) must follow the same grid, stroke, rounding, and optical weight as the Hugeicons set.
- **Grid:** draw on a **24×24** grid with a ~2px live-area padding (≈20px artwork).

`[Insert icon style overview]`

---

## Stroke width
| Icon size | Stroke |
|---|---|
| 16px | 1.5px |
| 20–24px | **2px** (default) |
| 32px+ | 2–2.5px |

- Keep stroke **optically consistent** across the set; scale stroke with size, don't leave a 2px stroke on a 48px icon.
- Use a single stroke width within any one screen.

## Rounded corners
- **Rounded line caps and joins** (round terminals), matching the soft-but-structured geometry.
- Corner radius on icon shapes ~2px on the 24px grid — gently rounded, never sharp, never fully pill.
- Consistent rounding with the UI's 8/12/16 radius language.

---

## Stroke-only state rules
| State / context | Style |
|---|---|
| Default icons (toolbars, lists, content) | **Hugeicons Stroke Rounded** |
| Active / selected (e.g. current nav tab) | **Stroke Rounded** + Premium Gold + label or indicator |
| Status/semantic icons (success, error) | **Stroke Rounded** within their colored chip |
| Decorative/large brand icons | **Stroke Rounded**; use scale or color for emphasis |

- Keep the same Hugeicons Stroke Rounded glyph across every state. Show active state with Premium Gold plus a label, underline, rail, dot, or selected container.
- Do not use Solid, Duotone, Twotone, Bulk, or any other paid Hugeicons style.

`[Insert Stroke Rounded state comparison]`

---

## Active icon state
- **Active = Stroke Rounded icon + Premium Gold** (`#D89B42`) with a label and/or a gold indicator (dot, underline, rail, or selected container).
- **Inactive = Stroke Rounded icon** in muted text color (Slate Gray on light / Sky Steel on dark).
- Hover/pressed (web): shift toward Highlight Gold or add a subtle navy/surface background.
- Keep transitions quick and subtle (no bouncy animation).

| State | Icon | Color |
|---|---|---|
| Inactive | Stroke Rounded | Slate Gray `#5A6573` / Sky Steel `#7E97B3` |
| Hover | Stroke Rounded | Graphite / Pearl White |
| Active/selected | Stroke Rounded + indicator/label | Premium Gold `#D89B42` |
| Disabled | Stroke Rounded | Cloud Gray `#CBD2DB` |

---

## Gold accent usage
- Use gold on icons **only for active/selected or a single key highlight** — consistent with the "one gold focus per view" rule.
- Default content icons are **neutral** (not gold); gold marks state or importance.
- Status icons use their **semantic** color (green/red/amber/blue), not gold.
- Avoid all-gold icon sets — gold loses meaning if everything is gold.

---

## Navigation icon usage
- **Bottom navigation (mobile):** 24px Stroke Rounded icons; inactive = muted, active = Premium Gold + label + optional indicator. Keep 3–5 destinations.
- **Tabs / segmented controls:** Stroke Rounded icons; active tab gets a gold indicator and/or gold icon/text.
- **App bar / toolbar:** 24px Stroke Rounded icons; ensure 44×44dp tap targets and 8px spacing.
- **Directional icons (back, chevrons, arrows):** **mirror in RTL** (a back arrow points right in Arabic). Non-directional icons (search, settings, home) are **not** mirrored.
- Always pair nav icons with text labels where space allows (accessibility + clarity).

| Element | Icon size | Inactive | Active |
|---|---|---|---|
| Bottom nav | 24px | Stroke Rounded, muted | Stroke Rounded, Gold, label/indicator |
| Tab bar | 20–24px | Stroke Rounded | Gold indicator + Gold icon/text |
| App bar action | 24px | Stroke Rounded | n/a (action, not state) |

`[Insert navigation icon states mockup]`

---

## Domain icon notes
Custom icons for product concepts follow all rules above and should read instantly:
- **Unit / apartment** — a window-square (ties to the logo motif).
- **Building** — simplified façade (echo the logo silhouette, not a copy of the logo).
- **Ledger / balance** — book/list with a coin or currency mark.
- **Charge / payment / expense** — receipt, arrow-in/arrow-out, wallet.
- **Issue** — wrench or alert in a rounded square.
- **Announcement** — megaphone/bell.
- **Vote** — ballot/check; **election vote** — ballot box.
- **Future/Post-MVP service provider** — toolbox/handshake; do not use in MVP navigation or active screens.

Keep these in one set, same grid/stroke/rounding, so the product feels unified.

`[Insert domain icon set sheet]`

## Developer notes
- Implement one shared icon wrapper around the Hugeicons library for size, color, accessibility semantics, and RTL mirroring.
- Source production icons only from the free Hugeicons Stroke Rounded library; centralize icon names so paid styles or alternate libraries cannot enter feature code.
