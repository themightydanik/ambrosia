# Asset manifest — future generation, not generated files

Owner-approved `character-v1` and its reference sheet are prerequisites for all character assets. Every deliverable below is **planned / blocked on O2**, including promotional work. No placeholder artwork is presented as final in this PR. Tokens/layout and localized copy remain separate from image files.

## Inventory

### Transparent character cutouts (11)

Master: 2048×2048 RGBA PNG, 1:1, true alpha. Entire character including tail/fin/paddles inside central 80% width/height; at least 10% transparent margin on each side. Export composition variants only after the canonical body is approved.

| ID / filename stem | State | Primary placement / intended display |
| --- | --- | --- |
| `chr-neutral` | Neutral | Identity reference, small hero 80–112 px |
| `chr-welcome` | Welcoming | Onboarding/auth 128–240 px |
| `chr-happy` | Happy | Optional completed task accent, 64–96 px |
| `chr-encourage` | Encouraging | Check-in introduction/support, 64–112 px |
| `chr-thoughtful` | Thoughtful | Insight explanation, 80–128 px |
| `chr-listen` | Listening | Companion intro, 112–144 px |
| `chr-support` | Concerned/supportive | Recoverable error or difficult-day support, 64–96 px |
| `chr-sleep` | Sleepy | Sleep-dimension explanation, 64–96 px |
| `chr-celebrate` | Celebrating | Optional save milestone, never health-score reward, 64–96 px |
| `chr-explain` | Explaining | Context or Premium explanation, 96–128 px |
| `chr-empty` | Empty-state reaction | Curiosity/availability, 96–144 px |

A cutout may be reused in several screens; each empty composition does not need a new anatomical variant. Optional shadows are separate alpha layers, not opaque rectangles. Do not add clothing/accessories later to solve a crop problem.

### Composed illustrations (10 app scenes)

| ID | Scene | Master / aspect | Safe composition |
| --- | --- | --- | --- |
| `ill-onboard-01` | Ordinary day: four simple observation tokens around a welcoming character | 1600×1200, 4:3 | Center 80%; no chart/medical measurement implied; bottom 15% quiet |
| `ill-onboard-02` | A symptom note joining a dated recovery trail | 1600×1200, 4:3 | No inferred recovery trophy; no competitor timeline screenshot |
| `ill-onboard-03` | A user-selected bundle of records offered for reflection | 1600×1200, 4:3 | No data beam to a server until text explains consent; no medical verdict |
| `ill-auth-welcome` | Welcome beside two clearly optional pathways | 1600×1200, 4:3 | No Google logo in generated artwork; real provider button remains DOM |
| `ill-companion-intro` | Listening character with abstract selected-source tiles | 1600×1000, 8:5 | Empty tiles, not fake AI results or source citations |
| `ill-premium` | More longitudinal perspective, explanatory pose | 1600×1000, 8:5 | No price, trial, savings, checkout UI or superiority badge |
| `ill-empty-history` | A first dated page waiting to be used | 1200×900, 4:3 | No fabricated stored observations |
| `ill-empty-insights` | A few observation marks with visible spaces | 1200×900, 4:3 | Do not imply completing missing days is obligatory |
| `ill-empty-episodes` | An unstarted grouping ribbon | 1200×900, 4:3 | No hospital/clinical outcome iconography |
| `ill-empty-chat` | Listening character with an empty conversation area | 1200×900, 4:3 | No invented replies, clinician avatar or always-on monitoring |

Produce **layered scene masters**: character cutout, abstract background/props, composition guides. Export 4:3 and 8:5 scenes as a light/dark-compatible alpha scene where feasible; if an opaque backdrop is necessary, export explicitly named light and dark versions with the **same canonical character**. These theme adaptations are not alternate character identities. Keep image text-free; all real headings, numbers, buttons and source labels are live UI.

### Google Play visual campaign (planned 6 portrait panels)

Master 2160×3840; delivery target 1080×1920, 9:16 PNG/JPEG. Six panels: 01 daily check-in, 02 quick symptoms, 03 history/recorded-day insights, 04 explicit recovery episodes, 05 inspectable Companion context, 06 truthful Premium benefits. Compose from **implemented, verified future screens with synthetic records**, not these specifications rendered as fake functionality. Recheck current Play Console image requirements before upload.

Reserve top 22% for localized headline and bottom 8% for safe breathing room; actual device UI occupies the middle 60–70% without cropping essential controls. Keep all important content ≥6% from outer edges. Character accents do not occlude store prices, consent or an actual UI limitation. No unauthorized testimonials, ratings, clinician logos, awards or trial/discount claims. EN/UK/RU text/layout exports are separate and reviewed, not machine-baked into generated scenes.

Future launcher icon: 1024×1024 master and Android adaptive foreground/background layers, only after icon-legibility/owner approval. A simplified approved silhouette may be derived; do not shrink a full onboarding scene. Feature graphic: 1024×500 composed master/delivery, with essential wordmark/character inside central 80%; verify current Console cropping. These are optional follow-on listing assets, not a listing uploaded by this task.

## Naming, optimization and ownership

Proposed future path: `assets/brand/character-v1/`. Naming: `{id}__character-v1__{view-or-theme}__{width}.{ext}`, e.g. `chr-listen__character-v1__three-quarter__512.webp`. Scene IDs are stable across localized copy; locale suffix only for assembled promotional panels. New canonical identity = new version directory and explicit replacement plan, never silent overwriting.

- Keep layered/source masters out of the runtime bundle; retain owner-accessible source files and generation provenance/license review.
- Cutout deliveries: 256/512/1024 px WebP alpha plus PNG master/fallback if platform testing requires it. No JPEG for alpha. Avoid AVIF as the only native format until target WebViews are tested.
- Proposed optimized budget: ≤120 KB per 512 px cutout, ≤250 KB per app scene at chosen delivery size; first-view illustration payload ≤350 KB total. These are acceptance budgets, not measured current files. Compare visual quality before forcing compression.
- Declare width/height/aspect ratio to prevent layout shifts. Decode only the visible scene; lazy-load later scenes; do not precache all masters/poses into the service-worker shell.
- Alpha QA: light/dark checkerboard, no white/black halo, no clipped tail/wing/feet, no solid background hidden in a PNG. Keep small details ≥2 display pixels at the smallest intended size.
- Each approved asset record stores ID/version, canonical reference, generation/edit history, rights/provenance, dimensions, alpha/theme, display slot, optimized byte size and owner approval date. Raw image metadata must not contain private prompts, credentials or health information.
- Decorative mascot: empty alt text/`aria-hidden`; meaningful illustration: short localized description, with all functional meaning also in text. State changes are announced by UI, not image alt churn.
- No character animation is required for release. If later approved, use short, non-looping, reduced-motion-safe sequences under a separately measured budget; no GIF as the default deliverable.

## Approval checklist per batch

Confirm identity/anatomy/palette, adult emotional tone, silhouette at 48 px, scenario accuracy, alpha/crop, both themes, no embedded UI text, localization-safe zones, optimized quality/weight, ownership/license, and correctly labeled actual-vs-concept screen content. A beautiful image that fails identity or clinical-trust boundaries is rejected.
