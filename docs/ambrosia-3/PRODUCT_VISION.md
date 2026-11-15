# Product vision

**Proposal, pending O1–O6 in [the overview](README.md).** Ambrosia is a friendly record of ordinary days, difficult days and recovery, with an inspectable bridge from those records to reflection and clinician questions. “Notice your day. Understand your story.” is a proposed brand line, not a claim that the app discovers diagnoses or causes.

## The intended visual signature

**Electric iris + apricot + aqua, confident rounded typography, an asymmetric orbit/crescent motif, and one original companion.** White/light lavender reading surfaces separate bright focal panels. Ink-colored numbers and labels remain readable. Dark mode carries the same accents against plum, rather than merely tinting the old green stylesheet. This combination should identify an Ambrosia screenshot without relying on a logo alone.

Bearable demonstrates that serious chronic-health tracking can feel friendly and recognizable. Ambrosia should compete through a more decisive action hierarchy and transparent journal context, not by importing Bearable's bear, claiming greater medical accuracy or rebuilding every tracker type. A mascot occupies a deliberate illustration zone; it never becomes a replacement for text, a therapist persona, or a reward for reporting “good” health.

## Three jobs, three moments

| Person/moment | Job | Result the interface should support |
| --- | --- | --- |
| Healthy/ordinary day, low motivation | Note how today felt without inventing a symptom | Home → four labeled choices → Save; no account/paywall required |
| Flare/fatigue/brain fog | Record one symptom now, optional details later | Named symptom action; plain severity labels; local preservation and retry |
| Looking back or preparing a visit | Recall a period accurately and decide what to share | Calendar/episode → observed counts and gaps → selected context/export or consented Companion |

Account creation, Premium and illustrations support these jobs; none is the first mandatory task.

## Preserve the moat that already exists

The offline-first outbox, deterministic check-in IDs, explicit conflict review, account partitions, dated recovery episodes, complete free history, context-source revisions and server-only billing are assets. A new component system wraps their existing handlers and models. It must not quietly reinterpret stored intensity scales, move guest data, resend offline questions, clear old keys, reset quota counters or substitute a local Premium flag.

Companion's promise is concrete: “Choose the records to discuss; inspect the sources.” It is not an autonomous care agent and cannot write journal observations. Clinician preparation means existing reports/questions and selected export; no integrated medical portal or direct care-team messaging is implied.

## Scope boundaries

| 3.0 presentation work | Separate, explicitly authorized work | Not a 3.0 promise |
| --- | --- | --- |
| Tokens, icon family, navigation, explicit labels, home hierarchy, expressive scales, readable chart/context surfaces, approved illustration placements | Google OAuth/native return flow; unsaved-date/Back improvements; any new chart data-table interaction; versioned local presentation preferences | New health schema/custom-metric editor, body map, medication reminders, wearables, clinician portal, validated correlations, automatic diagnoses |

The first column still needs future implementation PRs; this Draft PR implements none of it. The second column must have explicit acceptance and security review, not hide behind “visual polish.” The third column must not appear as functional tiles in designs or Play screenshots.

## Product principles with consequences

- **One main action per state:** before a check-in, “Check in today”; after saving, “Edit today's check-in.” “Add symptom” remains distinct. No plus button with an unknown destination.
- **Warm, not coercive:** equal care on a difficult or missing day. No sad mascot when someone skips tracking, streak debt, confetti for low symptoms or celebratory recovery inference.
- **Color as an aid:** category identity and selection use color + icon + text + state border. Severity is a report, not a clinical alert classification.
- **Progressive depth:** first entry needs no optional note, episode or context configuration. Advanced details and source review remain reachable and clearly named.
- **State honesty:** local save, upload pending, synced, failed provider, unknown Premium and verified Premium have different copy and visuals. No global sync banner returns.
- **Meaning before payment:** show a real insight/count, then explain advanced comparison value. Keep history/export/delete available when billing is unavailable.

## Success hypotheses, not results

Baseline and target measurements are not available yet. Proposed moderated study: 5–8 consenting adults across fatigue/brain-fog, low-vision/large-text and ordinary-day usage, using synthetic records; this finds usability issues, not population effects. Include a separate TalkBack task review. Recruit through owner-approved channels; this PR contacts nobody.

| Hypothesis | Proposed acceptance experiment | Explicit limit |
| --- | --- | --- |
| Today is obvious | At least 4/5 participants find check-in and add a symptom without prompting | Design gate, not statistically significant evidence of superiority |
| Entry feels quick | Median completed healthy check-in ≤20 seconds after first exposure; zero required typing | 15 seconds is a stretch goal, not an existing measured result |
| Context sharing is understood | Participants identify what notes/sources will leave the device before Send | Failure blocks Companion copy sign-off |
| Identity is memorable and adult | Compare three original silhouette boards; ask recognition/tone/accessibility questions | No competitor artwork used as the approved character |
| Premium is trustworthy | Participants distinguish a plan selection from store confirmation, and a purchase from server verification | Sandbox/real internal-track acceptance is a separate gate |

Optional future aggregate analytics require separate owner approval and privacy review; no content, symptom, message, source-ID or purchase-token telemetry is specified here. Do not add tracking simply to measure a design target.
