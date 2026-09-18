# Logo Source Notes

Documents the origin, format, and handling of the master Building Suit logo files stored in this folder.

> **Naming convention:** the `dark` / `light` in each filename refers to the **colour of the logo itself**. The `dark` file is the dark (navy) logo, which is used on light backgrounds; the `light` file is the light (white/silver) logo, which is used on dark backgrounds.

## Current files
| File | Logo material | Use on | Dimensions | Mode |
|---|---|---|---|---|
| `building-suit-logo-dark.png` | Navy / dark body with gold windows | Light backgrounds | 920 × 1245 px | RGBA (transparent) |
| `building-suit-logo-light.png` | White / silver body with gold windows | Dark backgrounds | 920 × 1245 px | RGBA (transparent) |

Both variants share identical geometry: a 3D letter "B" rendered as a residential building, with stacked gold-lit windows, a slim side window, and a lit entrance door at the base. See `../../02-logo-system/01_LOGO_ANALYSIS.md` for the full analysis.

## Source
- Origin of the original artwork: _to be confirmed_ (designer / tool used).
- Imported into this project from `.docs/branding/01-logo-source/`.

## Known limitations
- **Raster only.** The masters are PNGs, so they do not scale cleanly to large print or shrink cleanly to small icon sizes.
- **No vector master.** There is no SVG/AI source for crisp scaling or single-colour reproduction.
- **3D, multi-tonal treatment.** Detail (windows, door, shading) muddies at favicon / small-UI sizes and does not survive single-colour print.

## Outstanding requests to the designer
- Vector / SVG master that matches the approved artwork exactly.
- A simplified, flat, single-colour companion mark for small and monochrome contexts.
- Confirmation of exact gold, navy, and silver colour values for the colour system.
- Transparent-background exports at additional sizes if needed for app icon / favicon.
