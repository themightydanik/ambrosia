# Screen specifications

All layouts below are **future specifications**, not screenshots of implemented 3.0 screens. Use the tokens/component contracts in [Design system](DESIGN_SYSTEM.md). Keep existing route names, models, record IDs and protected handlers unless a separately reviewed change is justified. Every screen has light/dark, EN/UK/RU, keyboard/large-text and offline states; approved illustration slots may remain empty during prototyping, never filled with an unapproved “final mascot”.

## Global composition and navigation

On 390×844: 16 px gutters, top safe area, compact 56 px header, scrollable content, four-slot 72 px bottom bar plus system safe area. Home/History/Companion/Settings are destinations. Daily check-in, symptom editing, episode editing, account subflows and Premium are focused tasks with Back and explicit context. Respect the actual Android keyboard/insets; no sticky action may cover an input, source or subscription disclosure.

Proposed navigation is Home → History → Companion → Settings. Home and History expose **Add symptom**. No central ambiguous plus in the preferred prototype; keep the old shortcut until discoverability testing/O3 passes. Selecting a tab preserves appropriate scroll/filter state, never submits a form or clears another account's partitions.

Back order proposal: close sheet/modal → dismiss keyboard if appropriate → return to originating screen → Home → minimize on Home. Dirty forms offer Keep editing / Discard; no new journal auto-save is implied. This is a deliberate improvement over current native Back-to-Home behavior and must be implemented/tested separately. Account switch invalidates all pending screen callbacks; no stale success toast or visible data may cross accounts.

## S01 Home — `home`

**Purpose:** know what has been recorded today and choose the next useful action.

Order: compact wordmark/date + Settings icon; today hero; Add symptom secondary action; one observed-week insight; recent entries/episode shortcut; optional Companion invitation. Header is 56 px, hero target 220–260 px at default text size; sizes grow for accessibility. Do not reserve half the viewport for a generic greeting. Approved mascot slot: 80–112 px wide, upper trailing side; never behind values or buttons.

- No check-in: heading “How is today feeling?” + main **Check in today**; supporting “Four quick choices. A note is optional.”
- Saved: “Today's check-in saved” + four values with dimension/scale labels + main **Edit today's check-in**. Never infer mood from symptom intensity.
- **Add symptom** remains a separate secondary action in both states. Companion is tertiary here, not equal visual weight to Save/check-in.
- Weekly insight says range, dimension, recorded-day count and sufficiency. Use model output; insufficient data is honest copy, not a progress debt. Clicking opens the existing Insights subsection with that range.
- New guest: local-save explanation without a login modal. Pending sync is a compact account-specific status link, not a permanent global banner. Offline does not block core entry.

Acceptance: first viewport exposes main CTA and Add symptom at 320–430 px default text; at 200% text both are reachable by ordinary vertical scroll. Recent cards show date, symptoms/check-in and actual status; note snippets are not required on Home. No streaks, diagnosis scores or invented examples.

## S02 Daily check-in — `checkin`

Date/back header; four expressive groups (wellbeing, mood, energy, sleep); optional note accordion; sticky **Save check-in** above safe area. The date defaults to the user's local day and clearly signals editing an earlier day. Use the existing storage order/keys, even if the visual order is reviewed differently.

Five choices per group: symbol + numeric value + persistent field label. Endpoint descriptors and current selected word are visible, not tooltip-only. Only one value per group; no default submitted value. A completed check-in requires all four dimensions, but the user can leave without submitting. Number meanings are preserved (1 low/difficult, 5 high/good), with energy-specific and sleep-specific words.

Editing loads existing values and version. Changing day with dirty input prompts before re-render rather than silently losing selections; this guard is new interaction work. A note is optional and bounded by existing validation. On local save failure retain input; on CAS conflict retain both versions in the existing conflict-review flow. After local commit show a factual save message; cloud completion is separate. Delete uses its own menu/confirmation and tombstone semantics. Back never changes day identity or silently uploads data.

## S03 Symptoms — `log`

Heading **Add symptom**; Quick/Advanced segmented control; category selector, symptom choices and the existing entry-level 1–10 intensity; main **Save symptom entry**. Show the selected symptoms and “Severity for this entry” so users do not assume per-symptom severity values are being stored. At least one actual symptom selection; do not invent a “healthy symptom”.

Quick: optional details collapsed. Advanced: retain triggers, onset/end, notes and episode association in clear groups; preserve the currently supported validations and save routine. Do not require a text note, trigger or episode to save a quick entry. Expand details without losing choices, and keep numeric intensity visible when using slider buttons/keyboard.

Save is one local transaction; failure retains input. High-intensity follow-up behavior exists: preserve access to follow-up controls, but propose a calm explanation and no persistent alarming animation. Do not diagnose, silently contact anyone or turn the mascot into a medical warning. A symptom entry remains independently editable/exportable if its episode is later removed. Any business-rule change requires its own scope review.

## S04 Observation detail and follow-up — existing modal

Header: observation type/date, close/back; symptom names, intensity with scale, optional onset/end/triggers/notes; dated status history; **Add follow-up** and **Discuss this entry**. Edit/delete actions are lower priority and visually separated. Maintain legacy numeric-ID compatibility and safe text rendering.

Follow-up flow offers current supported status choices and optional note, with **Save follow-up**; it must not mutate historical timestamps or duplicate the source entry as a new symptom record. On stale/deleted revision retain the user's input and explain sync/review. Return from source-linked Companion to the originating record, with the existing revision warning if it changed.

## S05 History — `history`, Calendar/List/Insights/Episodes

Top header/range, persistent subsection switch; date/calendar area or daily list; selected-day details; local filter/episode actions. Keep the full archive available Free. Use category markers and a legend; a day with no record is “No entry”, not healthy. Selected date and Today are distinguishable without color.

- **Calendar:** compact localized month switch and day cells; alternate daily list for larger targets/TalkBack. Selecting a day shows check-in/symptoms/episode links and **Add symptom**. No automatic check-in is created by selecting a day.
- **List:** date headings and record-type labels; clear range/filter; no truncated note as the only way to identify an observation. Existing Premium symptom filter remains accurately gated; do not lock complete history.
- **Insights:** dimension selector, 7-day summary, recorded `n`, missing-data explanation, eligible baseline. Add date/value table access and keyboard-selected points (new UI work). Insufficient data must not trigger an upgrade pitch promising invented results. Advanced 90-day comparison uses the existing verified gate and nonoverlapping ranges, with denominator/date labels.
- **Episodes:** named grouping, explicit ongoing/recovering/recovered label and dates; **Create episode**. Tapping opens episode detail/editor, not an inferred recovery calculation.
- Range/day/episode → **Discuss selected records** or **Export selected records** uses the existing bounded context configuration. Clearing a filter does not delete records or modify source selection behind a consented conversation.

## S06 Episode — `episode`

Back + name/status header; start/end, explicitly selected status, optional note; linked observations with dates; **Save episode**; **Discuss this episode** when persisted sources are available. For an existing episode, split reading and editing visually; do not replace its identity or source link when saving.

Recovered requires the existing explicit end date, not a celebratory mascot inference. Ongoing/recovering cases show truthful dates and optional end behavior supported by the model. A suitable supportive character may appear once near the summary, not on every observation. Delete confirmation explains group deletion separately from the linked journal observations; preserve actual underlying semantics. Offline edits queue through existing wellness sync; source discussion requires synchronized current revisions.

## S07 Companion — `ai`

List view: title, brief context explanation, **New conversation**, named previous conversations with last-updated state; rename/delete via labeled menu. Empty state: listening character 128 px maximum, a concise description and suggested questions, not fabricated responses. Guest sees a sign-in action and context export path; no promise of offline AI.

Conversation view: title/back; compact context capsule (range, selected/omitted count, notes off/included); readable turn column; sticky composer and explicit **Send message**. The review sheet shows the actual bounded records/dimensions/source links and changes before sending. Do not imply unselected years of data were analyzed. “Notes off” applies to newly selected records; earlier conversation turns can already contain notes, so expose the existing explanation and a new-conversation path when the user wants to omit prior context. Account/profile changes never auto-send a draft.

- User text and assistant observations are visually distinct; sources are labeled links with type/date/revision. Avoid medical coats/shields suggesting clinical certification. The character introduces the feature, not every assistant turn.
- “Saved draft”, “Sending”, “Could not complete” and “Completed” have different treatment. Keep failed questions and explicit retry semantics; provider failure can consume quota. Retry after failure is a new attempt; a completed replay must not dispatch again.
- Source stale/missing/pending/conflict: explain **Review sources** / **Sync and review**, not a generic purchase prompt. Existing server checks remain authoritative before spending.
- Display separate server chat/report usage with reset date. Quota exhaustion may link to Premium; global/provider disablement must not imply purchase fixes the outage.
- Keep all five existing one-shot report tools in a named expandable **AI reports** area. Their prompt/result/error state must survive unrelated screen refreshes.
- Export stays free; show a privacy confirmation before external sharing. Native uses the existing share/save sheet, web downloads. Message/metadata deletion is not journal deletion.

## S08 Account access — currently within Settings

Propose a focused account subview using the same auth/persistence routines, not a new account model. Welcome illustration 160 px maximum; explain device-only vs account storage; clearly separate **Sign in**, **Create account**, **Reset password**, **Continue on this device**. Inputs have persistent labels, autofill/paste, show-password affordance and errors attached to the relevant field without account enumeration.

Email confirmation is not a signed-in session; reset links continue to the configured web recovery origin. Show pending/expired/session-changed states honestly. An offline user can keep tracking and sign out locally; do not show a fake cloud-success state. Following sign-in, present the existing explicit device-data merge choice with source counts and safe cancel. Guest chat drafts are not implicitly moved into the account.

**Google button is conditional on a separately implemented, configured and tested OAuth flow.** Do not ship a visual-only button or count the proposed transition as current Google auth. Linking an email/Google identity and native callback handling need the O5 gate in [the journey spec](ONBOARDING_AUTH_PAYWALL.md).

## S09 Settings/profile — `settings`

Header with approved small avatar/wordmark, optional profile summary; grouped Account & sync, Language & accessibility, Data & privacy, Premium, About. Avatar/profile editing remains separate from the mascot's canonical identity. No automatic marketing opt-in. Theme and “Reduce character animation” are proposed local presentation preferences; do not draw working toggles until implemented.

Show last sync and pending/conflicts inside the Account section; **Review conflicts** preserves both versions and available recovery export. Separate **Export my data**, **Clear this journal**, **Delete account** with accurate scope. Account deletion requires existing reauthentication/confirmation and explains other devices/backups/external billing. A dedicated **Manage Google Play subscription** link does not claim deletion cancels payments. Keep language choice available before account signup; a selected language does not get overwritten by unrelated account callbacks.

## S10 Premium — `upgrade`

Top: clear benefit headline, small approved explanatory illustration (≤128 px), current **server-verified** status. Show actual advanced comparison and allowance value first, compact Free/Premium comparison second, store plans/price phases and disclosures third; **Restore purchases** and **Manage subscription** remain accessible. For an active plan, prioritize status/expiry/manage over selling the same plan again.

On Android: selectable Monthly/Yearly cards from actual configured offerings. Show the current localized price, currency, billing period, every eligible introductory phase and the subsequent full price. The selected option, visible terms and actual purchase object must match. Trial/no-trial wording follows store eligibility; no default trial badge, fake discount, invented savings or countdown. Purchase never shows success before protected server confirmation, including V2 grace requirements where applicable.

On web: verified status, value description and management information, **no native purchase/restore-store button**. Status refresh is not restoration of a store transaction. On missing configuration/offline: named recovery and honest availability, no dummy plans/prices. User-cancel returns calmly; pending confirmation disables another purchase, preserves status/restore routes and warns not to repurchase. Price-changed state reloads/reviews store terms rather than trapping the action. Restore on another account must not transfer ownership.

## S11 Onboarding — replace current one-screen presentation

Three approved illustrations with independent localized DOM text; skip and language visible from slide one, progress “1 of 3”, explicit next/back. Each has one message, not a feature wall. The third leads to account choice or local continuation, never a forced paywall. Exact copy and the Google gating are in [Onboarding/Auth/Paywall](ONBOARDING_AUTH_PAYWALL.md). Returning users do not lose records or get trapped in onboarding after an app update.

## Action glossary — proposed EN / UK / RU

This is review-ready UI copy, not a claim that the catalogs were updated. Add keys to the existing localization structure in future work; do not hardcode English in artwork. Native-speaker review remains necessary. Labels distinguish opening an entry form, saving, sharing and sending to a provider.

| Intent | EN | UK | RU |
| --- | --- | --- | --- |
| Home primary, missing | Check in today | Оцінити самопочуття сьогодні | Оценить самочувствие сегодня |
| Home primary, saved | Edit today's check-in | Змінити сьогоднішню оцінку | Изменить сегодняшнюю оценку |
| Open symptom form | Add symptom | Додати симптом | Добавить симптом |
| Commit check-in | Save check-in | Зберегти оцінку | Сохранить оценку |
| Commit symptoms | Save symptom entry | Зберегти запис симптомів | Сохранить запись симптомов |
| Advanced disclosure | Add details | Додати подробиці | Добавить подробности |
| Follow-up | Add follow-up | Додати оновлення стану | Добавить обновление состояния |
| Commit follow-up | Save follow-up | Зберегти оновлення стану | Сохранить обновление состояния |
| Episode creation | Create episode | Створити епізод | Создать эпизод |
| Episode commit | Save episode | Зберегти епізод | Сохранить эпизод |
| Context conversation | Discuss selected records | Обговорити вибрані записи | Обсудить выбранные записи |
| Inspect context | Review sources | Переглянути джерела | Просмотреть источники |
| Send AI request | Send message | Надіслати повідомлення | Отправить сообщение |
| Explicit failed retry | Retry as a new attempt | Повторити як нову спробу | Повторить как новую попытку |
| Selected export | Export selected records | Експортувати вибрані записи | Экспортировать выбранные записи |
| Full export | Export my data | Експортувати мої дані | Экспортировать мои данные |
| Account sign-in | Sign in | Увійти | Войти |
| Signup | Create account | Створити акаунт | Создать аккаунт |
| Guest | Continue on this device | Продовжити на цьому пристрої | Продолжить на этом устройстве |
| Google, only when ready | Continue with Google | Продовжити з Google | Продолжить с Google |
| Review comparison | View 90-day comparison | Переглянути порівняння за 90 днів | Посмотреть сравнение за 90 дней |
| Actual native purchase | Subscribe with Google Play | Оформити підписку в Google Play | Оформить подписку в Google Play |
| Store restore | Restore purchases | Відновити покупки | Восстановить покупки |
| Store management | Manage in Google Play | Керувати в Google Play | Управлять в Google Play |
| Generic refresh avoided | Check subscription status | Перевірити статус підписки | Проверить статус подписки |
| Navigation | Home / History / Companion / Settings | Головна / Історія / Companion / Налаштування | Главная / История / Companion / Настройки |

“Record”, “Start”, “Continue” and “Refresh/restore access” without a clear object should not label unrelated outcomes. For onboarding, “Next” is acceptable with visible slide progress; a store purchase action must explicitly mention the store/subscription. Source and billing strings remain truthful when translated.
