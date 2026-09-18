# Layout and Spacing

> **Status:** Complete (initial). The grid and spacing system that produces consistent, structured Building Suit layouts. Built on an 8px base, designed mobile-first, and RTL-aware.

---

## Grid system
| Platform | Columns | Margin | Gutter |
|---|---|---|---|
| **Mobile** (Flutter, ≤599dp) | 4 | 16dp | 16dp |
| **Tablet** (600–1023dp) | 8 | 24dp | 24dp |
| **Desktop / web** (≥1024px) | 12 | 24–32px | 24px |
| Max content width (web) | — | centered, **1200–1280px** | — |

- Lay everything on the grid; align cards and sections to columns.
- Use a consistent **vertical rhythm** based on the spacing scale below.
- **RTL:** the grid mirrors — margins/gutters identical, content flows right-to-left.

`[Insert grid overlay diagram]`

---

## 8px spacing system
Base unit **8px**; a half-step (4px) is allowed for fine adjustments.

| Token | Value | Typical use |
|---|---|---|
| `space-0` | 0 | Reset |
| `space-1` | 4px | Icon-to-label, tight inline gaps |
| `space-2` | 8px | Small padding, chip padding |
| `space-3` | 12px | Compact gaps |
| `space-4` | 16px | Default padding, mobile margins, list gaps |
| `space-5` | 24px | Card padding, section inner spacing |
| `space-6` | 32px | Between groups |
| `space-7` | 48px | Section spacing |
| `space-8` | 64px | Large section breaks |
| `space-9` | 96px | Hero / marketing whitespace |

- All paddings, margins, and gaps come from this scale — no arbitrary values.
- Maps directly to design tokens (`07-design-tokens/`) and Flutter/Tailwind spacing.

---

## Card radius
| Element | Radius |
|---|---|
| Cards / surfaces | **16px** |
| Modals / sheets | 20–24px (top corners for bottom sheets) |
| Large containers / hero panels | 24px |
| Small inner tiles | 12px |

- Consistent rounding across the system creates the calm, premium feel.
- Match the logo's soft-but-structured geometry (rounded, not pill-soft, not sharp).

## Button radius
| Element | Radius |
|---|---|
| Buttons | **12px** |
| Inputs / selects | 12px |
| Chips / tags | 8px (or pill for filter chips) |
| Icon buttons | 12px (or circular for FAB) |
| Avatars | circular |

> Keep radii from a small set (8 / 12 / 16 / 20–24) — don't invent new values per component.

---

## Page padding
| Context | Padding |
|---|---|
| Mobile screen edges | 16dp (horizontal) |
| Mobile top/bottom (within safe area) | 16–24dp |
| Tablet | 24dp |
| Web page | 24–32px, content max 1200–1280px centered |
| Card interior | 16–24px |

- Always respect device **safe areas** (notch, status bar, home indicator, keyboard insets).

## Section spacing
| Context | Between sections |
|---|---|
| Mobile | 24–32dp |
| Web | 48–96px (hero/marketing larger) |
| Within a section (heading → content) | 16–24px |
| Between cards in a list | 12–16px |

---

## Mobile layout rules
- **Mobile-first**; design for one-handed use — primary actions reachable at the bottom (bottom bar / FAB).
- Single-column content; group into cards; clear one primary action per screen.
- 44×44dp **minimum tap target**; 8px minimum spacing between targets.
- Use bottom sheets/modals for focused tasks; sticky headers for context.
- Respect safe areas and keyboard insets; keep key actions visible above the keyboard.
- **RTL:** mirror navigation, back/forward, alignment, and directional icons.

`[Insert mobile layout examples]`

---

## Website layout rules
- 12-column grid, content max **1200–1280px**, centered, generous margins.
- Clear vertical rhythm using the 8px scale; large section spacing (48–96px).
- Responsive breakpoints: ≤599 (mobile), 600–1023 (tablet), ≥1024 (desktop); scale type with the web→mobile type ramp.
- Sticky, slim header with the logo (variant per theme); roomy footer with the opposite-contrast logo.
- Hero: strong headline + one primary CTA + supporting visual; lots of negative space and a single gold accent.
- **RTL:** full mirrored layout for Arabic pages.

`[Insert website layout examples]`

---

## PDF layout rules
(For the brand guidelines and exported documents — see `08-final-guidelines/`.)

- **Page size:** A4 (210 × 297mm) primary; US Letter alternate. Consistent orientation (portrait for the guidelines doc).
- **Margins:** 20–24mm all sides; more on the binding edge if printed.
- **Grid:** 12-column with a 24mm baseline rhythm; keep generous whitespace.
- **Cover:** Building Navy background with the light/silver logo and gold accent.
- **Section dividers:** full navy pages with the section title and a gold rule.
- **Typography:** follow the marketing/print scale; body 10–12pt, comfortable leading (~1.5).
- **Color:** export with correct color profile; confirm gold and navy reproduce (see `08-final-guidelines/04_PDF_EXPORT_CHECKLIST.md`).
- **Footer:** page number, section name, and small logo; consistent across pages.

`[Insert PDF page layout template]`
