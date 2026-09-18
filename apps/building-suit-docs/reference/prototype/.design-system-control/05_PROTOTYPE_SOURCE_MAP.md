# Prototype Source Map

**Status:** Vue/Vite auth prototype materialized (2026-06-23). Login, registration, verification, password recovery/reset, and One Last Step are implemented as shared Vue components in `prototype/src/`; rows 4–18 remain traceability only.
**Purpose:** Map every Building Suit prototype screen family to its exact normative sources (UX → PRD → BRD → tokens → final brand → control records → implementation plan → architecture) and to the design-system components it will reuse. This is the screen-design contract Cowork owns; the repository supplies system rules, not screen compositions.

## Scope guard

- **Building Suit is the only active portal.** Shop Suit, Business Suit, City Suit, and Super-Admin internal UIs are out of scope (UX §2.1; CLAUDE.md Hard Boundaries).
- **No live Paymob collection** (PRD §1.5; Implementation MS-P1 GATED). Finance is manual-first (MS-3).
- Build order follows Implementation Plan **MS-1 → MS-5** (the prototype covers MS-1..MS-5 client surfaces; MS-0/MS-6 are platform/release, not screens; MS-P1/MS-P2 are GATED post-MVP).

## Build sequence (aligned to Implementation Plan §11 recommended order)

| # | Screen family | Milestone / Epic | First slice? |
|---|---|---|---|
| 0 | Vue component foundation (reusable auth baseline) | — (Materialize stage) | **Done for auth components — 2026-06-23** |
| 1 | **Login** | MS-1 / E1 | **Yes — built in Vue 2026-06-23** |
| 2 | Registration & verification | MS-1 / E1 | **Built in Vue 2026-06-23** |
| 3 | Password recovery & reset | MS-1 / E1 | **Built in Vue 2026-06-23** |
| 4 | Authenticated shell (header, side menu, bottom nav) | MS-2 / E2 | Shared infra |
| 5 | Empty State / Welcome & building context (Build Select) | MS-2 / E2 | — |
| 6 | Create Building wizard | MS-2 / E2 | — |
| 7 | Join Building | MS-2 / E2 | — |
| 8 | Home dashboard (+ Units, Members, approvals) | MS-2 / E2 | — |
| 9 | Building Settings (general, join code, billing config) | MS-2 / E2 | — |
| 10 | Finance dashboard (+ finance confirmation modals) | MS-3 / E3 | — |
| 11 | Ledger & Unit Financial History | MS-3 / E3 | — |
| 12 | Manual payment instructions | MS-3 / E3 | — |
| 13 | Community — Support (announcements, issues) | MS-4 / E6 | — |
| 14 | Community — Governance (votes, elections) | MS-4 / E5 | — |
| 15 | Services & provider profile | MS-5 / E7 | — |
| 16 | Notifications (popover + timeline) | MS-5 / E6 | — |
| 17 | Profile, preferences & security | MS-5 / E2/E7 | — |
| 18 | Unauthorized / cross-portal access states | cross-cutting / E1 | — |

## Source map

> UX = `.docs/03. BUILDING_SUIT_UX_SPEC.md`. PRD = `.docs/01.BUILDING_SUIT_PRD.md`. Impl = `.docs/08.BUILDING_SUIT_IMPLEMENTATION_PLAN.md`. DS = `prototype/.design-system-control/` manifest/catalogue + `design-tokens.json` + dedicated UI/visual-identity guides.

| Screen family | UX sources | PRD sources | Impl IDs | Reused design-system components | Visual-language rules |
|---|---|---|---|---|---|
| **Login** | §1.1; §2.2–2.3 (+ Authentication presentation behavior); §3.1; §4.1–4.2; §4.7–4.8; §4.10; §5.4 | §3.1; E1-US1 | MS-1; FEAT-104, FEAT-105 | Vue `AuthScreen`, `AuthHero`, `BrandMark`, `ViewSwitchers`, `FloatingField`, `AppButton`, `AuthIcon`, `GoogleMark`, `StatusLine` | Auth hero; foreground panel overlaps hero; one primary action; one gold focal point; language and color-mode switchers; labels float to the top of focused or filled inputs; Google button uses the actual Google mark |
| Registration & verification | §1.2; §2.2–2.3; §3.1; §4.1–4.2; §4.7–4.8 | §3.1; E1-US1 | MS-1; FEAT-104 | Vue auth hero, floating input fields (name/phone/email/password/confirm), checkbox/terms, primary button, Google button, `StepTrack`, `OtpRow`, `StatusLine` | Single continuous scrollable form card; Optional label beside Email; sequenced two-step verify with visible step indicators |
| Password recovery & reset | §1.3; §2.3; §3.1; §4.2 | §3.1 | MS-1; FEAT-104 | Vue auth hero, floating input field, primary/ghost button, `StatusLine` | Reduced card (copy + one field + reset action); transition to reset route, no in-place modal |
| Authenticated shell (header, side menu, bottom nav) | §2.2; §2.10; §4.11 | E1; §3.1 (explore) | MS-2; FEAT-202, TASK-0208 | App bar, Bottom navigation, Side-menu drawer, Modal/scrim, Toast | Side-menu transform (shift 60%, scale 85%, 40px corners, lateral shadow, 0.5px blur, ~400/500ms); 5 primary tabs; building selector lives only in menu; reduced-motion keeps animation (§4.11.8) |
| Empty State / Welcome & building context | §2.2; §2.4; §3.3 | E2; §3.1 (explore) | MS-2; FEAT-202, TASK-0208 | Building card, Primary/secondary button, Empty-state illustration, Card | Calm empty state; Create / Join / Explore CTAs; window-grid/building motif; one gold CTA |
| Create Building wizard | §2.4; §3.3; §4.3 | E2-US1; §3.2 | MS-2; FEAT-201, TASK-0201/0202 | Card (accordion phases), Input fields, Select, Map/location control, Modal (nearby conflict), Primary button, summary pills | Four-phase accordion workspace; completed phases collapse to summary pills with Edit; focused back nav, no bottom tab bar |
| Join Building | §2.4; §3.3; §4.3 | E2-US2 | MS-2; FEAT-203, TASK-0203 | Scanner hero (decorative), Bottom-sheet drawer, Input (join code), Select (unit), Chip/segmented (owner/tenant), Primary button | Scanner-first page; dimmed building image + Premium Gold (`#D89B42`) scanning corners + pulsing line (palette-only — resolves D-04); draggable bottom drawer with spring ~500ms settle; scanner does not activate camera |
| Home dashboard (+ Units, Members, approvals) | §2.5; §3.2; §4.11 | E2-US3; §3.x | MS-2; FEAT-202..205 | App bar, Card, Building card, Payment/badge summaries, Tabs (Units/Members), Search/Input, Badge, Quick-action buttons, Drawer (approvals), Modal (member action), Announcement card | Two-stage scroll handoff (150px), pinned sheet at 160px, hero items interpolated; quick actions; Notice Board (urgent first); one gold focal point |
| Building Settings (general, join code, billing) | §2.4 (admin flow); §3.4; §4.3–4.4 | E2; E3-US5; §3.2 | MS-2/MS-3; FEAT-301, TASK-0205 | App bar, Card, Input, Select, Badge, Primary/ghost button, Modal (create/edit/delete billing, regenerate join code) | Admin-only; missing-billing CTA blocks only configuration-dependent finance; confirmations for destructive actions |
| Finance dashboard (+ confirmation modals) | §2.6; §3.5; §4.4; §4.7–4.8 | E3-US1..US5; §3.x | MS-3; FEAT-301..306 | App bar, Balance hero (Display), Payment card, Card, Tabs (Payment/Expense drawer), Modal (record payment/expense/withdrawal/charge/recurring), Badge, Primary button | Total-balance circle in topological hero; 56px scroll collapse to compact header; confirmation modals for all ledger effects; subscription restriction banner; finance amounts semantic, never gold |
| Ledger & Unit Financial History | §2.6; §3.6; §4.4 | E3-US3 | MS-3; FEAT-304, TASK-0304 | App bar, Filter chips/select, Payment card / ledger rows, Skeletons, Badge, Export button, Empty state | Deep scrollable filterable pages; preserve filter+scroll on detail; export action from current context; prior-resident privacy |
| Manual payment instructions | §2.6 (owner/tenant flow); §3.5 | E3-US2; §3.x | MS-3; FEAT-303 | Card, Badge, Ghost button, Toast | Owner/tenant view; clear currency formatting; no live collection |
| Community — Support (announcements, issues) | §2.7; §3.7; §4.5; §4.9 | E6-US1/2/3; §5.7 | MS-4; FEAT-401..403 | Segmented control (Support/Governance), Announcement card (snapping), Tabs (Active/Closed/Action Required), Issue card, Filter chips, Modal (create issue/announcement), Drawer (issue detail), Badge, Toast | Announcements first; horizontally snapping cards; Active Ledger issue panel pins ~80px then inner-scrolls; fixed Create Issue button above bottom nav uses the canonical primary action (Building Navy `#16293B` light / Premium Gold `#D89B42` dark); section identity stays navy/gold (resolves D-04/D-05) |
| Community — Governance (votes, elections) | §2.7; §3.8; §4.5; §4.9 | E5-US1/2/3; §5.6 | MS-4; FEAT-404..406 | Voting card, Filter pills (Active/Pending/Closed), Progress bars, Drawer (create vote / vote detail / activity), Badge, Primary button | Activation summary; horizontally scrolling filter pills; create/detail as drawers; section identity stays navy/gold — Amber Alert (`#E1841F`) reserved for status only, never as a section accent (resolves D-05) |
| Services & provider profile | §2.8; §3.9; §4.6 | E7-US1/2; §5.8 | MS-5; FEAT-503, FEAT-504 | Two-option control (Browse/My Provider), Search/Input, Category chips, Provider card, Modal (provider detail / create / edit service), External-contact buttons, Empty state | Browse vs My Provider without route nav; provider cards with category color, avatar, contact actions; detail in modal to preserve results; default must not expose exact location |
| Notifications (popover + timeline) | §2.9; §3.11; §4.11 | E6-US4; §5.7 | MS-5; FEAT-502, TASK-0502 | Anchored popover (~340×420 on mobile), Card (notification item), Pinned Important Broadcast card, Skeletons, Empty state | Popover preserves page behind light backdrop; See All dismisses popover then opens timeline; grouped by date; display-only items |
| Profile, preferences & security | §2.9; §3.10; §4.2; §4.9 | E2; E7; §3.1 | MS-5; FEAT-505, TASK-0505 | App bar/identity hero, Account sheet (Card), Building cards (horizontal), Modal (edit profile / security / leave building / logout confirm), Toggle (fingerprint), Select (language/appearance), Ghost/destructive button | Identity hero ~310→130px scroll collapse; account sheet pins ~130px; fingerprint toggle only when supported; logout confirmation |
| Unauthorized / cross-portal access states | §2.1; §3.12; §4.8 | E1-US2/US3 | MS-1; FEAT-102, FEAT-103 | Empty/restricted state, Card, Ghost button, blocking resolution state | Blocking session+profile resolution; 403 vs 404 over content; safe return action; no protected content before permission resolution |

## Cross-cutting requirements (every screen)

| Concern | Rule | Source |
|---|---|---|
| Viewport | 390 × 844 mobile base; larger viewports preserve proportional hierarchy and stop relationships | UX §4.11.7; CLAUDE.md |
| Theme | Light + dark; primary action flips Navy→Gold | Tokens `color.role`; light/dark mode guides |
| Direction | English LTR + Arabic RTL; mirror directional icons; logo artwork never flips | UX §4.10; Typography RTL rules |
| Motion | 120–200ms ease; reduced-motion supported (shell/hero/scroll motion still active per UX §4.11.8) | Component guide; UX §4.11.8 |
| Targets/focus | 44×44dp min targets; 2px Premium Gold focus ring (offset) | Component guide; UX §4.1 |
| Validation | Format on blur after interaction; cross-field/permission on submit; server authoritative | UX §4.1–4.6 |
| Fixtures | Fixtures only — no real auth, OAuth, biometrics, APIs, Supabase, persistence | CLAUDE.md; workflow §9.1 |
| Evidence | Vue/Vite prototype is evidence only, never production architecture | CLAUDE.md |

## Resolved / open items (see discrepancy log)

- **D-04 (resolved)** — UX (§2.4, §2.7) called for a non-palette accent. Mapped palette-only: Join scanner corners → Premium Gold `#D89B42`; Support Create Issue button → primary action (Building Navy `#16293B` light / Premium Gold `#D89B42` dark). Nothing added to the palette.
- **D-05 (resolved)** — Support and Governance keep navy/gold section identity. Amber Alert (`#E1841F`) and all semantic colors stay status-only, never section decoration, preserving "one gold focus per view."
- **D-06 (open)** — Accessibility conformance standard and supported assistive tech are explicitly unresolved (UX §4.10.8); no conformance claim may be made. Working contrast bar = WCAG AA from the mode guides.
