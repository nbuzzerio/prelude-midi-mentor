# Prelude UX/UI audit — 6 November 2026

Application version: **2.9.24**. Companions: [application correctness, efficiency, and architecture audit](2026-11-06-application-audit.md) and [prioritized implementation backlog](2026-11-06-prioritized-backlog.md). Updated with a second audit pass in the same review session.

This document proposes product improvements; none were implemented. It combines current source review, targeted jsdom component probes, and selected historical QA screenshots. Fresh browser access was unavailable and opening Brave was rejected by automatic approval review. Consequently, executed component behavior and source-backed interaction findings are distinguished from visual hypotheses and proposals that need browser, assistive-technology, or user testing.

## Overall direction

Prelude's strongest asset is its musical depth. Its main UX challenge is helping a learner find and complete one musical task without understanding the application's internal feature map, storage formats, or implementation history.

Keep standard musical terminology, independent practice engines, explicit microphone/MIDI permission, and honest feedback about what was actually assessed. Improve the entry points, hierarchy, interaction consistency, and recovery around those capabilities. A cosmetic redesign alone would leave the most consequential friction intact.

The recommended sequence is:

1. Repair keyboard/modal behavior, inoperative controls, and misleading save states.
2. Make the current task, input requirement, and next action obvious.
3. Surface saved music and today's practice directly.
4. Improve portrait-phone piano input and piano-distance readability.
5. Introduce shared visual/control conventions incrementally.
6. Validate the broader navigation/onboarding proposals with representative users before replacing the current shell.

## Findings with current-source evidence

### U1 — High: Print options do not behave like a modal

`src/features/staff-builder/components/staff-builder-print-options.tsx:19` declares `role="dialog"` and `aria-modal="true"`, but does not move focus, contain Tab navigation, make background controls inert, or handle Escape. `staff-builder-print-flow.tsx` adds none of those behaviors.

In Study View, the parent installs unconditional Escape-to-exit behavior (`staff-builder-study-view.tsx:32–40`). An Escape intended to dismiss print options can therefore exit Study View. This is source-confirmed; the exact browser interaction was not reproduced here.

**Recommendation:** use the established native-dialog pattern from Download/Export Settings. Focus a meaningful title or first control, keep Tab/Shift+Tab inside, close only the topmost overlay on Escape, and return focus to the opener. Give long print options a viewport-height limit and internal scroll; the current `.staff-builder-print-options` rule lacks these protections (`src/index.css:504`).

**Acceptance:** open from both library and Study View; immediately Shift+Tab; Tab through all controls; Escape once; confirm Study View remains and focus returns to Print. Repeat at phone landscape height and 200% text zoom.

### U2 — High: Report dialogs have an initial backwards-focus gap

`practice-session-print-report.tsx:23–30` and `piece-practice-results.tsx:109–120` initially focus a heading but wrap Shift+Tab only from the first form control. The heading is outside that control list. Immediate Shift+Tab can therefore leave the intended dialog boundary. These custom dialogs lack native modal background inertness.

**Recommendation:** standardize a proven dialog primitive/pattern with initial heading support, Escape isolation, background inertness, and focus return. This is a narrowly shared presentation concern; it does not justify merging feature workflows.

**Acceptance:** test the initial focus state as well as first/last controls. Existing control-loop tests are insufficient. Verify the actual browser focus sequence and screen-reader reading order.

### U3 — Medium: Two modes expose a checkbox that cannot change

Free Play (`freeplay-session.tsx:285`) and Sequences (`sequence-session.tsx:870`) pass `false` and no-op handlers to “Replay completed chords.” `instrument-volume-control.tsx:67` displays the checkbox unless explicitly hidden.

**Recommendation:** use the existing `showReplayCompletedChords={false}` capability in these modes. This removes an inoperative control; it does not introduce new replay behavior. The “correct answer” description is also inappropriate in ungraded Free Play.

**Acceptance:** checkbox absent in unsupported contexts, working unchanged in supported contexts, volume still available and labeled.

### U4 — Medium: Retained legacy sessions can create duplicate audio-control IDs

The active legacy V1 Practice Session host remains mounted while hidden (`App.tsx:245`). Shared controls default to fixed `instrument-volume` and `feedback-volume` IDs (`instrument-volume-control.tsx:42,54`; `feedback-volume-control.tsx:21,33`). Entering a standalone mode can render another copy.

**Recommendation:** generate per-instance IDs, preserving deliberate overrides only when necessary. A visible label should never resolve to the earlier hidden control.

**Acceptance:** run a legacy V1 Flashcards/Sequences/Ear Training exercise, switch to a standalone mode, and inspect unique IDs, accessible slider names, and label focus. This finding is intentionally limited to retained V1 runtimes; V2 hosts gate their engine rendering differently.

### U5 — Medium/high: Primary action contrast needs correction and verification

Many current controls use white text on `bg-sky-500`, including selected mode buttons (`App.tsx:123`), Ear Training playback (`ear-training-card.tsx:31`), and lesson actions. The audit's fresh production CSS confirms the token `oklch(68.5% .169 237.323)`. An analytical conversion with simple sRGB clipping gives approximately RGB(0,166,244), with white-text contrast around **2.71:1**.

This is an estimate from a compiled artifact, not a fresh browser measurement; gamut mapping can differ. It strongly supports checking the actual emitted controls. Several newer Improv buttons already use darker sky tones.

**Recommendation:** define one readable primary-action color and use measured foreground/background pairs. Set a design target of at least 4.5:1 for ordinary text. Check muted helper text too, especially `text-white/40`. Preserve separate shape/text indicators for correct, incorrect, warning, selected, and disabled states.

**Acceptance:** actual computed colors for default/hover/focus/selected states, text over translucent panels, and focus outlines. Do not claim accessibility conformance from a token calculation alone.

### U6 — Medium/high: The virtual piano is difficult to traverse and touch

`piano-keyboard.tsx:131–132` defaults to MIDI 36–84: **49 focusable keys**, including 29 white keys. Every key is a regular Tab stop (`:203,278`). The full range is distributed over available width (`:172–176,257,331`). At 320px before padding, a white key is about 11px wide and a black key about 7px. Responsive containment does not make those targets easy to play.

**Recommendation:** provide one keyboard Tab entry with Left/Right/Home/End navigation and accessible names such as “C4, MIDI 60.” Preserve multi-note selection and existing pointer/momentary semantics. On narrow touch devices, offer a usable octave window with octave controls or a deliberately scrollable keyboard with minimum key widths. Keep full-range reference available on desktop.

**Acceptance:** selecting a triad without a mouse; leaving the keyboard with one Tab; octave navigation; multi-touch release/cancellation; portrait/landscape phone testing. Explain toggle-versus-held behavior where it differs; do not silently change musical input collection.

### U7 — Medium: Mobile Play and browser fullscreen can diverge

`use-mobile-play.ts:84–159` manages explicit entry/exit but does not observe `fullscreenchange`. Browser Escape can exit fullscreen while app state remains Mobile Play. Several modes also hide/remove the entry control without moving focus to the new playing surface.

**Recommendation:** explicitly define browser-exit behavior, synchronize state where appropriate, and move/restore focus on entry/exit. Remember that Mobile Play must still work when fullscreen or orientation locking is denied; fullscreen availability must not become a prerequisite.

**Acceptance:** browser Escape, app Exit, denied/fullscreen-unsupported contexts, orientation changes, pending permission completion after exit, held pointers, and return focus. This is a lifecycle enhancement requiring cross-mode review.

### U8 — Medium: Global update notices can obstruct active work

`app-update-notices.tsx:19` fixes a notice in the lower-right corner at z-index 100, above Mobile Play, Study View, and custom print options. Historical Improv screenshots show the compact notice overlapping content at 320px. Current obstruction has not been freshly measured.

**Recommendation:** during active playing, use a compact status affordance outside essential music/input controls, or reserve space. Keep deliberate Reload and Later behavior. Never force refresh while temporary recordings, unsaved music, or performance evidence exist.

**Acceptance:** each active practice surface and dialog at narrow widths and short heights; update ready during capture; later/reopen focus; no hidden primary action.

### U9 — Medium: Validation and connection feedback is inconsistent

- Staff Builder tempo input silently restores the previous value for invalid edits (`staff-builder-tempo-control.tsx:17`). Preserve the entered value and explain the integer/range requirement inline; keep Escape as deliberate cancellation.
- MIDI connection errors/status use a changing button label and ordinary paragraph (`midi-status.tsx:45–77`). Add appropriate status/error announcements when focus is elsewhere.
- Legacy Weekly Plan validation inserts an IssueList without focused error summary/live announcement (`weekly-practice-import-dialog.tsx:12–16,31–34`), unlike the V2 alert treatment. Give users a clear route from summary to offending input.

**Acceptance:** keyboard submission of invalid values, retry, screen-reader announcements without repetition, and successful correction. Do not announce rapidly changing pitch readings continuously.

### U10 — Verification risk: Staff descriptions need real assistive-technology testing

The shared MusicStaff has meaningful text in `aria-label` on a generic div (`music-staff.tsx:175`). Tests query that label while mocking rendering. This does not prove how a screen reader exposes the actual VexFlow SVG. Staff Builder's separate semantic score descriptions are a stronger local precedent.

**Recommendation:** verify exposure with actual assistive technology, then choose an explicit image/group role or semantic text alternative and hide purely decorative SVG internals appropriately. Retain correct note spelling, octave, clef, and context. Avoid announcing the answer automatically in modes intentionally testing note recognition; accessibility presentation must respect the exercise's learning objective. Keep user-requested accessible musical descriptions available and determine an appropriate equivalent learning task with assistive-technology users.

This is not a claim that all notation is inaccessible. Validation requires a musical-accessibility decision as well as a technical one.

### U11 — Enhancement: Preserve setup and meaningful location

Top-level location is React state defaulting to Free Play (`App.tsx:25–40`). Most standalone features unmount on navigation; their settings return to initial state on re-entry. Browser Back does not traverse Prelude's modes and a reload cannot restore a meaningful mode URL.

**Recommendation:** persist each feature's last-used setup or offer explicit presets/resume, and later introduce durable route/history state with guarded departures. Do not retain every active audio/input engine merely to keep preferences. Existing independent mounting and retained-session contracts are deliberate and tested.

**Acceptance:** configure a task, visit Tuner, return; reload a bookmarked destination; Back/Forward during active/unsaved work; focus lands at the destination's meaningful heading. Keep performance evidence distinct from navigation preferences.

### U12 — Enhancement: Practicing saved music should not require finding authoring tools

Piece Library, Study View, Piece Practice, and Practice Rolodex are entered through Staff Builder (`staff-builder-session.tsx:99`, `staff-builder-library.tsx:62–70`). “Staff Builder” communicates creation, not playing existing repertoire.

**Recommendation:** add direct Piece Library and Rolodex entry points that reuse existing owners. Keep “Edit in Staff Builder” explicit. A small navigation improvement can test discoverability before a full shell redesign.

**Acceptance:** a new user can find a saved piece, practice it, save a difficult passage, and return to that passage without being taught the internal feature names.

### U13 — Enhancement: Guided practice needs a usable first-run path

Start Today's Lesson becomes available only after a suitable saved program is selected; the empty state directs the user toward importing one (`practice-program-library.tsx:171–175`). The import description leads with “Schema 2” (`practice-program-import-dialog.tsx:44`) and the AI guide requires a copy/paste/JSON round trip.

**Recommendation:** offer a previewable starter lesson/program using existing engines and conservative settings, alongside advanced importing. Show input requirements before setup. Do not make an AI service or account necessary for a first successful exercise.

V1 already sits in a collapsed legacy section. Do not redesign on the false premise that both versions have equal prominence. Improve naming and explain outcomes while preserving both storage/execution contracts.

### U14 — High: A failed or stale legacy import can erase a newer source draft

**Executed current React component in jsdom.** `src/features/practice-session/components/weekly-practice-import-dialog.tsx:32–36` replaces the source after an unfenced file read and explicitly clears it on failure. The textarea remains editable while reading. Two separate probes confirmed:

- Select deferred file A, type newer source B, then resolve A: A replaces B.
- Paste a source draft, then select a 262,145-byte file: the 262,144-byte preflight limit rejects it and the existing draft becomes empty.

This is distinct from A4's whole-library overwrite: here the importer itself loses unsaved text before any successful import. Preserve the current draft on failure and fence earlier reads against later selection, edits, and closure. V2 already demonstrates generation-fenced reading.

Acceptance: failed/oversized reads preserve prior text; editing or choosing B invalidates pending A; closing/reopening cannot receive A's result; status identifies which file was rejected. Add these cases to the current four importer tests. The probes used synthetic deferred reads and memory-only state; they do not establish browser-specific file-picker behavior.

### U15 — Medium copy/lifecycle improvement: “Cancel” still means Close after a program save starts

`practice-program-import-dialog.tsx:35–47` keeps Cancel available after Save starts, while the requested transaction continues. `practice-program-library.test.tsx:66–70` explicitly protects completion after closure. This is an intentional durable-save contract, **not an unauthorized-save defect**.

Once saving begins, label the action “Close” and explain that saving continues. Let the owning library reconcile success/failure even after the dialog closes. Before Save starts, Cancel can retain its current meaning. Do not suggest that closing rolls back a committed or in-flight transaction.

Acceptance: close during delayed success and delayed failure; reopen while pending; no duplicate save; clear library status; no stale dialog callback. Keep actual transaction acknowledgement as the source of truth.

### U16 — Medium: Filtering out a changed Rolodex row loses keyboard focus

**Executed current library component in jsdom with an in-memory store.** Under the default Active filter, focus Pause, activate it, and complete save/reload: the paused row disappears and `document.activeElement` becomes `BODY`. The announcement only says “Passage updated locally.” Source: `src/features/piece-practice/rolodex/rolodex-library.tsx:31,59–68,78–80,113–119`.

Move focus to the next suitable row or list heading when the focused item leaves the filter, and announce the concrete result: “Passage paused. Find it under Paused.” Provide a visible route to that filter. Existing editor-return and suggestion-dismissal focus handling in the same component offers a local precedent.

Acceptance: pause/archive/resume under each applicable filter; first/middle/last/only row; save failure; keyboard focus remains useful after completion. The probe used the real library/model but stubbed unrelated Editor, Practice, and Download children. This proves DOM focus behavior in that setup, not a screen-reader outcome; verify announcements with assistive technology.

### U17 — Medium semantic clarification: Melody's “mastered” status describes pitch only

**Executed, intentional current criterion.** `melody-continuous-practice.ts:98–102` marks a trial mastered after any pitch-perfect result. `melody-pedal-result-action.ts:3–11` does not require timing success. The timed review labels this “Currently mastered,” “Mastered through repair,” and “All diagnostic trials mastered” (`components/melody-timed-session-review.tsx:192–200,230`).

For the actual default seed-3 exercise, playing its two correct half-note attacks 600 ms late produced Pitch 100%, Timing 0%, no extras or misses, and `mastered = true`. This is not evidence that the pitch calculation is wrong. It shows that an unqualified mastery label can imply a broader achievement than the criterion supports.

Prefer language such as “Pitch-perfect at least once” and “Pitch repaired,” or put the pitch-only scope immediately next to the status. Keep the independent Timing and Movement evidence visible. Changing what counts as mastery or how the pedal routes to the next action is a separate product/music decision.

Acceptance: pitch-perfect/timing-poor result, successful repair after an imperfect original, and mixed diagnostic sessions all explain exactly which evidence earned the status; original evidence remains unchanged.

## Proposed navigation and task model

This is a presentation hypothesis to test, not a recommendation to merge engines or move feature-owned settings into global state.

| Destination | Existing capabilities it exposes | Primary task |
| --- | --- | --- |
| Today | Today's Piano Lesson, preferred program, resumable work, due passages | Start or resume today's practice |
| Practice | Flashcards, Sequences, Ear Training, Melody, Piece Practice entry | Choose a musical skill and practice it |
| My Music | Piece Library, Study View, Practice Rolodex | Practice, study, or manage saved music |
| Play & Create | Free Play, Improv, Staff Builder | Explore, record, or author music |
| Tools & Settings | Tuner, MIDI Diagnostic, exports, shared audio, help/build details | Prepare the instrument and troubleshoot |

On desktop, use labeled groups or a modest sidebar rather than making every feature look equally primary. On mobile, test four main destinations plus a clearly labeled More/Tools entry. Preserve existing feature names inside groups and offer an experienced user's preferred landing destination.

A lower-risk first step is simply to add Today and direct Piece Library/Rolodex shortcuts, then move build details and diagnostics to a utility area. Measure whether users find the right activity before undertaking route restructuring.

### Suggested first-use choices

| User intent | Immediate next step | Required clarity |
| --- | --- | --- |
| I have a MIDI piano | Connect, select/check input where required, choose task | Connection and verified note receipt are different states |
| I want to try without equipment | Open an immediately playable virtual-key activity | Explain held/toggled notes and touch limitations |
| I want to practice my own music | Piece Library: example, Create, Import | Saved locally; what import accepts; where Practice appears |
| I want to tune violin/ocarina | Open Tuner with explicit Start Listening | Tuner is separate from graded acoustic Piece Practice |

Do not request microphone access as part of generic onboarding. Keep permission at the moment it is needed. Continuous tempo's explicit selected-input/test-note flow is a strong existing pattern; preserve its verification gate.

What's New currently shows only the newest release to a fresh user, with Close and Escape available. Returning users with a recognized older marker can receive multiple later entries. This is not a first-run full-history bug. A welcome/action path for newcomers and collapsed older updates for returning users are optional improvements.

## Practice-screen hierarchy

Across modes, organize presentation into three clear states without unifying their logic:

| State | Dominant information | Primary action | Secondary information |
| --- | --- | --- | --- |
| Setup/Ready | Skill or piece, input readiness, range/key/tempo, what is assessed | Start / Play Prompt / Begin count-in | Advanced settings, explanations, examples |
| Playing | Readable notation or prompt, current progress, concise feedback | Mode-appropriate play/answer; Stop/Pause reachable | Configuration tucked away; persistent warnings when action is needed |
| Review | What happened, one useful repeat target, truthful save status | Retry / Repeat passage / Next exercise | Detailed evidence, exports, diagnostics, limitations |

Preserve differences: Free Play is ungraded; Ear Training should not reveal answers; pitch-first waits for correct input; continuous tempo plays through mistakes; Improv insights describe possibilities rather than correctness.

At piano distance, prioritize staff size and stable control placement over dashboard density. Avoid moving the score or primary action when status text changes. Keep active recording, unsaved audio, save failure, capture limits, and required input verification visible; these affect what the user should do now.

## Mode-by-mode improvement opportunities

| Area | Preserve | Improve next | How to evaluate |
| --- | --- | --- | --- |
| Free Play | Immediate notation, ungraded exploration, theory-aware spelling | Remove dead replay control; retain notation preferences; improve narrow keyboard | Play a chord, release it, change key context, return after visiting Tuner |
| Flashcards | Fast answer loop and accurate spelling | Put current target/feedback ahead of setup; clear retry versus next-target cues; keyboard ergonomics | First correct note without instructions; no accidental extra answers after transition |
| Sequences | Ordered validation and whole/current-measure views | Fix generator safety first; simplify configuration disclosure; remove dead replay control | Configure scale/arpeggio, understand direction, find current step |
| Ear Training | Explicit prompt playback, standard interval labels | Strong replay affordance and clear audio-failure recovery; consistent answer focus | Replay, answer wrong, retry, continue using keyboard only |
| Melody | Count-in, stable reading and hands-free continuation | Keep preparation/playing/review states visually distinct; preserve staff geometry under feedback changes | Actual piano at 1280×800, timing/cursor comfort, pedal continuation |
| Staff Builder | Capture then rhythm correction; structural validation | Better beginner entry, clearer save versus validated state, modal repair, less action-dense library | Create four measures, correct rhythm, validate, save, reopen |
| Piece Practice | Expected/actual distinction, targeted repetition, explicit input limits | Direct library entry; consistent setup/review layout; durable-save and conflict recovery | Practice existing music and repeat one weak passage without reconfiguring |
| Continuous tempo | Verified physical input, meter-aware preparation, pitch/timing distinctions | Input compatibility visible early; stable full-staff reading; actionable results | Real MIDI onset/timing and disconnected-input recovery |
| Practice Rolodex | Frozen source context, retention provenance, conservative qualification | Direct discovery; due/last-practiced/priority scan; clear eligibility | Save passage today and locate it tomorrow |
| Practice Sessions | Existing guided lesson and retained work | Starter program; task-oriented naming; reduce schema/revision language in ordinary flow | First-run lesson without external help, then independent program import |
| Improv | Explicit capture/replay, First-Take identity, bounded evidence, conservative insights | Lead review with listen/select/repeat; reduce prose density via disclosure; keep caveats attached to relevant claims | Find a repeated figure and replay it without interpreting coverage as probability |
| Tuner | Clear note/cents, stale reading distinction, local audio handling | Idle performance fix; concise readiness and failure status | Real single-note input, denied mic, silence/stale transition |
| MIDI Diagnostic | Detailed raw inspection and bounded capture | Place in utilities; simple entry explanation and copy-result path | Diagnose one disconnected/wrong input without distracting normal practice |
| Exports/Settings | Native dialogs, deliberate downloads, truthful PDF naming | Explain scope of settings; consistent success/cancel states; backup discovery | Cancel/save/download, denied folder access, reopen without surprises |

## Visual system and copy

### Shared visual conventions

- **Actions:** one primary button per immediate decision; secondary outline/neutral actions; visibly separate destructive actions. In a library row, make Practice dominant and place Rename/Duplicate/Delete/Export in a clearly labeled secondary menu where usability testing supports it.
- **Text:** readable body/help text, predictable heading hierarchy, shorter line lengths for dense explanations, tabular numeric feedback. Avoid hiding essential context in faint text.
- **Spacing:** use a small shared spacing scale. Reduce nested bordered panels where grouping is already obvious; keep the notation area visually dominant.
- **Focus:** one visible focus convention across buttons, sliders, disclosures, and score interaction. Never remove outlines without an equivalent replacement.
- **Touch:** prefer comfortably separated targets; 32px editing controls in current narrow Staff Builder CSS need real phone testing. Key width matters as much as height.
- **Motion:** preserve existing reduced-motion handling and keep animation subordinate to musical timing. A moving cursor must not be the only indication of position.
- **Status:** pair color with text/symbols. Consistently distinguish Saved locally, Unsaved changes, Saving, Save failed—retry, and Temporary audio.

A shared control vocabulary is worthwhile. A large generic component framework or global style rewrite is not needed to achieve it.

### Lead with practical consequences

| Current style/example | More useful lead | Keep in details |
| --- | --- | --- |
| “Import a schema-2 definition” | “Import a weekly program” | Schema/version requirements |
| “Legacy Practice Sessions (V1)” | “Older saved practice presets” | Compatibility and version explanation |
| Internal acknowledgement/write terminology | “Results are not saved yet. Keep this tab open and retry.” | Exact persistence/diagnostic evidence |
| Long algorithmic selection description | “Due passages appear first, followed by music you have practiced less recently.” | Full ordering and tie-break rules |
| Dense Improv evidence before exploration | “Explore a passage, then replay it.” | Coverage formula, controller uncertainty, all alternatives |

These are copy directions, not exact approved replacement strings. Do not replace correct musical terms with inaccurate simplifications. Do not remove a limitation that changes the meaning of an analysis or grade. For example, Improv's scale coverage must remain visibly distinct from confidence in a key, and microphone pitch cannot establish finger placement.

## Responsive and accessibility acceptance matrix

| Context | Tasks to perform | Pass criteria |
| --- | --- | --- |
| Keyboard only | Navigate all destinations; configure; play/select; open/close every overlay | Predictable order, no lost focus/traps, visible focus, nested Escape correct |
| Screen reader | Hear task context, input status, staff alternative, errors, result/save state | Accurate names and relationships; no duplicate-ID ambiguity; no high-frequency announcement flood |
| 320/375px portrait | Find mode, use virtual keys, open settings/import, inspect results | Usable touch targets; deliberate local scrolling; primary actions reachable |
| Phone landscape/short height | Start/exit Mobile Play, open print/download options | Dialogs scroll; no clipped controls; safe-area handling |
| 200% text zoom | Setup, practice, review, long titles/errors | Reflow preserves actions and context without overlap |
| 1280×800 at piano distance | Connect, start lesson, read score, use pedal/next action | Legible notation, stable geometry, minimal reaching |
| Unsupported/denied input | MIDI unavailable, microphone denied, fullscreen rejected | Explain available alternatives; no dead-end setup |
| Offline/update | Open cached features, revisit saved music, receive update | No forced reload; visible recoverable failure; no obscured playing controls |
| Storage failure/conflict | Failed save, full storage, two-tab changes | Truthful state, retry/export path, no silent loss |

The current automated suite is valuable, but jsdom label queries and mocked SVG/audio do not establish these browser/device outcomes. Reuse selected existing QA journeys in a maintained smoke suite rather than writing tests that simply assert class names.

## User research and success measures

Run a small formative study with a novice keyboard learner, a returning MIDI user, a teacher/author, and an acoustic-instrument user. Include keyboard-only or assistive-technology participants where possible. This is a way to uncover task failures, not a statistically representative conversion study.

Give tasks without teaching navigation: play a first exercise; find and practice saved music; save a difficult passage; reopen it later; create/correct a short score; recover from an input or save failure. Observe where users hesitate and whether the displayed feedback matches their interpretation.

Measure a baseline before redesigning:

- Time and actions to first played/scored note.
- Time and actions to resume a known task.
- Unprompted discovery of Piece Practice and Rolodex.
- Completion of first import and recovery from a malformed file.
- Accidental exits, repeated configuration, and uncertainty about whether data is saved.
- Keyboard-only task completion and touch mis-selection.
- Ability to explain what a score/insight actually measures.

No numeric improvement claim is made here. Prefer direct observation/local QA initially; introducing analytics or cloud services is a separate product/privacy decision.

## Suggested delivery sequence

| Phase | Deliverable | Size/risk | Review gate |
| --- | --- | --- | --- |
| 1 | Modal/focus repair, dead controls, unique IDs, contrast | Small focused changes; shared controls can affect several modes | Browser keyboard/zoom and accessible-name checks |
| 2 | Virtual keyboard/mobile lifecycle and validation feedback | Medium interaction work | Phone plus assistive-technology acceptance |
| 3 | Direct library/Rolodex shortcuts and clearer language | Moderate presentation change | Task-discovery study |
| 4 | Starter lesson and remembered setup | New behavior; explicit plan required | Musical defaults, input compatibility, persistence approval |
| 5 | Navigation/history and broader visual consistency | Larger cross-mode work | Departure guards, retained-session behavior, migration/navigation testing |

Pair all phases with the data-safety fixes in the application audit. An attractive “Saved” state is only useful when persistence actually guarantees it.

## Historical visual evidence inspected

These files were already present under ignored `.dev` and were not generated by this audit. They are local evidence, not portable tracked assets or current-build verification:

- `.dev/bundle-freeplay-cold.png` — explicitly shows v2.9.18; useful for staff/keyboard/nav hierarchy only.
- `.dev/qa-runs/improv-insights-7oqrsB/insights-1366.png` and `insights-320.png` — desktop/narrow information density and update-overlay placement.
- `.dev/qa-runs/rolodex-d-CtgoEi/screenshots/enabled-overview-1366x768.png` and `enabled-overview-320x768.png` — older lesson setup with expanded repertoire settings. Expanded details are not evidence of the default collapsed layout.
- `.dev/qa-runs/rolodex-d-CtgoEi/screenshots/native-results-1366x768.png` — older result hierarchy and terminology.

Historical overflow, control placement, and visual dimensions were not promoted into claims of a current regression without source support. Physical readability, exact computed contrast, and present-day responsive behavior remain acceptance work.

