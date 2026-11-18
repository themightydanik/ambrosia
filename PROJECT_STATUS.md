# Ambrosia 3.0 — AI handoff / current status

Updated **2026-11-19** from repository `main` tree, merged PR metadata and owner feedback. This is **not** a production/Android/CI audit. Recheck when taking over.

## North star
Complete Ambrosia 3.0 as a cohesive, exceptionally polished, accessible wellness/symptom journal with approved Ari artwork. The owner prioritizes genuine visual quality over superficial CSS-only decoration, while requiring real mobile usability and honest health-data presentation.

## Confirmed repository structure
- Vanilla HTML/JS/CSS, Netlify, Supabase, Capacitor Android.
- `index.html`, `css/product.css`, `css/design-system.css`.
- `js/screens/{home,checkin,log,history,episode,ai,settings,upgrade,onboarding}.js`, `js/companion/{ui,store}.js`.
- `.github/workflows/android-internal.yml`, `.github/workflows/sync-tests.yml`.
- Existing approved Ari scenes in `assets/brand/ari/v1/illustrations/`: `ill-auth-welcome.png`, `ill-companion-intro.png`, `ill-empty-chat.png`, `ill-empty-episodes.png`, `ill-empty-history.png`, `ill-empty-insights.png`, `ill-onboard-01.png`, `ill-onboard-02.png`, `ill-onboard-03.png`, `ill-premium.png`. Verify actual usage, quality and optimized sizes.

## Merged PRs (code merged ≠ visually verified)
| PR | Change | Status |
| --- | --- | --- |
| #29 | Companion styling, approved Ari artwork, report UI | Merged; mobile QA unverified |
| #30 | Home v2 with Ari and luminous cards | Merged; mobile QA unverified |
| #31 | Check-in and Add Symptom styling | Merged; mobile QA unverified |
| #32 | Premium Ari, History/Insights/Episodes empty art | Merged; mobile QA unverified |
| #33 | Settings/profile styling | Merged; mobile QA unverified |
| #34 | Attempted mobile scroll, bottom navigation and Companion hierarchy fixes | Merged; **retest on phone** |

This is not a full feature inventory. Inspect earlier PRs and code before making claims about auth, billing, sync or feature completion.

## Real user feedback / defects
- On a phone browser the AI Companion screen could not scroll, so lower controls were unreachable.
- Bottom navigation looked like a leftover from the old UI.
- Companion showed too many technical controls (account notices, rename/delete, context, prompts) instead of a clear start-chat experience; Ari was not visible in the active empty conversation.
- PR #34 was merged after this report; **there is no confirmed post-fix real-phone screenshot or functional result**.
- Earlier visual PRs were merged without comprehensive real-screen verification; the app is **not yet visually release-approved**.

## Approved art direction and design boards
- Source specs: `docs/ambrosia-3/{PRODUCT_VISION,DESIGN_SYSTEM,SCREEN_SPECIFICATIONS,ACCEPTANCE_CRITERIA,IMPLEMENTATION_ROADMAP,ASSET_MANIFEST}.md`.
- Palette: iris #5737D6, aqua #65E0C1, apricot #FFB85C, ink #202039; Nunito Sans; premium, expressive but readable.
- Canonical Ari: purple gecko, exactly four legs, amber eyes, apricot muzzle/belly, golden markings, turquoise-banded curled tail with luminous golden leaf. Never redesign.
- Recent conversation produced visual boards in the **already approved style**, not competing concepts: Home (scrolled states + empty), Check-in, Add Symptom, History/Insights/entry detail, Companion (intro/chat/context/history), Settings/Profile/Premium/About.
- **Important:** the exact generated boards have NOT been verified as repository files. Obtain them from the owner and commit as clearly labeled `design-reference` images. They are not screenshots of implemented UI; may include unsupported extra fields, prices, steps or metrics. Confirm function/spec discrepancies with owner before coding.
- Existing specs propose four bottom tabs without central plus, but current implementation has central Add shortcut. This requires explicit decision, not a silent navigation rewrite.

## Work queue

### P0 — unblock real mobile usability
- [ ] Reproduce/verify Companion scrolling after #34 on a real Android browser, including long chat, context, reports and keyboard open/close.
- [ ] Verify shared bottom navigation on every screen, including icon consistency, active states, touch areas and overlap.
- [ ] Capture real 320/375/390/430px screenshots in light/dark, EN/UK/RU, empty/filled and unauthenticated states; fix failures.
- [ ] Confirm AI sign-in/consent/context restrictions are explained truthfully and controls remain reachable.

### P1 — implement cohesive approved visuals
- [ ] Acquire and version the exact approved generated design boards; mark them as design references, not working screenshots.
- [ ] Map each real screen's sections, states, data and handlers to the approved board; flag discrepancies and unsupported features.
- [ ] Rework/verify complete scrollable Home (including new user), Check-in, Add Symptom, History/Insights/Episodes, Companion, Settings/Premium and onboarding/account.
- [ ] Use appropriate existing Ari poses and scenes. Check responsive cropping, dark/light, loading, alpha and reduced motion.
- [ ] Reconcile design spec with current nav behavior before removing/adding routes.

### P2 — release verification
- [ ] Regression: record create/edit/delete, 1–5/1–10 scales, local dates, offline, sync/conflicts, account boundaries, export, source selection, Companion quotas and retries.
- [ ] Google OAuth provider/PKCE readiness and billing/store offerings require **separate** verification and approval. Never trust illustrative mockup prices.
- [ ] Run existing CI and Android internal build; test real Android keyboard/back/gesture insets, TalkBack and font scaling.
- [ ] Only then create EN/UK/RU Google Play screenshots from implemented, verified UI with synthetic data and truthful claims.

## Decision/evidence ledger
**Approved:** Ambrosia 3.0 expressive premium direction; canonical Ari identity; final designs in the existing style; screenshot-driven QA.
**Confirmed:** PR #29–34 merged; relevant code and Ari scene files exist.
**Unverified:** post-#34 scrolling, final mobile UX, full test suite, production release readiness, OAuth/provider configuration and live billing.
**Needs owner decision:** exact fidelity to generated boards where they differ from supported behavior, central plus navigation, any new fields or prices suggested by artwork.

## Handoff
Read [AGENTS.md](AGENTS.md), inspect current code, address P0 first in small Draft PRs, provide test evidence, and update this file after verified progress.
