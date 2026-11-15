# Mascot and illustration creative brief

**No artwork generated in this phase.** All concepts/names below are exploration directions, not approved assets or final product names. The owner must approve one silhouette and then its canonical character sheet before any final UI implementation depends on it. Asset production follows [the manifest](ASSET_MANIFEST.md).

## Shared art direction

Create a quietly witty, attentive companion for adults who may have chronic symptoms, fatigue or brain fog. Its job is to welcome, help explain a control and make the app memorable. It must be equally supportive on healthy and difficult days. It does not diagnose, award compliance, worry because the user missed a day, impersonate a clinician or imply an actual person is listening to a chat.

Render in **2.5D / restrained 3D**: matte ceramic/satin material, soft area light from upper left, broad readable planes, controlled contact shadow in full compositions, no photoreal fur or wet/glassy eyes. Orthographic/slight three-quarter camera, repeatable 25° elevation; no aggressive perspective or glossy toy-ad surfaces. Flat small facial marks must remain legible at 48–64 px. Adult proportions, small eyes and calm mouth; no baby head/body ratio, pacifier, rosy baby cheeks, stickers or slapstick illness reactions.

Brand environment: electric iris `#5737D6`, apricot `#FFB85C`, aqua `#65E0C1`, ink `#202039`; bright stage colors can vary, **the approved character's anatomy/material/base colors cannot**. No white bear, rounded bear ears, blue shirt, Bearable face/body silhouette, copied mascot pose, recognizable competitor composition, crosses/stethoscopes or clinical certification symbols. Do not submit a bear recolored purple as an original direction.

## Three distinct concepts

| Direction | Silhouette and personality | Proposed canonical palette if selected | Brand relationship and risks |
| --- | --- | --- | --- |
| **A — Ari, lantern gecko (recommended exploration)** | Low, elongated gecko with four small splayed feet; lifted head and a long curled tail ending in a single flat lantern-shaped leaf. Adult, observant and patient; expression mostly through head angle, tail position and small eye marks. At 32 px the tail-leaf and long body must still differentiate it from a mammal. | Iris body; apricot underside/leaf tip; two aqua tail bands; ink facial marks. No color-changing emotion gimmick. | Small observant creature fits “notice changes” without claiming health science. Rounded geometry supports friendly 3D while retaining a reptile silhouette. Risk: reptile aversion or too much fine anatomy; test comfort and simplify toe detail without turning it into a bear. |
| **B — Neri, folded manta** | Wide horizontal, single diamond/folded-ribbon body, two broad side fins, short tapering tail; no feet, ears or clothes. Moves through a composition as a composed, attentive guide rather than a bubbly pet. | Deep teal body, apricot inner folds and iris fin tips; ink face against a lighter front plane. | Fold/orbit shapes align with a record unfolding over time. Very different horizontal silhouette, useful for wide banners. Risk: reads aquatic or like a flat logo at small sizes; avoid realistic gills/underwater scenes and keep face/pose readable. |
| **C — Tavi, faceted seed-being** | Upright asymmetric seed/stone with six rounded facets, two short leaf-like side paddles and no animal limbs/tail. Grounded, curious, gently expressive through tilt and face placement. | Apricot body, iris central facet and aqua paddle edges; small ink face. | A fictional botanical object relates loosely to Ambrosia's name and care without making a cure/nutrition claim. Strong angular silhouette is suitable for explanatory poses. Risk: becomes an anonymous blob or wellness sprout; require distinctive facet layout and asymmetry, no generic smiling bean. |

Names are working labels and need owner preference/trademark review before public use. Do not alternate concepts per screen. The recommendation for A is an audit judgment, not an approved identity or user-study winner. If reptile comfort fails, compare B and C with the same tasks instead of disguising A as a mammal.

## Mobile composition

- **Home:** 80–112 px at 390 px width, trailing hero illustration zone, no more than about one quarter of hero width; main action remains on the text side/below. At large text the illustration may move below heading or disappear.
- **Check-in:** use authored scale symbols, not eleven full mascot poses in a row. A 48 px character accent may explain first use, then stay out of the task.
- **Onboarding:** character full figure occupies roughly 25–35% of the visible slide height; title/body/actions remain separate DOM text. No hand/tail points at a location that will shift with translation.
- **Companion:** introduction/list empty state 112–144 px; in conversation at most a small 24–32 px avatar, not a dancing figure next to every answer. “Listening” signals the interface state, not human/clinical monitoring.
- **Premium:** 96–128 px explanatory pose; no bag of money, crown/shield of clinical quality or jealous Free character. A person declining payment receives the same welcoming identity.
- **Errors:** supportive neutral pose ≤80 px with real recovery text. Never a crying, panicked or blaming character. No art over a serious consent or destructive confirmation.

Transparent assets should work against both defined themes; do not bake a light background or shadow rectangle into the cutout. Generate whole anatomy with margins; crop in authored composition only after identity approval.

## Expression and behavior guidance

| State | Intended expression | Explicit anti-pattern |
| --- | --- | --- |
| Neutral | Relaxed stance, attentive eyes | Medical authority/diagnosis posture |
| Welcoming | Small open gesture | Oversized wave covering CTA |
| Happy | Modest closed-mouth smile | Reward for a particular mood score |
| Encouraging | Steady forward-facing reassurance | “Try harder” or missed-day guilt |
| Thoughtful | Slight head tilt, quiet focus | Promise of analytical certainty |
| Listening | Attentive neutral orientation | Claim of a real therapist watching |
| Concerned/supportive | Soft, composed seriousness | Panic, tears, red flashing alarm |
| Sleepy | Resting posture | Shaming sleep or enforcing bedtime |
| Celebrating | Small positive gesture after a user task | Confetti for low symptoms or inferred recovery |
| Explaining | Open gesture with empty space for UI | Text/medical claims baked into the image |
| Empty-state reaction | Curious/available, no sadness | Character upset because no data exists |

## Approval sequence and reusable generation brief

1. **Exploration gate:** owner reviews three silhouette/color/composition boards. No board is labeled final; colors may be explored here only. Check difference from Bearable and broad comfort with the creature.
2. **Identity gate:** select one concept and approve front/side/back/three-quarter views, measured proportions, fixed facial placement, anatomy, palette, material, lighting and neutral pose. This canonical sheet becomes reference `character-v1`. Owner signs off the exact source file/version, not just a chat description.
3. **Expression gate:** test neutral/welcoming/listening/supportive at 48/96/144 px on light/dark. Check anatomy drift, adult tone and readable silhouette. Iterate the sheet first if a pose cannot stay consistent.
4. **Production batch gates:** generate the 11 cutouts, then three onboarding compositions, then auth/Companion/Premium/empty/store batches. Each batch references the approved sheet and neutral turntable; reject identity drift before optimizing files.
5. **Integration gate:** check alpha edges, crop, theme contrast, captions/alt behavior, localization-safe zones and performance. Approve composed screens separately from character approval.

Future generation brief template (not executed here): “Use the **owner-approved character-v1 reference**. Produce [asset ID/state] in [camera/pose] with the exact approved anatomy, face placement, base colors and matte material. Upper-left soft area light. Entire silhouette inside the safe frame, true alpha where required. No lettering, UI, competitor motifs, clothes not present in the canonical sheet, new accessories, limbs or palette variants. Intended display size [px]; preserve readability at that size.” Attach the actual canonical references; text-only regeneration is insufficient for identity consistency.

Review rubric: originality/Bearable distance (pass/fail), adult comfort (pass/fail), 48 px silhouette, dark/light legibility, expression restraint, stable anatomy and reproducible composition. Do not use an average score to overrule an originality or comfort failure. No final mascot/illustration production begins until O2 is approved.
