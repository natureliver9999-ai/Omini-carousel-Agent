# Third-Party Notices & Font / Icon Licenses

## 1. Bundled Fonts (SIL Open Font License 1.1)

Fonts distributed in `core-engine/fonts/` (and fallback system DejaVu fonts) are licensed under permissive open font licenses:

- **Inter** — Copyright (c) The Inter Project Authors (`https://github.com/rsms/inter`), SIL Open Font License 1.1 (OFL-1.1).
- **Space Grotesk** — Copyright (c) Florian Karsten (`https://github.com/floriankarsten/space-grotesk`), SIL Open Font License 1.1 (OFL-1.1).
- **Instrument Serif** — Copyright (c) The Instrument Serif Project Authors (`https://github.com/Instrument/instrument-serif`), SIL Open Font License 1.1 (OFL-1.1).
- **JetBrains Mono** — Copyright (c) JetBrains s.r.o. (`https://github.com/JetBrains/JetBrainsMono`), SIL Open Font License 1.1 (OFL-1.1).
- **Caveat** — Copyright (c) Impallari Type (`https://github.com/impallari/Caveat`), SIL Open Font License 1.1 (OFL-1.1).

Full OFL-1.1 license text is included in `core-engine/fonts/OFL.txt`.

## 2. Vector Icons (ISC License)

Inline SVG icons in `core-engine/src/assets/lucide.ts` are adapted from **Lucide Icons** (`https://lucide.dev`):

> Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022. Licensed under the ISC License.

## 3. Optional Stock Asset Providers

When `UNSPLASH_ACCESS_KEY` or `PEXELS_API_KEY` is supplied by the user:
- Unsplash images remain subject to the [Unsplash License & API Guidelines](https://unsplash.com/documentation#guidelines-and-crediting). Photographer attribution and source links are automatically written into `attribution.json` inside every rendered bundle.
- Pexels images remain subject to the [Pexels License](https://www.pexels.com/license/). Photographer attribution is automatically recorded in `attribution.json`.
