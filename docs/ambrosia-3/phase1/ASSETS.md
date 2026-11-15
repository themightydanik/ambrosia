# Ari PNG inventory and payload

PNG-only owner requirement overrides the blueprint format/optimization suggestions for this phase. All 23 assets were downloaded from the two approved releases; filenames, decoded dimensions/alpha and published GitHub SHA-256 digests were validated. **No PNG was resized, recompressed, converted, repainted or replaced.** SHA-256 equality confirms byte-for-byte preservation.

Sources: [Ari canonical pack](https://github.com/themightydanik/ambrosia/releases/tag/ari-assets-v1.0.0), [approved illustrations](https://github.com/themightydanik/ambrosia/releases/tag/ari-illustrations-v1.0.0). Complete paths, 64-digit hashes, asset IDs, release URLs and alpha extrema are in [inventory.json](../../../source-assets/ari/v1/inventory.json).

## Files

| PNG | Original dimensions | Bytes | Transparency | Packaging |
| --- | --- | ---: | --- | --- |
| [ari-celebrate.png](../../../source-assets/ari/v1/characters/ari-celebrate.png) | 1254×1254 | 375,783 | RGBA; alpha 0–253 | Source only; excluded |
| [ari-explain.png](../../../source-assets/ari/v1/characters/ari-explain.png) | 1254×1254 | 1,314,410 | RGBA; alpha 0–255 | Source only; excluded |
| [ari-happy.png](../../../source-assets/ari/v1/characters/ari-happy.png) | 1254×1254 | 1,594,562 | RGBA; alpha 0–255 | Source only; excluded |
| [ari-listening.png](../../../source-assets/ari/v1/characters/ari-listening.png) | 1254×1254 | 1,202,823 | RGBA; alpha 0–255 | Source only; excluded |
| [ari-neutral.png](../../../source-assets/ari/v1/characters/ari-neutral.png) | 1254×1254 | 1,322,587 | RGBA; alpha 0–255 | Source only; excluded |
| [ari-relax.png](../../../source-assets/ari/v1/characters/ari-relax.png) | 1536×1024 | 1,994,948 | RGBA; alpha 0–254 | Source only; excluded |
| [ari-sleepy.png](../../../source-assets/ari/v1/characters/ari-sleepy.png) | 1254×1254 | 1,018,187 | RGBA; alpha 0–255 | Source only; excluded |
| [ari-supportive.png](../../../source-assets/ari/v1/characters/ari-supportive.png) | 1254×1254 | 387,868 | RGBA; alpha 0–253 | Source only; excluded |
| [ari-surprised.png](../../../source-assets/ari/v1/characters/ari-surprised.png) | 1254×1254 | 347,775 | RGBA; alpha 0–253 | Source only; excluded |
| [ari-thoughtful.png](../../../source-assets/ari/v1/characters/ari-thoughtful.png) | 1254×1254 | 382,367 | RGBA; alpha 0–253 | Source only; excluded |
| [ari-welcome.png](../../../source-assets/ari/v1/characters/ari-welcome.png) | 1254×1254 | 409,599 | RGBA; alpha 0–253 | Source only; excluded |
| [Ari.-.reference.png](../../../source-assets/ari/v1/references/Ari.-.reference.png) | 1254×1254 | 1,820,514 | RGB; opaque reference | Source only; excluded |
| [Character.Sheet.v1.png](../../../source-assets/ari/v1/references/Character.Sheet.v1.png) | 1536×1024 | 1,816,864 | RGB; opaque reference | Source only; excluded |
| [ill-auth-welcome.png](../../../assets/brand/ari/v1/illustrations/ill-auth-welcome.png) | 1448×1086 | 474,994 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-companion-intro.png](../../../assets/brand/ari/v1/illustrations/ill-companion-intro.png) | 1586×992 | 417,310 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-empty-chat.png](../../../assets/brand/ari/v1/illustrations/ill-empty-chat.png) | 1448×1086 | 354,483 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-empty-episodes.png](../../../assets/brand/ari/v1/illustrations/ill-empty-episodes.png) | 1448×1086 | 358,697 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-empty-history.png](../../../assets/brand/ari/v1/illustrations/ill-empty-history.png) | 1448×1086 | 399,114 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-empty-insights.png](../../../assets/brand/ari/v1/illustrations/ill-empty-insights.png) | 1448×1086 | 333,512 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-onboard-01.png](../../../assets/brand/ari/v1/illustrations/ill-onboard-01.png) | 1448×1086 | 1,740,070 | RGBA; alpha 0–255 | Runtime illustration |
| [ill-onboard-02.png](../../../assets/brand/ari/v1/illustrations/ill-onboard-02.png) | 1448×1086 | 407,867 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-onboard-03.png](../../../assets/brand/ari/v1/illustrations/ill-onboard-03.png) | 1448×1086 | 414,901 | RGBA; alpha 0–253 | Runtime illustration |
| [ill-premium.png](../../../assets/brand/ari/v1/illustrations/ill-premium.png) | 1586×992 | 410,666 | RGBA; alpha 0–253 | Runtime illustration |

## Exact raw byte budgets

- All 23 original PNGs in the repository: **19,299,901 bytes** (18.41 MiB).
- Runtime: 10 illustrated scenes, **5,311,614 bytes** (5.07 MiB). Four are used in this phase; six are registered for future consumers but not mounted on destination screens.
- Excluded source/reference archive: 11 unused poses + 2 opaque reference sheets, **13,988,287 bytes** (13.34 MiB). Kept under `source-assets/ari/v1/`; not copied into web/native runtime allowlists.
- The four onboarding/account scenes total **3,037,832 bytes**. Initial scene alone: **1,740,070 bytes**; all others are requested only when their screen is shown. Returning users do not instantiate/download an Ari scene.
- Self-hosted Nunito Sans variable WOFF2 subsets: **97,124 bytes**, with local OFL license. Unicode ranges load the relevant Latin/Cyrillic subsets; these font files are not PNG derivatives.
- `npm run build` static production application bundle: **5,796,874 bytes** (5.53 MiB), including original runtime PNGs, fonts, JS, CSS and service worker. This is the unpacked web output, not wire-compressed traffic or an Android APK/AAB size. Netlify functions and native platform code are separate.

## Loading and distribution

- Only the current illustration node exists. Visible onboarding/auth art uses eager/high priority; the reusable illustration component defaults to native lazy loading with asynchronous decoding, explicit original dimensions and `object-fit: contain` (no crop/filter). No next-scene or pose prefetch.
- All image meaning is conveyed by localized DOM copy. Art is decorative; an image failure hides the failed image and leaves real headings/navigation fully usable. Future consumers can use the six remaining registered scenes without altering their screens now.
- The service worker preloads code/styles only, not any PNG. It caches visited Ari images/fonts on demand once it controls the page. A first offline visit to an unseen scene can omit decoration; journal/offline controls continue. Native asset bundles contain all runtime images locally.
- `scripts/runtime-files.cjs` supplies the same explicit runtime copy list to production web and native asset preparation. `npm run build` produces `web-dist`; Netlify publishes it while keeping the existing function directory and redirects. `.vercelignore` also excludes source assets from uploads. No production deploy was performed.
- PNG quality is retained even where it exceeds the earlier proposed 250 KB scene budget. The first slide is substantially larger than the others. Future format/size changes require explicit owner approval; none is silently applied here.
