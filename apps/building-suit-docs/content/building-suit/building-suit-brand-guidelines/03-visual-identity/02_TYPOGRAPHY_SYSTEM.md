# Typography System

> **Status:** Complete (initial). The typefaces and type scale for Building Suit, in English and Arabic. Supports the brand personality (clear, trustworthy, premium) and the bilingual, mobile-first product.

---

## English font recommendation
**Primary: Manrope.** A modern, geometric-humanist sans with a premium, slightly refined feel — confident without being cold. Excellent for headings and UI.

**Alternative: Inter.** Highly legible, neutral, superb at small UI sizes. Use Inter if maximum UI clarity is prioritized over Manrope's character.

> Recommendation: **Manrope for brand/marketing/headings, Inter acceptable for dense UI.** For simplicity, a single-family system using **Manrope** throughout is fully supported. Both are free (open-source) and have wide weight ranges.

---

## Arabic font recommendation
**Primary: IBM Plex Sans Arabic.** Pairs naturally with Latin sans faces, modern and trustworthy, with strong legibility and a premium tone — the recommended default.

**Alternatives:**
- **Cairo** — geometric, friendly, very common and well-supported; good for marketing.
- **Tajawal** — clean and contemporary; good for UI.

> Recommendation: **IBM Plex Sans Arabic** as the default Arabic family (best tonal match to Manrope/Inter). Use one Arabic family consistently across product and marketing. All three are free.

---

## Font fallback stack
**Latin / English**
```css
font-family: "Manrope", "Inter", -apple-system, BlinkMacSystemFont,
             "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```
**Arabic**
```css
font-family: "IBM Plex Sans Arabic", "Cairo", "Tajawal",
             "Segoe UI", Tahoma, Arial, sans-serif;
```
**Combined (auto by language/`lang`/`dir`)** — load both; apply the Arabic stack to `:lang(ar)` / `[dir="rtl"]`, the Latin stack otherwise. Numerals: prefer the same family for consistency; choose Western (1234) vs Eastern-Arabic (١٢٣٤) per locale settings and keep it consistent within a view.

- **Flutter:** bundle the fonts in `pubspec.yaml`; set `fontFamily` per locale; use `fontFamilyFallback` for the stack.
- Always self-host or bundle for offline reliability; don't depend on a CDN at runtime.

---

## Type scale principles
- Base body size **16px** (1rem). Scale uses a ~1.2–1.25 ratio.
- Sizes in the tables are starting values — keep the **ratio and hierarchy** consistent across platforms.
- Pair size with **weight and color**, not size alone, to build hierarchy.

## Mobile typography scale
(Primary platform — Flutter app. Sizes in logical px/dp.)

| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| Display | 32 / 40 | 800 (ExtraBold) | Splash, big numbers (balances) |
| H1 | 26 / 34 | 700 (Bold) | Screen titles |
| H2 | 22 / 30 | 700 | Section headers |
| H3 | 18 / 26 | 600 (SemiBold) | Card titles |
| Body L | 16 / 24 | 400/500 | Primary body |
| Body M | 14 / 22 | 400/500 | Default UI text |
| Caption | 12 / 18 | 500 | Labels, metadata |
| Overline | 11 / 16 | 600, +4% tracking, UPPERCASE | Eyebrows, tags |
| Button | 15 / 20 | 600 | Button labels |

## Website typography scale
| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| Hero | 56 / 64 | 800 | Marketing hero headline |
| H1 | 40 / 48 | 700 | Page titles |
| H2 | 32 / 40 | 700 | Section titles |
| H3 | 24 / 32 | 600 | Subsections |
| H4 | 20 / 28 | 600 | Card/feature titles |
| Body L | 18 / 28 | 400 | Lead paragraphs |
| Body | 16 / 26 | 400 | Body copy |
| Small | 14 / 22 | 400 | Captions, footnotes |

> Use clamp()/responsive scaling so the web scale steps down gracefully toward the mobile scale on small viewports.

## Marketing typography scale
(Decks, social, print — bigger, more expressive.)

| Token | Size (approx) | Weight | Use |
|---|---|---|---|
| Mega | 72–96 pt | 800 | Poster/cover statements |
| Headline | 48–64 pt | 700/800 | Slide titles, ad headlines |
| Subhead | 28–36 pt | 600 | Supporting lines |
| Body | 18–22 pt | 400/500 | Paragraphs |
| Caption | 12–14 pt | 500 | Legal, credits |

> Marketing may pair ExtraBold Manrope headlines with generous spacing and a single gold accent word for emphasis.

---

## Arabic RTL rules
- Set `dir="rtl"` (web) / `TextDirection.rtl` (Flutter) for Arabic; mirror layout, alignment, icons of direction, and logo *placement* (never the logo artwork).
- **Text aligns right**; lists, indents, and bullets flip.
- Arabic generally needs **slightly larger size and line height** than Latin for comfort — bump body line height by ~10–15%.
- Avoid ALL-CAPS and letter-spacing on Arabic (no concept of caps; tracking harms legibility). The "Overline" style is Latin-only.
- Don't fake bold/italic — use real font weights; avoid synthetic italics for Arabic.
- Keep the product name "Building Suit" in Latin even within Arabic text; ensure mixed Latin+Arabic and numerals render cleanly.
- Test diacritics and ligatures; leave vertical room so marks aren't clipped.

---

## Font weight rules
| Weight | Name | Use |
|---|---|---|
| 800 | ExtraBold | Display, hero, big balance numbers |
| 700 | Bold | H1–H2 headings |
| 600 | SemiBold | H3, buttons, labels, emphasis |
| 500 | Medium | UI text, captions, default emphasis |
| 400 | Regular | Body copy |

- Limit to **2–3 weights per layout** for a clean, premium feel.
- Use **weight + color** for hierarchy before reaching for size.
- Don't use Light/Thin weights for body or small UI (poor legibility, esp. Arabic).

## Line height rules
- **Headings:** tight, ~1.1–1.3× (large display can go ~1.05–1.15).
- **Body:** comfortable, ~1.5× (1.5–1.6 for long-form).
- **UI / dense:** ~1.3–1.4×.
- **Arabic:** add ~10–15% over the Latin equivalent.
- Keep line length **45–75 characters** for body for readability.

---

## Typography do/don't rules
| ✅ Do | ❌ Don't |
|---|---|
| Use Manrope/Inter (Latin) + IBM Plex Sans Arabic | Mix many unrelated fonts |
| Build hierarchy with size + weight + color | Use size alone, or 5+ sizes per screen |
| Keep 2–3 weights per layout | Use Thin/Light for body or small text |
| Give Arabic extra size/line-height | Apply caps/tracking to Arabic |
| Use real weights | Fake bold/italic |
| Keep 45–75 char line length | Run edge-to-edge long lines |
| Left-align Latin / right-align Arabic | Justify body (uneven spacing) |
| Self-host/bundle fonts | Rely on runtime CDN only |

---

## English sample text
> **Building Suit** — Clarity you can trust.
> See exactly where your building's money goes. Track charges, payments, and expenses on one transparent ledger — and make decisions together, fairly.
>
> *Unit 4B · Balance: EGP 0 · Last payment recorded today.*

(Shows Display/H-level headline, Body, and a finance caption with numerals.)

## Arabic sample text
> **Building Suit** — وضوحٌ يمكنك الوثوق به.
> اطّلع بدقّة على أوجه إنفاق أموال مبناك. سجّل الرسوم والمدفوعات والمصروفات في سجلٍّ واحد شفّاف — واتخذوا القرارات معًا بإنصاف.
>
> *الوحدة 4B · الرصيد: ٠ ج.م · تم تسجيل آخر دفعة اليوم.*

(RTL, right-aligned, product name kept in Latin, finance caption with locale numerals.)

`[Insert type specimen sheet — Latin]`
`[Insert type specimen sheet — Arabic]`
