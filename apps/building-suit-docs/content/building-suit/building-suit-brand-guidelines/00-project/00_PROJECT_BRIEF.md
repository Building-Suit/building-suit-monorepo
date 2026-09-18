# 00 — Project Brief

## Purpose
Produce a complete, consistent brand identity and guidelines system for **Building Suit** — a mobile-first operational control platform for self-managed residential buildings. The guidelines must be usable by designers, the Flutter mobile team, the web/marketing team, and external partners to apply the brand correctly and consistently.

## Background
Building Suit replaces fragmented coordination (messaging apps, paper records, informal cash handling, spreadsheets) with a transparent, unit-centered system for building finance, membership, issues, announcements, governance, and service-provider discovery. It is the first active portal in a wider hub-and-spoke ecosystem (with future Shop Suit, Business Suit, and City Suit portals on a shared platform core). The brand should feel transparent, trustworthy, calm, and structured, and must work bilingually (Arabic and English, including RTL).

## Starting point
The only existing brand asset is the logo, provided in two variants:
- `assets/logos/building-suit-logo-dark.png` — dark logo for light backgrounds.
- `assets/logos/building-suit-logo-light.png` — light logo for dark backgrounds.

All other brand elements (color, typography, visual language, UI system, marketing, tokens) are to be defined in this project, anchored to the existing logo.

## Objectives
1. Define the brand strategy (foundation, positioning, voice, audience).
2. Build a complete logo system (analysis, usage, clear space, do's/don'ts, app icon).
3. Define the visual identity (color, typography, visual language, layout, iconography, imagery).
4. Define a UI system (style guide, components, dark/light modes) aligned to the mobile-first product.
5. Define marketing applications (social, website hero, business card, presentations).
6. Produce machine-usable design tokens (CSS, Tailwind, Flutter, JSON).
7. Assemble and export a final, shareable brand guidelines document (web + PDF).

## Scope
- **In scope:** everything required to define and document the Building Suit brand and hand it off to product and marketing teams.
- **Out of scope:** rebranding the wider ecosystem portals (Shop/Business/City Suit) and building the production design system in code — though tokens here should be compatible with that future work.

## Deliverables
- Strategy, logo, visual-identity, UI, and marketing documentation (sections `01`–`05`).
- Claude Design source pack, board + guidelines prompts, refinement prompts, export checklist, and review notes (section `06`).
- Design tokens (section `07`).
- Final consolidated guidelines and exported PDF (section `08` + `exports/`).

## Stakeholders
- Brand / design owner (this project).
- Flutter mobile team (primary product surface, consumes `flutter_colors.dart`).
- Web & marketing team (consumes `colors.css` / `tailwind.colors.js`).
- Founders / product leadership (approval).
