# Login — First Vertical Slice Brief

**Status:** Converted to the Vue/Vite auth prototype (2026-06-23). The old `login-direction-a.html` / `login-direction-b.html` outputs were removed during the framework migration; current evidence is `prototype/dist/index.html#login`, backed by shared Vue components in `prototype/src/components/`.
**Why Login first:** smallest self-contained, unauthenticated entry surface; exercises the auth hero/card pattern, core form components, theme toggle, light/dark, and RTL without requiring building context, finance, or shell. Establishes the composition language for all authentication screens (workflow §9).

## Exact sources (authority order)

| Authority | Source | Used for |
|---|---|---|
| 1. UX behavior/presentation | §1.1 (Authenticate journey); §2.2–2.3 incl. Authentication presentation behavior; §3.1 (Authentication Views); §4.1–4.2 (validation); §4.7–4.8 (success/error); §4.10 (language/RTL); §5.4 (session expiry) | Flow, layout, states, validation, RTL |
| 2. PRD scope/rules | §3.1 (Identity and Portal Profiles); E1-US1 acceptance criteria | What auth supports, what is in scope |
| 4. Canonical tokens | `07-design-tokens/design-tokens.json` | Exact colors, type, spacing, radius, shadow |
| 5. Final brand / UI guides | UI style guide §Form/§Modal; color/typography/visual-language guides | Component treatment, gold discipline |
| 6. Control records | `01_DESIGN_SYSTEM_MANIFEST.md`, `02_COMPONENT_CATALOGUE.md`, component lab | Reusable components, states |
| 7. Implementation | MS-1; FEAT-104 (auth flows), FEAT-105 (session storage/refresh/expiry) | Build placement, traceability |

## In scope for the Login slice

- The **Login** screen as the first auth surface. Registration, verification, password recovery/reset, and One Last Step now share the same Vue auth shell.
- Identifier (email **or** Egyptian phone) + password; password visibility toggle.
- Identifier and password use associated floating labels: label inside empty inactive field, floated to the top of the field on focus or filled.
- **Forgot Password** link beneath the password field.
- **Login** action and the **fingerprint affordance on the same action row** (affordance only; shown per eligibility rule).
- **Google** below a labeled divider.
- **Register** as a footer link below the card.
- Language and color-mode switchers at the safe-area edge.

## Authentication presentation contract (UX §2.3)

- Full-page auth layout with a **200px dark hero** (390×844 base), **40px curved lower corners**.
- Foreground **form card overlaps the hero by ~40px**, constrained to a narrow mobile reading width, **~30px corners**.
- Secondary navigation sits **below the card**, not inside the primary form action area.
- One dominant primary action; one intentional gold focal point (UI hierarchy rules).

## Required states (must all be demonstrated before approval)

| State | Definition | Source |
|---|---|---|
| Ideal | All fields/links/visibility toggle/primary action available; fingerprint affordance per eligibility; Google below divider; Register footer link | §3.1 |
| Invalid credentials | Stay on Login; actionable identifier/form error; password details not exposed | §1.1.4, §4.2, §4.8.1 |
| Processing | Primary action disabled + progress; duplicate submission prevented | §1.1.2.5, §3.1 |
| Network error | Keep entered input; show connection failure; offer retry; never report success | §4.8.6 |
| Fingerprint unavailable | Fingerprint not shown / failed / cancelled → normal password + Google fallback; identifier not cleared | §1.1.4, §3.1, §4.2 |
| Session expired (entry to Login) | Blocking session-expired message after failed transparent refresh | §4.8.2, §5.4 |
| Dark mode | Primary action becomes Premium Gold on Midnight; light/silver logo on dark hero | dark mode guide |
| Arabic RTL | Mirrored layout, right-aligned fields, mirrored directional affordances, logo artwork not flipped | §4.10; typography RTL |

## Validation contract (UX §4.1–4.2)

- **Login identifier:** valid email or valid Egyptian phone; validate on blur + submit; identifier-level error.
- **Login password:** required, meets current minimum; validate on submit; never expose password detail.
- Submit revalidates the whole form; server validation authoritative; focus moves to first invalid field; correcting a field clears its stale error.
- Primary action disabled only when required data is visibly incomplete, processing, or user known ineligible.

## Reused design-system components

Auth hero (App bar variant / dark hero panel), foreground panel, **Input field** (identifier, password) with associated floating labels plus focus + error states, password-visibility icon button using Hugeicons, **Primary button** (Login), **fingerprint affordance** (Hugeicons icon button), labeled divider, **Google secondary button** with the actual Google mark, **inline status** notice, language switcher, color-mode switcher, and 2px gold focus ring. All from `02_COMPONENT_CATALOGUE.md` / `prototype/src/components/` — no new tokens.

## Hard constraints (workflow §9.1)

- **Fixtures only.** No real authentication, OAuth, biometrics, APIs, Supabase, or persistence.
- No invented components or token changes; differences between explorations come from hierarchy, layout, density, motif placement, and interaction emphasis only.
- Avoid generic AI styling, decorative gradients, glassmorphism, excessive cards, arbitrary gold.
- Verification viewports at build time: 390×844 **light LTR, dark LTR, light RTL**.

## Build-stage note (not part of this planning task)

The current build artifact is the Vue route/hash target `prototype/dist/index.html#login`. Further exploration should happen by extending the shared Vue components rather than adding separate static login pages.

## Open items affecting auth screens

- **D-06** — accessibility conformance standard unresolved (UX §4.10.8); make no conformance claim on Login.
