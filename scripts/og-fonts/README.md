# OG image fonts

Full (non-subset) static TTFs used **only at build time** to draw Open Graph
share images (`src/lib/og.ts`). Text is shaped with HarfBuzz (harfbuzzjs) and
rasterised by resvg as paths, so Bangla conjuncts and pre-base vowel signs are
correct.

| File | Source | Notes |
|---|---|---|
| AnekBangla-Bold.ttf / -Medium.ttf | google/fonts `ofl/anekbangla` | static instances `wdth=100, wght=700 / 500` (fontTools instancer); Hind Siliguri was dropped because its ১ renders badly |
| BalooDa2-ExtraBold.ttf | google/fonts `ofl/balooda2` | static instance `wght=800` (fontTools instancer) |
| AnekBangla-CondensedExtraBold.ttf | google/fonts `ofl/anekbangla` | static instance `wdth=75, wght=800` |

All are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org).

The site itself self-hosts subset WOFF2 files via Fontsource; the condensed
Anek stamp face in `public/fonts/` is the same `wdth=75, wght=800` instance
(47 KB for Bengali instead of 448 KB for the full variable font).
