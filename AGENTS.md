# Ambrosia — instructions for coding agents

Read [PROJECT_STATUS.md](PROJECT_STATUS.md) first. Then inspect current code, GitHub PRs and tests. A merged PR does **not** establish visual or Android QA.

## Goal
Finish Ambrosia 3.0: a distinctive, premium-feeling, trustworthy mobile-first wellness/symptom journal with Ari, without sacrificing offline data integrity, accessibility, privacy, or existing functional contracts.

## Source hierarchy
1. Current `main` code and reproducible tests establish **implemented behavior**.
2. [PROJECT_STATUS.md](PROJECT_STATUS.md) records the handoff and open problems.
3. `docs/ambrosia-3/`: `PRODUCT_VISION.md`, `SCREEN_SPECIFICATIONS.md`, `DESIGN_SYSTEM.md`, `ACCEPTANCE_CRITERIA.md`, `IMPLEMENTATION_ROADMAP.md`, `ASSET_MANIFEST.md` describe design and intended work; some still say "future/proposed" and may be stale.
4. Actual Ari PNGs in `assets/brand/ari/v1/illustrations/` and asset helpers `js/ui/ari-assets.js`, `js/ui/illustration.js`.
5. Owner-approved mockups **only after their exact files are provided/committed**. Conversation-generated mockups are not yet verified in GitHub and may show unimplemented features or fictional prices.

## Stack and scope
Vanilla JS/HTML/CSS, Netlify functions, Supabase, Capacitor Android. Screens: Home, Check-in, Add Symptom (`log`), History/Insights/Episodes, Companion, Settings, Premium, onboarding/account. Relevant modules under `js/screens/`, `js/companion/`, `css/product.css`, `css/design-system.css`.

Preserve record IDs, account separation, offline/sync/conflict semantics, local dates, 1–5 check-in scales, 1–10 symptom intensity, existing subscription enforcement, AI consent/context/quota and auth/PKCE flags. Never invent clinical conclusions, wellness scores, fake user data, backend features or prices. Google sign-in and billing-policy changes require separate authorization and tests.

## Visual identity
Approved expressive iris #5737D6, aqua #65E0C1, apricot #FFB85C, ink #202039; Nunito Sans, high-quality rounded surfaces, restrained legible glows, SVG icons and contextual illustration. Reconcile real CSS tokens with docs before adding styles.

**Ari is canonical:** purple lantern gecko, amber eyes, apricot muzzle/belly, golden markings, exactly FOUR legs, long turquoise-banded curled tail ending in a glowing golden leaf. Do not redraw or substitute a lookalike. Use approved Ari art for suitable introductions and empty states, not indiscriminately. Avoid infinite movement and motion during typing.

The owner requested **final UI in this approved style**, not alternate concepts. Recent generated phone-screen boards cover Home, Check-in, Add Symptom, History, Companion, Settings/Premium, but are design references, **not implemented app screenshots**. Their exact image files are not confirmed in the repository; request/commit them before fidelity work. They may differ from real features. Never implement invented data fields or fake offers just to match a picture.

## Critical current issues
A real phone-browser screenshot showed Companion scrolling inaccessible, legacy-looking bottom nav, cluttered controls and no visible Ari in an existing empty chat. Merged PR #34 attempted a fix, but **real-device verification remains open**. Fix mobile scroll/keyboard/safe areas, shared nav and first-use flow before decorative work. Inspect the whole scrollable screen, not just the first viewport.

## Working rules
- Small focused branches and **Draft PRs**; owner approves merges/deploys/releases.
- State exact files and behaviors changed, tests **actually** run, unverified items and rollback risk.
- Check 320/375/390/430px, light/dark, EN/UK/RU, offline/empty/filled, keyboard, TalkBack, large text and Android insets.
- Do not bundle auth/billing or data migrations with styling.
- Preserve meaningful DOM text, accessibility, focus, consent, and functional buttons.
- Never commit secrets or real health records; use synthetic fixtures.
- Update `PROJECT_STATUS.md` with evidence. Distinguish "merged" from "verified".

**Start with P0 items in [PROJECT_STATUS.md](PROJECT_STATUS.md).**
