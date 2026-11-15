# Acceptance criteria and evidence checklist

Unchecked items below are **future acceptance requirements**, not claims that implementation or owner approval already happened. This Draft PR delivers specifications only. Use [the audit](COMPETITIVE_AUDIT.md) for R/V/P/U/H evidence and [the roadmap](IMPLEMENTATION_ROADMAP.md) for scope/dependencies.

## A — This blueprint / Draft PR

- [ ] Owner reviews O1–O6 and records approved/deferred decisions; no mascot or OAuth approval is inferred from opening the PR.
- [x] All nine requested specification documents exist under `docs/ambrosia-3/`, with an executive overview/navigation page.
- [x] Audit names the main baseline including PR #21 and distinguishes implemented, incomplete and missing features. Google OAuth and three-slide onboarding are not described as current functionality.
- [x] Bearable is the primary reference; the exact CareClinic-published Symptom Tracker package is checked. Publisher marketing/screenshots/reviews and hypotheses are clearly separated.
- [x] Competitor visual observations come from inspected public promotional screenshots, not an asserted installed-app test. Limited/old review samples are disclosed; no complaint prevalence or product superiority is fabricated.
- [x] Proposed colors, typography, icons, screen hierarchy, scale meanings, localized actions, asset sizes and approval gates are concrete enough to review.
- [x] Existing screenshots are linked as unchanged synthetic baseline evidence; they are not proposed final 3.0 UI or proof of real billing/AI acceptance.
- [x] No production code, database/auth/billing/release workflow, final mascot art or existing screenshot is modified by this PR. Only this documentation directory changes.
- [x] Local document links, required files, proposed flat-color contrast calculations and whitespace are checked. No application/browser/SQL/Android suite is manually run for documentation-only changes.

The checked document criteria describe the submitted artifact; unchecked owner/release criteria remain open even when automated checks are green. Existing GitHub workflows may run automatically on the Draft PR; they are not changed or bypassed here.

## B — Foundations and character approval (M1–M2)

- [ ] O1 palette/type/icon/geometry approved with EN/UK/RU samples, plus dark transition behavior. Actual composited text ≥4.5:1 and essential controls/marks ≥3:1, not just reference tokens.
- [ ] Same SVG family, 24 px geometry/2 px stroke, visible destination labels/selection. No Unicode/emoji navigation fallback silently shipped as final.
- [ ] Buttons/inputs ≥48 px targets; calendar's compact geometry is honestly documented with accessible 48 px daily-list alternatives, no overlapping hit areas.
- [ ] Ordinary and low-energy users find today's check-in and Add symptom in the navigation prototype; O3 accepted before removing the old plus shortcut.
- [ ] Three genuinely different mascot concept boards reviewed; selected character has a canonical reference/version and explicit O2 sign-off. Adult tone/originality are pass/fail gates.
- [ ] 11 transparent states and the defined scene batches are identity-consistent, true-alpha/theme-safe, licensed/provenance-recorded, optimized and owner-approved. No anatomy/palette drift across poses.
- [ ] Mascot has no medical-authority cues, guilt/health-score reactions or CTA occlusion; decorative art can be hidden without losing meaning.
- [ ] Fonts/icons/illustrations load locally when required, have dimensions and suitable fallback, and respect first-view payload budgets. No complete master-art library is added to the service-worker shell.

## C — Core data journeys and regression (M3–M5)

Use synthetic data, not production health records. Record tested commit/platform/locale/viewport, expected behavior, actual behavior and evidence artifact. A failing invariant blocks the affected implementation release.

| ID | Scenario | Required result |
| --- | --- | --- |
| C01 | New guest, ordinary day | Four required 1–5 choices when saving; optional note; no symptom/account/paywall required; local save status accurate |
| C02 | Edit existing local day / two devices | Same deterministic account/day ID and captured revision; no duplicate day or silent overwrite; explicit conflict resolution |
| C03 | Dirty form, date switch, Back and keyboard | Input is retained or explicitly discarded; no silent loss/submit; originating context restored; native Back follows reviewed priority |
| C04 | Offline save/reload/reconnect | Entry/check-in/episode survives, pending and cloud states differ, outbox retries safely; no automatic AI sending |
| C05 | Quick ↔ Advanced symptom input | Taxonomy, triggers, note and entry-level 1–10 severity preserved; optional fields not suddenly mandatory; no per-symptom severity falsely implied |
| C06 | Old numeric entry ID / new UUID | Details/follow-up/edit/delete/export remain usable and text-safe |
| C07 | Episode creation/recovering/recovered/delete | Explicit existing status/date constraints; no inferred recovery; deletion/grouping semantics preserve linked journal observations as designed |
| C08 | Empty/sparse/long history | Complete free archive available; missing days are gaps, never zero/healthy; counts/date ranges and partial context truthful |
| C09 | Baseline and comparison boundaries | Existing ≥14 prior recorded days/28-day window excluding week; nonoverlapping 90-day ranges; scales/denominators stay unchanged |
| C10 | Chart keyboard/TalkBack/list access | Date/value table equivalent, visible focus, localized labels and noncolor patterns; all values reachable without hovering |
| C11 | Companion source review | Actual bounded selected sources/fields/counts/notes visible before consent; prior-turn privacy explained; stale/pending/conflicted sources cannot silently dispatch |
| C12 | Multi-turn success/failure/replay/retry | Existing messages/drafts retained; failed retry is explicit new attempt; completed replay does not redispatch or double-charge; no journal mutation |
| C13 | Source edited/deleted after response | Existing source revision/missing warnings; never substitute a different record or fabricate a citation |
| C14 | Guest → account, A→B→A, logout offline | Explicit safe migration and preserved originals; no inherited chat/health/purchase state; stale callbacks cannot affect the new account |
| C15 | Local storage error/read-only second tab | Honest failure/locked state with draft retention/recovery export; no success toast for a rejected commit |
| C16 | Selected/full export and deletion | Free, accurate scope; native sharing and web downloads both work; existing confirmation/reauthentication, other-device/provider retention limits retained |

## D — Onboarding and auth (M4, optional M4b)

- [ ] Three text-free approved illustrations; localized DOM copy, visible language/skip/progress, Back/Next and optional guest/email paths. First value does not require a subscription or a diagnosis.
- [ ] Fresh/returning/previously onboarded users retain records and expected completion state through the upgrade. No localStorage reset as migration.
- [ ] Email sign-in/signup/confirmation/reset/expiry/offline/session-change paths pass; confirmation does not pretend to be an authenticated session. Existing web-origin recovery still works on native account journeys.
- [ ] Device-data merge clearly states counts/scope and offers Not now; originals/conflicts survive failures, no cloud replacement shortcut.
- [ ] **If O5 is deferred:** no working-looking Google button or Google login claim anywhere, including store visuals.
- [ ] **If O5 is included:** owner provider/client/certificate/redirect setup reviewed; supported external browser + PKCE/code exchange; exact callback validation, replay/cancel/process-death/account-switch tests; explicit identity linking, no email-string merge or purchase transfer. Security acceptance is recorded separately from visual approval.

## E — Premium and trust (M6–M7)

- [ ] Free check-ins/symptoms/episodes/full history/export/delete remain accessible with billing unavailable or quota exhausted.
- [ ] Android offerings, localized prices/currencies and every eligible phase match the actual selected store option; expired/ineligible trials and unknown discounts are never advertised.
- [ ] Native vs web behavior preserved: no native billing launch in a normal browser, no misleading checkout or refresh labeled as store restoration.
- [ ] Store cancellation, changed price, SDK success/server pending, timeout and restoration show distinct states. No success before server confirmation; pending never encourages repurchase.
- [ ] Original-owner restore policy, immutable transaction ownership, webhook authorization/dedup/order, fresh entitlement verification and grace V1/V2 guards remain unchanged and regression-tested.
- [ ] Paid cancellation vs expiry/account hold/refund-with-revocation follows server status; local flags/cosmetic preferences never grant Premium or lift report/chat/global usage limits.
- [ ] AI disabled/provider/global budget errors are not represented as a reason to buy. Limits/reset dates reflect server data, not invented marketing numbers.
- [ ] Existing real internal-track purchase/renewal/refund/grace/restore checklist is executed by the owner, with actual dashboard/device evidence. No screenshot/fixture/compile result substitutes for this gate.
- [ ] Declining Premium leaves the user welcome; no coercive mascot, countdown, fake scarcity or blocked data escape route. Optional offer cadence approved under O6.

## F — Visual/accessibility/native release matrix (M7)

Review Home/check-in/symptoms/detail/episode/history/insights/Companion/account/Settings/Premium/onboarding in EN/UK/RU, light/dark, at 320/375/390/430 px. Run a targeted scripted viewport sweep and manual checks where a headless browser cannot establish usability.

- [ ] 200% text sizing and 400% web zoom; no clipped plan phase, consent, button, heading or numeric unit. Long UK/RU strings wrap; no font shrinking as a workaround.
- [ ] TalkBack reading order, scale selected/unselected/error names, navigation labels, calendar/list/table alternatives, source links and store terms are understandable. Visible keyboard focus persists across sheets and validation.
- [ ] Reduced motion removes decorative transforms/loops; no infinite pulse, focus theft or health-score reward animation. Images unavailable/slow do not block entry.
- [ ] Actual Android gesture nav/safe areas, keyboard/composer resize, hardware/software Back, app minimize/resume/process death and bank-app purchase transition are checked.
- [ ] Debug/internal AAB built by existing workflows; correct package/version/signing context, no secrets in artifact/source. No public release is performed without owner action.
- [ ] Synthetic before/after exports and high-risk sync/auth/billing/chat regression are reviewed for the exact release commit; visual rollback can preserve schema/local journal partitions.

## G — Store campaign and research gate (M8)

- [ ] Only owner-approved canonical identity and screenshots of implemented screens; synthetic records labeled in internal provenance.
- [ ] Six panels have a clear truthful feature story, readable localized headlines and current Console-safe dimensions; no competitor art, invented testimonials/ratings or unsupported clinical/device-import claims.
- [ ] Native-speaker copy review, representative task study and accessibility review findings are recorded with failures/fixes. No manufactured user feedback, retention metrics or claim to beat Bearable.
- [ ] Product/brand approval, billing/device evidence and release decision are separate sign-offs. Prior issue #15 and the user-feedback/Android gate are closed only when their actual acceptance criteria are met.

## Evidence log template

For each future milestone record: commit/build; scenario ID; synthetic dataset; platform/WebView/device; locale/theme/font size; result; artifact link; reviewer; unresolved issue; owner approval/version. Store no health notes, auth tokens, customer order IDs, private keys or passwords in this log. Mark unexecuted checks **not run**, never “passed by design”.
