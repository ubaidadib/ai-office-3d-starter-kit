# Third-party assets

All 3D assets are **CC0 1.0 (public domain)**: free for personal,
educational and commercial use, with no attribution required. We credit
the author anyway. Each pack's original `License.txt` is kept beside the
files.

| Pack | Author / source | Licence | Version (from License.txt) | Downloaded | Original zip SHA-256 | Used files |
| --- | --- | --- | --- | --- | --- | --- |
| Furniture Kit | Kenney — https://kenney.nl/assets/furniture-kit | CC0 1.0 | 2.0 | 2026-11-23, free download ("continue without donating") | `e67652d0932cee41683f74711c03d3e192a2af9979ef8e6b237711f5482d46b0` | `public/vendor/kenney-furniture-kit/models/*.glb` (140 GLB kept unchanged; 44 used via the derived pack below) · `License.txt` |
| Mini Characters | Kenney — https://kenney.nl/assets/mini-characters | CC0 1.0 | 2.0 | 2026-11-23, free download | `add348e98ab9e23d9973c4740ef2c5cceb229c742106aca2d56b30a8f1241bb7` | `public/vendor/kenney-mini-characters/models/character-{female,male}-*.glb`, `Textures/colormap.png` · `License.txt` · `Preview.png` |

No paid tiers, accounts or Patreon content were used.

## Derived file

| File | Made from | Licence | SHA-256 |
| --- | --- | --- | --- |
| `public/vendor/derived/office-furniture.glb` (475,644 bytes) | 44 Kenney Furniture Kit models, merged by `tools/build-furniture-pack.py` (one buffer, 14 shared materials, unlit flag removed so furniture can be lit) | CC0 1.0 (inherits the source licence) | `119a6c4de531df5fe628fe23fa0315281fe485ba94ded421d83548b6116ae28d` |

`office-furniture.manifest.json` records the SHA-256 of every source model.
`tests/pack.test.ts` re-checks the sources and the output on every test run.
To rebuild it: `python3 tools/build-furniture-pack.py`.

Licence text: http://creativecommons.org/publicdomain/zero/1.0/

## Fonts

| File | Licence | Copyright (from the font file) | Licence text |
| --- | --- | --- | --- |
| `public/brand/fonts/Inter.ttf` (Inter 4.001) | SIL Open Font License 1.1 | The Inter Project Authors — https://github.com/rsms/inter | `public/brand/fonts/Inter-OFL.txt` |
| `public/brand/fonts/Cairo.ttf` (Cairo 3.130) | SIL Open Font License 1.1 | The Cairo Project Authors — https://github.com/Gue3bara/Cairo | `public/brand/fonts/Cairo-OFL.txt` |

The fonts are unmodified. The licence files sit in `public/brand/fonts/`, so they are copied into every build (`dist/`) as well.

## Placeholder logo

`public/brand/logo.svg` and `public/brand/mark.svg` were drawn for this kit as neutral placeholders ("YOUR LOGO").
They are covered by the kit's MIT licence. Replace them with your own logo.
