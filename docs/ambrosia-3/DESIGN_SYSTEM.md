# Design system — proposed tokens and component contracts

Status: **O1 approval required before implementation**. Direction: expressive iris/apricot/aqua with strong ink, not calm beige or weak pastel-on-pastel. This is a specification, not a CSS patch. Keep vanilla modules/Capacitor; no framework migration or new runtime dependency is justified by this plan.

## Color roles

Hex values are proposed canonical tokens, not alternatives for a mascot after approval. Bright colors are deliberate focal surfaces; pale tints are reading aids, never the entire visual identity.

| Token / role | Light | Dark | Usage |
| --- | --- | --- | --- |
| `canvas` | `#F5F4FF` | `#19152D` | Page background |
| `surface` | `#FFFFFF` | `#29213D` | Forms, list rows, reading cards |
| `surface-accent` | `#E8E2FF` | `#362750` | Context/selection backdrop; always with strong text/border |
| `text` | `#202039` | `#F5F1FF` | Body, chart values and headings |
| `text-muted` | `#625B77` | `#C5BDD7` | Secondary information, not low-opacity text |
| `primary` | `#5737D6` | `#B8A4FF` | Main action, selected state, key chart series |
| `on-primary` | `#FFFFFF` | `#202039` | Button text/icons |
| `secondary` | `#007D77` | `#65E0C1` | Secondary action/chart ink in light; bright accents in dark |
| `apricot` | `#FFB85C` | `#FFB85C` | Welcoming/energy surfaces; dark ink text |
| `aqua` | `#65E0C1` | `#65E0C1` | Fresh/selected accents; dark ink text |
| `rose` | `#F271A5` | `#F271A5` | Mood/illustration accents, not error semantics |
| `border-control` | `#837995` | `#8E80A8` | Input/selection boundaries, minimum 1.5 px |
| `danger` | `#A52043` | `#FFB2C4` | Error text/icon; separate pale/deep error surface |

Do not use white small text on apricot/aqua/rose. Do not set opacity on whole cards to produce disabled text; use disabled text/icon/border tokens explicitly. No gradients behind body copy; subtle brand gradients are allowed only in illustration/header zones with an opaque text backing.

### Contrast evidence

Ratios calculated from sRGB relative luminance, `(Llighter + .05)/(Ldarker + .05)`, for the exact pairs below. This validates proposed flat-color pairs, not a completed WCAG audit or anti-aliased illustration/text rendering.

| Foreground / background | Ratio | Contract |
| --- | --- | --- |
| White / iris | 7.19:1 | Primary action text |
| Ink / canvas | 14.52:1 | Body |
| Muted / white | 6.40:1 | Supporting copy |
| Teal / white | 5.00:1 | Secondary action text |
| Ink / apricot | 9.24:1 | Accent card text |
| Ink / aqua | 9.78:1 | Accent card text |
| Danger / white | 7.27:1 | Error text |
| Control border / white | 4.09:1 | Boundary |
| Dark text / dark surface | 13.71:1 | Body |
| Dark muted / dark surface | 8.44:1 | Supporting copy |
| Ink / dark primary | 7.38:1 | Dark primary action text |
| Dark control border / dark surface | 4.21:1 | Boundary |

Future implementation must verify every actual composited state, focus ring, selected control and chart mark. Text ≥4.5:1; large text ≥3:1; essential boundaries/nontext ≥3:1. Decorations cannot carry information. Use white inner + iris outer focus on light, ink inner + light-iris outer on dark; test each adjacent surface.

## Typography and spacing

Propose **Nunito Sans** for headers and body, weights 400/600/700/800, with verified Latin/Ukrainian/Russian glyph coverage and tabular numerals for dates/metrics. Self-host licensed WOFF2 subsets in a future asset PR; retain OFL/license and fallback `system-ui, sans-serif`. Do not turn this into a remote-font dependency or add condensed display type. Owner approval includes rendering samples for `Ї Є Ґ І Й ё` and mixed numeric labels. Existing Playfair/DM Sans are the audited baseline, not a typography requirement.

| Role | Size / line height | Weight | Constraint |
| --- | --- | --- | --- |
| Screen title | 28 / 34 px | 800 | Up to two lines; 32 / 38 only for short onboarding headings |
| Section | 20 / 28 | 700 | Sentence case |
| Card title | 18 / 24 | 700 | Do not truncate health labels |
| Body/input | 16 / 24 | 400 or 600 | Inputs never below 16 px |
| Button | 16 / 22 | 700 | Wrap to two lines rather than shrink |
| Metadata/nav | 12 / 16 minimum | 600 | Never the only source of an action's meaning |
| Metric | 28 / 32 | 800 | Include unit/scale/record count nearby |

4 px spacing base: 4/8/12/16/24/32. At 320–430 px use 16 px page gutters; 390 px content width =358 px. Cards: 20 px radius, 16 px inner padding, 1 px decorative edge, subtle ink shadow (8% maximum). Inputs: 12 px radius, 48 px minimum height, persistent visible labels. Hero: 24 px radius, at most one saturated hero per viewport. No nested card-within-card-within-card stack. Reading max-width 680 px on larger web screens; handset layout does not become a permanent sidebar.

## Icon and navigation geometry

Use one proposed **Lucide-style outlined SVG family**: 24×24 viewBox, 2 px stroke, round caps/joins; ship licensed SVGs locally in a future component PR. Use home, calendar-days, messages-square, settings; plus-circle with text for “Add symptom”; heart-pulse only with a label, never an emergency claim. No Unicode house/sparkle/target substitutes and no mixed emoji as navigation icons. Filled selection background + text weight + `aria-current` identify the active destination.

Four equal navigation slots, each ≥64 px wide on 320 px; 72 px bar + bottom safe area, 48 px target minimum. Icons 24 px; labels below with 4 px gap. Remove the central plus **only after O3 prototype validation**; named symptom actions on Home and History replace it. Editing screens hide tabs and have an explicit Back/Cancel/Save pattern. Bottom content padding must equal actual bar/sticky-action height + safe area + 16 px, not a magic fixed overlap.

## Components

| Component | Anatomy / behavior |
| --- | --- |
| Today hero | Date + saved/missing status, small approved character zone, one iris CTA; optional 4-value mini-summary; no fake overall health score |
| Main button | Filled iris; 48 px min, 16 px horizontal inset; one per form/state. Loading preserves width and visible progress text |
| Secondary button | Surface + 1.5 px boundary + teal text/icon. “Add symptom” must read as a separate outcome |
| Tertiary/text action | Underlined/descriptive text, 48 px interaction area; not a low-contrast tiny link |
| Destructive action | Danger label/icon; detailed confirmation; never adjacent to main Save without spacing/group separation |
| Category chip | Icon + text; selected check + border + background; minimum 48 px target; counts never stand alone |
| Five-position check-in | Five 48 px targets and four 8 px gaps fit 288 px at 320 px screen width (272 px total). Symbol + number, endpoint/current text outside row. Each dimension has its own verbal meaning, not one universal face |
| Symptom severity | Preserve 1–10 integers. Slider plus decrement/increment and selected numeric/verbal label. Suggested bands 1–3 mild, 4–6 moderate, 7–10 severe are interface descriptors, not diagnoses or new thresholds |
| Context capsule | Calendar/source icon + dates/count/notes included-or-off; opens source review; never claims “all your history” for a partial sample |
| State panel | One concise title, consequence and named recovery action. Illustration optional and secondary |

Mood/wellbeing 1 = very difficult, 5 = very good; energy 1 = very low, 5 = very high; sleep 1 = very poor, 5 = very good. Do not label 1 “bad person”, flip scales or infer one dimension from another. Unselected is an outlined choice, never a neutral value automatically submitted.

## Charts and calendar

Reuse actual model outputs and thresholds. Label dimension, date range, 1–5 or 1–10 scale, recorded sample `n`, coverage and partial context. Gaps stay gaps: never fill a missing day with zero, connect a line over a missing observation, or award health credit for an absence. Baseline remains ≥14 recorded days in the prior 28, excluding the current week; comparisons preserve existing nonoverlapping windows.

Series: iris solid/circle; teal dashed/square; a third dark-rose/dotted/triangle series only after nontext contrast measurement. Avoid eight rainbow lines. Use categories as icons/text in summaries rather than chart color alone. Essential lines ≥2.5 px and dots ≥6 px. Provide an equivalent date/value table, keyboard focus/selection and readable tooltip; this is **new chart interaction work**, not a claim about today's SVG. Show “3 of 7 days recorded”, not “43% healthy”. No causal percent badges without a separately validated analysis feature.

At 320 px calendar cells cannot all have 48 px horizontal hit areas in seven columns. Use 40 px cells with 48 px row height, isolated targets and visible focus, plus a fully accessible **daily list alternative with 48 px rows**. Do not claim a universal 48×48 target exception is solved by overlapping hit regions. Weekday labels must be localized; selected day has outline + number + spoken state; indicators distinguish check-in, symptom and both with a legend. Local calendar days do not shift with UTC formatting.

## Motion and feedback

Transitions 140–180 ms ease-out; pressed scale 0.98, selection check fade 100 ms. Character idle may be one 1.5-second welcome gesture per visit, never an infinite bounce. No mascot movement or layout shift during text entry; no pulse that implies a clinical emergency from severity alone. `prefers-reduced-motion` removes transforms/animated paths and character loops; preserve instantaneous state changes. Haptics are optional future native enhancement, disabled until reviewed; they are not a dependency.

- Empty: explain what is absent and one relevant action; no invented example data in the real journal.
- Loading: stable-height skeleton + textual status; never a fake graph or a mascot that implies provider completion.
- Local save: “Saved on this device”; pending sync is a distinct compact row/detail, not an app-wide banner.
- Success: brief text/check, no confetti tied to mood or symptoms. Live-region announcement must not steal focus.
- Error: preserve input, explain whether an attempt may have counted, and distinguish retry from a new paid/provider attempt.
- Destructive confirmation: describe scope, retained external copies and cancellation of store subscriptions separately.

## Accessibility gates

Target 48 px interactive controls; 200% text sizing and 400% web zoom without clipped actions; TalkBack names/order for scales, dates, source links and plan phases. On long UK/RU strings, grow containers and wrap, never reduce fonts or hide prices/consent. Text is DOM content, not baked into illustrations. Auto-complete, password manager/paste, visible focus and semantic errors remain available. Check Android gesture navigation/keyboard at 320/375/390/430 px and real-device font scaling. Independent accessibility review is still required; token ratios alone are not certification.
