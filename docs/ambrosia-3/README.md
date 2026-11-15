# Ambrosia 3.0 — product and visual blueprint

**Status: proposal for owner review, not an implemented redesign.** Audited `main` at `fea4764203e6e3d9a827e0d259077113992a389e` (PR #21 included), 15 November 2026. This directory is the only change in this Draft PR. No runtime, auth, billing, schema or release workflow is changed. No mascot artwork has been generated or approved.

## Executive recommendation

Make Ambrosia recognizable through **electric iris, apricot and aqua; clear ink typography; expressive category symbols; and one original, adult-friendly 2.5D companion**. Use a bright, high-contrast canvas with deliberately saturated focal areas, rather than another forest-green or beige wellness template. Retain a specified dark counterpart. Bearable is the primary reference for friendly recognition and colorful, legible tracking; its bear, blue shirt, card compositions, copy and claimed outcomes are not design assets for Ambrosia.

The strongest opportunities are:

1. **Give today one obvious action.** Replace the oversized generic greeting and competing add controls with today's check-in, a distinct “Add symptom” secondary action, and a compact recorded-days insight. Healthy days must remain useful without inventing symptoms.
2. **Make expressive entry functional.** Illustrated five-position choices retain the existing four 1–5 dimensions; numeric/text labels and 48 px controls work when artwork, color or motion cannot. Keep symptom severity a separate 1–10 scale.
3. **Show the existing advantage.** Make source-linked Companion context, explicit episode recovery, recorded-day statistics and complete free history understandable. Do not claim verified competitive superiority or causal/medical insights.
4. **Earn attention before an offer.** Three illustrated onboarding slides → optional guest entry or existing email auth. Offer Premium after a useful insight, without blocking core data. Google sign-in is a **missing integration**, not an existing capability to recolor.
5. **Approve identity before building its UI.** Recommend the lantern-gecko concept for exploration, alongside a manta and a faceted seed-being. The owner selects a silhouette and canonical identity before final art or mascot-dependent implementation.

## Review sequence

| Document | Decision it enables |
| --- | --- |
| [Competitive audit](COMPETITIVE_AUDIT.md) | What exists, what is uncertain, and which competitive gaps matter |
| [Product vision](PRODUCT_VISION.md) | Positioning, scope and measurable hypotheses |
| [Design system](DESIGN_SYSTEM.md) | Palette, type, icons, geometry, states and accessibility |
| [Screen specifications](SCREEN_SPECIFICATIONS.md) | Per-screen structure, actions, EN/UK/RU labels and edge cases |
| [Mascot creative brief](MASCOT_CREATIVE_BRIEF.md) | Three original directions and an approval rubric |
| [Asset manifest](ASSET_MANIFEST.md) | Generation inventory, composition, formats and identity control |
| [Onboarding/auth/paywall](ONBOARDING_AUTH_PAYWALL.md) | Guest/account continuity and truthful monetization |
| [Implementation roadmap](IMPLEMENTATION_ROADMAP.md) | Dependencies, small PR boundaries and acceptance gates |
| [Acceptance criteria](ACCEPTANCE_CRITERIA.md) | Reviewable evidence required before rollout |

## Decisions requiring owner approval

- **O1:** iris/apricot/aqua identity, typography and light/dark treatment. Existing users should retain a dark experience until theme transition is reviewed; no silent theme reset is specified.
- **O2:** one mascot concept, adult tone and canonical character sheet; then separately approve production asset batches. No three interchangeable characters in the shipped brand.
- **O3:** four-destination navigation with a labeled symptom action on Home/History instead of the ambiguous central plus. Validate discoverability before removing the old shortcut.
- **O4:** three-slide onboarding copy, optional guest CTA and the proposed localized action glossary.
- **O5:** whether to authorize Google OAuth as a separately scoped implementation. Provider credentials, native callbacks and account linking are not configured by this proposal.
- **O6:** contextual Premium trigger/cooldown and store-listing campaign. Prices, trial eligibility and entitlements remain store/server-supplied, never marketing constants.

These are design/release gates for subsequent work, not a request to halt this documentation task. Technical unknowns, real-device billing acceptance and representative user feedback remain open; old fixture screenshots and prior CI do not resolve them.
