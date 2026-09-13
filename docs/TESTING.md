# Prelude: MIDI Mentor — Testing

> **Status:** v2.6.5 Staff Builder Lyric Cues authoring, Study View printing, and measure deletion prepared, ahead of the repository owner's manual deployment and tag

The current automated baseline is 1,934 passing tests across 168 test files. The complete `pnpm verify` workflow covers ESLint, TypeScript, the automated suite, and the production/PWA build. Final Practice Session interaction and presentation QA occurs after deployment on the Chromebook/tablet; broader physical MIDI, browser, responsive, accessibility, fullscreen/orientation, and offline validation remains useful ongoing QA where relevant.

> **Latest repository tag:** v2.5.0
> **Last updated:** September 12, 2026

## Purpose

Prelude's tests should provide confidence in its musical rules, practice behavior, and release stability without becoming brittle or duplicating implementation details.

Testing should also make the codebase easier to understand and safely extend.

## Testing Philosophy

- Test behavior and musical rules rather than internal implementation.
- Prioritize pure functions before React hooks or components.
- Prefer small, deterministic tests.
- Test random generators through constraints and invariants.
- Mock randomness only when a specific branch must be controlled.
- Avoid exporting private helpers only for testing.
- Avoid broad snapshots and fragile DOM assertions.
- Do not chase coverage percentage for its own sake.
- Add integration tests only where they provide confidence not already covered by unit tests.

## Testing Stack

Prelude uses:

- Vitest
- React Testing Library
- jsdom (only for hook/component tests)

End-to-end and visual-regression testing are not required for v2.0, but focused browser-level interaction tests are a future opportunity.

The current Vitest and React Testing Library workflow is established and should remain the default testing approach for new features.

## Test Organization

Tests should live near the code they verify using the following naming pattern:

```text
source-file.test.ts
source-hook.test.tsx
```

Tests should be grouped by public behavior and use musical terminology in their descriptions.

## Progress

- [x] Block 1 — Core Practice Logic
  - [x] `src/lib/practice/answer-validation.test.ts`
  - [x] `src/lib/practice/session-stats.test.ts`

- [x] Block 2 — Music Theory
  - [x] `src/lib/music/notes.test.ts`
  - [x] `src/lib/music/note-utils.test.ts`
    - [x] theory root-letter candidates
    - [x] sharp and flat theory spelling
    - [x] B♯ and C♭ octave boundaries
    - [x] unsupported double-accidental rejection
    - [x] `getNoteName`
    - [x] `getNoteOctave`
    - [x] `getFullNoteName`
  - [x] `src/lib/music/generators/triads.test.ts`
    - [x] `getTriadMidiNumbers`

- [x] Block 3 — Configuration and Target Generation
  - [x] `src/data/note-ranges.test.ts`
  - [x] Reviewed `src/types/practice.ts`; no runtime tests required
  - [x] `generatePracticeTarget`
  - [x] `generateTriadTarget`

- [x] Block 4 — Stateful Hooks
  - [x] `useFlashcardSettings`
  - [x] `useFlashcardTarget`
  - [x] `useChordAttempt`
  - [x] `useCorrectAnswerSequence`
  - [x] `useMidi`

- [x] Block 5 — Integration
  - [x] `FlashcardSession`

- [x] Final Review
  - [x] Complete Vitest suite passed
  - [x] Lint passed
  - [x] Production build passed
  - [x] Testing documentation completed
  - [x] Testing methodology documented
  - [x] v1.0 release ready

- [x] Block 6 — Sequence Practice
  - [x] `src/lib/practice/sequence-validation.test.ts`
  - [x] `src/lib/practice/sequence-stats.test.ts`
  - [x] `src/lib/music/generators/sequences.test.ts`
    - [x] interval semitone distances and direction
    - [x] scale and arpeggio generation constraints
    - [x] theory-aware interval spelling regressions
    - [x] repeated generation without unsupported spelling crashes
  - [x] `src/features/sequences/hooks/use-sequence-settings.test.ts`
  - [x] `src/features/sequences/hooks/use-sequence-attempt.test.ts`
  - [x] `src/features/sequences/hooks/use-sequence-target.test.ts`
  - [x] `src/features/sequences/hooks/use-sequence-transition.test.ts`

**Current Result**

- Test files: 137 passed
- Tests: 1,548 passed
- The complete `pnpm verify` workflow passes locally.

## Testing Blocks

### Block 1 — Core Practice Logic

Add the test runner and establish the basic workflow.

Test:

- `answer-validation.ts`
  - exact note and chord matching
  - order-independent chord matching
  - missing, extra, and incorrect notes
  - target MIDI-number extraction

- `session-stats.ts`
  - initial values
  - correct and incorrect updates
  - streak behavior
  - response-time accumulation
  - immutability

### Block 2 — Deterministic Music Logic

Test:

- note names using sharp and flat spellings
- MIDI octave boundaries
- full note names
- triad MIDI numbers for:
  - major
  - minor
  - diminished
  - augmented
  - root position
  - first inversion
  - second inversion

Use table-driven tests where appropriate.

### Block 3 — Target Generators

Test public generator behavior and musical invariants.

Individual-note targets:

- respect the selected clef
- respect natural and accidental filters
- remain inside the clef range
- produce matching MIDI numbers, spellings, octaves, and labels
- reject invalid empty configurations

Triad targets:

- contain exactly three notes
- respect enabled qualities and positions
- remain inside the clef range
- preserve correct chord spelling
- produce correct inversion order
- avoid double accidentals in v2.0
- reject invalid empty configurations

Do not test random distribution. Mock `Math.random` only for targeted branch coverage.

### Block 4 — Stateful Flashcard Hooks

Add hook tests only after the pure suite is stable.

Candidate hooks:

- `useChordAttempt`
  - collects nearby notes
  - completes after the grace period
  - clears and cancels correctly
  - cleans up timers on unmount

- `useCorrectAnswerSequence`
  - schedules feedback and advancement
  - waits for MIDI release when required
  - cancels and replaces sequences
  - avoids stale callbacks

- `useFlashcardTarget`
  - generates and exposes the current target
  - records target start time
  - locks one answer per target
  - unlocks after target generation

- `useFlashcardSettings`
  - preserves at least one enabled option
  - adds and removes selections correctly
  - keeps setting groups independent

Use fake timers for timing behavior.

### Block 5 — Focused Integration Tests

Add only if they provide meaningful confidence after the earlier blocks.

Possible test:

- a controlled virtual-piano answer produces correct feedback and updates session statistics

Avoid a broad `FlashcardSession` test that mocks most of the application.

### Block 6 — Sequence Practice

Test the ordered practice behavior introduced by Sequence Mode.

Current temporal coverage includes 4/4 meter capacity at 480 PPQ, generated quarter-duration conventions, synthetic eighth-note and mixed-duration timelines, cumulative onsets, simultaneous chord steps, exact-barline membership and endings, rejected cross-bar events, and final partial measures. Pure measure-window tests cover first, middle, and final windows plus global-to-local active-index translation.

Presentation and notation coverage verifies current-measure default rendering, `Measure n of m` with authoritative global step progress, presentation-only Whole Sequence toggling and state preservation, supported duration mappings, actual-meter voice configuration, temporal measure division, partial final measures, active styling, simultaneous chords, accidentals, horizontal whole-view behavior, and renderer geometry that keeps the final stave inside its SVG bounds.

Sequence logic:

- exact step validation
- completed-step tracking
- sequence completion statistics
- immutable statistic updates

Interval generation:

- semitone distances
- ascending and descending directions
- natural-note and accidental-note filters
- invalid empty configurations

Sequence hooks:

- required settings remain enabled
- attempt-state transitions
- target locking and regeneration
- MIDI-release-aware delayed transitions
- timer cleanup and cancellation

These tests should verify the public state-machine contracts rather than internal refs or implementation structure.

### Block 7 — v2.0 Music and Free Play

Test:

- theory-aware note spelling for intervals, scales, and arpeggios
- supported sharp, flat, B♯, and C♭ spellings
- deliberate rejection of unsupported double accidentals
- generation invariants across repeated randomized targets
- keyboard visual-mode behavior at the smallest useful layer when practical

Automated tests cover Free Play's music rules and component/renderer contracts. Continue focused manual verification for VexFlow layout, real MIDI interaction, and responsive grand-staff scaling, which are better assessed in the browser than through brittle SVG assertions.

The stale-setting regression is covered: changing an exercise type regenerates a target from the newly selected settings rather than the previous render's state.

### Block 8 — Chord Progressions

Automated progression coverage includes:

- deterministic root-position chord construction
- major, minor, diminished, and augmented chord spelling
- curated progression templates and supported-key realization
- natural-minor roots with explicit major-dominant and diminished-supertonic handling
- exhaustive compatible key/template/clef candidate coverage
- progression-specific range isolation from other Sequence exercises
- protected settings compatibility and target regeneration
- Roman-numeral and concrete per-step chord metadata
- shared chord-attempt timing, cancellation, and unmount cleanup
- physical MIDI rolled and block chord input
- persistent virtual chord selection and toggle removal
- grading and playback at the active step's note count, including variable-size chord compatibility
- statistics, retry, reset, regeneration, Focus Staff, completion, and stale-target cleanup
- Flashcard virtual/MIDI regression protection
- immediate single-note Sequence input for both virtual and MIDI sources

### Block 9 — Free Play Key-Aware Notation

Automated Free Play notation coverage includes:

- exact shared key definitions, stable IDs, labels, modes, tonic spellings, orientations, diatonic scales, and VexFlow signatures
- internal coherence of all 12 supported keys and Chord Progression regression after shared-key extraction
- No Key and named-key notation contexts
- Automatic, Prefer sharps, and Prefer flats chromatic policies
- protection of diatonic spelling from chromatic preference overrides
- MIDI validation across the supported 0–127 range
- enharmonic spelling and written-octave behavior at B/C and E/F boundaries
- duplicate removal, input immutability, and deterministic ascending output
- selected signatures on both treble and bass staves
- signature-relative natural signs and chromatic accidentals with independent stave state
- authoritative written-note accessibility labels
- immediate key and preference respelling while notes remain held
- equivalent physical and virtual MIDI spelling after held-state merging
- held-note preservation and no audio replay during notation-setting changes
- Focus Staff behavior and raw-MIDI virtual-key highlighting
- unchanged Flashcard and Sequence notation and Chord Progression behavior

### Block 10 — Shared Mobile Play

Focused automated coverage includes:

- immediate layout activation independent of fullscreen or orientation success
- missing, rejected, successful, stale, repeated, exit, and unmount browser lifecycle paths
- cleanup limited to fullscreen and orientation acquired by Prelude
- mutual exclusion with Focus Staff, including global Focus Staff activation
- target, statistics, feedback, current-step, held-note, and notation-setting preservation
- graded `onNoteToggle` semantics in Flashcards and Sequences
- Free Play momentary press/release semantics and pointer-note cleanup without clearing physical MIDI
- mode-specific staff scaling with no normal-mode leakage
- common responsive Mobile Play entry markup across supported modes
- removed portrait rotate overlays and singular Free Play/Sequence task-action wrappers
- keyboard-focusable, descriptively labelled Melody practice and result score scroll regions

Melody integration coverage preserves exercise identity, one lazy AudioContext, count-in and clock continuity, recorder/source locking, one keyboard and MIDI owner, results-heading focus, and Retry Same, Try Another, and Settings while Mobile Play remains active.

Current Melody coverage also verifies the two-quarter-beat preparatory display lead-in, timed diagnostic deadlines and interruption, immutable original trial evidence, appended repair retries, Session Review navigation and focus, original-versus-latest comparison, mastery summaries, and separate Sight Read/Repair interval analytics.

### Block 11 — Ear Training and Musical-Event Playback

Automated coverage includes:

- shared interval labels, semitone distances, and diatonic distances
- unchanged Sequence interval generation after shared-domain extraction
- ascending and descending theory-aware Ear Training targets within C4–C6
- required interval and direction settings
- interval-name validation independent of direction
- one incorrect attempt maximum per target and streak semantics
- attempt-hook grading gates, replay lock, duplicate-answer protection, timer cancellation, stale-advancement prevention, and unmount cleanup
- stable unplayed targets, replay, response timing, locking, settings regeneration, reset, and unmount cleanup
- deterministic musical-event offsets, simultaneous notes, durations, completion, replacement, cancellation, playback failure, stale callbacks, and repeated use
- cancellable grand-piano playback handles
- top-level mode switching and Focus Staff suppression
- Ear Training Mobile Play state preservation and accessible status/answer names

### Block 12 — Staff Builder

Automated coverage includes:

- canonical schema v3 score-domain invariants, v1/v2 migration, unsupported/corrupt data, measure context, meter capacity, notes, chords, rests, ties, annotations, and upward arpeggiation
- Capture Notes routing, rhythmic cursor movement, pending input, replacement, and rest insertion
- Rhythm Correction selection, duration, event type, staff, spelling, independent incoming/outgoing pitch-level ties, long chains, partial chord ties, deletion, and score history
- validation, guided corrections, draft persistence, validated Save, and local project recovery
- direct-score `.prelude.json` serialization, schema-validated import, round trips, collision-safe insertion, and accessible library file actions
- full-piece, treble-range, and bass-range duplication with fresh copy identity and source immutability
- deterministic event, measure, position, and piece playback, including silence and partial chords
- playback-follow measure display and sliding highlight without editor-state mutation
- renderer projection and public event, position, playback, and notation-control anchors
- deterministic pointer ownership, tap-versus-drag behavior, and responsive interaction geometry
- Duration, Key, and Time radial controls and their opening-gesture guard
- mobile virtual-keyboard lifecycle, safe-area presentation, and responsive state preservation
- accessible score semantics, direct notation controls, disclosures, and workspace integration
- annotation editing/layers and multi-system Study View layout, semantics, and geometry
- rolled-chord editing, schema validation, notation projection, playback, and accessible descriptions

### Block 13 — Blocking Piece Practice

Automated coverage includes:

- validation-gated projection from authoritative Staff Builder scores without copied persistence or `SequenceTarget`
- score-position grouping across chords, both staves, same-staff polyphony, independent rhythms, rests, and ties
- one aggregated normal check plus independent rolled checks, including mixed and multiple-roll same-onset targets
- exact normal pitch-set grading, tempo-relative upward-roll order/window grading, blocking retries, measure/piece completion, targetless measures, start-at-measure, and restarts
- physical single-note and ordinary 225 millisecond block-chord input, rolled-check expiry scheduling, stale-attempt cleanup, and stable MIDI ownership
- duration-aware authored sounding-span allowances without allowing held notes to satisfy missing attacks; a run started or measure restarted inside a tie chain requires a practice-only boundary reattack while full-piece progression does not
- persistent virtual chord selection and strict MIDI/VKB attempt separation
- read-only score presentation, authoritative multi-event highlighting, feedback, accessibility, and one responsive keyboard
- Staff Builder library eligibility, launch/failure/exit flow, updated-save relaunch, and source/storage immutability
- app-level MIDI connection persistence, token-safe active-feature routing, held-note handoff, idempotent connect, hotplug cleanup, and cross-mode listener stability
- realistic multi-measure 6/8 integration with polyphony, grand-staff chord material, rests, a cross-measure tie, retry, completion, and exit
- ordinary narrow/coarse layouts requiring explicit Mobile Play rather than automatic focus
- Mobile Play preservation of blocking mistakes, current target/measure, original timing, pending physical chord collection, and partial virtual chord selection
- unchanged Restart Measure, Restart Piece, explicit targetless-measure advancement, completion, and distinct Mobile Play/Piece Practice exits
- transient Piece Practice Skip Target advancement without completion credit, including input-state cleanup, mixed normal/rolled onsets, tied spans, measure/piece completion, restart counters, and boundary-only reattack protection
- Staff Builder editor Practice Piece readiness across validation, pending capture, validated-save snapshots, autosave isolation, edit/Undo equivalence, storage failure, and reuse of the existing Piece Practice projection without implicit writes
- exactly one mounted keyboard and input owner before, during, and after focused presentation

### Block 14 — Production and PWA Configuration

Focused automated coverage protects repository-owned release configuration:

- the Vite production base remains `/prelude/` rather than root `/`
- manifest scope and start URL remain aligned with the deployed subpath
- Workbox navigation fallback remains `/prelude/index.html`
- emitted piano WAV assets remain included in the precache glob
- generated service-worker registration remains in auto-update mode

These tests cover stable configuration invariants only. Installed-PWA update behavior, real offline behavior, and browser Web MIDI behavior still require manual validation on representative browsers and devices; Prelude does not have automated browser E2E coverage.

## Intentionally Not Deeply Tested

The initial suite should not deeply test:

- VexFlow's generated SVG structure
- browser audio playback internals
- full browser-level Web MIDI end-to-end behavior
- generated PWA/update/offline behavior beyond focused configuration checks
- GitHub Actions, Nginx, or DigitalOcean deployment
- Tailwind layout details
- random statistical distribution
- implementation-private helper functions
- large snapshots
- coverage percentage targets

These areas are better served by build checks, focused manual verification, or later integration and browser testing.

Prelude does not currently have a full browser Web MIDI end-to-end suite. Installed-PWA updates, navigation fallback, asset availability, and true offline behavior still require a production build plus manual validation on representative browsers/devices.

## Release Verification

Before declaring a release or implementation checkpoint complete, run:

```bash
pnpm verify
```

Use focused manual QA where browser, hardware, audio, or responsive presentation behavior cannot be represented fully in jsdom. Useful areas include:

- physical MIDI connection and note input on real hardware
- block chords and rolls near the 225 millisecond boundary
- sustain-pedal behavior and shared held tones between Sequence steps
- virtual piano note and chord input
- Chromebook mouse and touch behavior for persistent chord selection
- browser audio restrictions and completed-chord playback
- correct and incorrect feedback
- piano and feedback volume controls
- clef, note, triad-quality, and inversion settings
- responsive layouts
- ledger-line readability for progression chords
- Focus Staff entry and exit on real devices
- Free Play key-signature rendering on both staves
- F-natural in G major and B-natural in F major
- B-flat versus A-sharp spelling and sharp/flat preference changes
- simultaneous Free Play notes across both staves
- Chromebook and touch layout for notation controls
- Focus Staff spacing with key signatures
- browser-specific VexFlow glyph and accidental behavior
- browser audio restrictions while changing settings with held notes
- low and high notes placed on the expected staff
- stable blank grand staff when no notes are held
- neutral Free Play key highlighting
- installed PWA behavior
- offline application shell
- production deployment
- Flashcard single-note and triad play while toggling Mobile Play mid-target
- Sequence interval, scale, long-sequence, and chord-progression play while preserving the current step
- Mobile Play and Focus Staff transitions in both directions
- fullscreen and orientation refusal, plus external fullscreen exit while the layout remains active
- Flashcard, Sequence, and Free Play staff scaling on a phone
- Free Play two- and three-finger multitouch, cancelled touches, and stuck-note checks
- folded and unfolded Z Fold layouts
- Chromebook and tablet landscape layouts
- Ear Training first-prompt browser authorization and recovery after refusal
- ascending and descending prompt timing and pitch quality across C4–C6
- rapid Replay replacement, mode switching, reset, and settings changes during playback
- Ear Training answer-grid touch targets, keyboard focus, and screen-reader announcements
- Staff Builder physical MIDI capture and same-position replacement in treble, bass, and grand routing
- Staff Builder’s browser-local pedal Lock preference: default/read/write/error handling, valid capture commit/advance, empty-position advance, invalid-input suppression, pedal-up/repeated-down/stale-enable suppression, and unchanged score/draft schemas
- range-aware Staff Builder notation geometry across ordinary and MIDI-endpoint written pitches, single/grand staves, editor SVG bounds, per-system Study View offsets, ties, and the shared Piece Practice score view
- complete, incoming, and outgoing single-measure VexFlow ties, including middle-chain notes, independently tied chord pitches, untied siblings, enharmonic visible spelling, and Piece Practice boundary measures without grading changes
- event-anchored treble Lyric Cue authoring, history, schema-v3 persistence, import/export, recovery, duplication, dedicated range-safe rendering in editor/Study View/Piece Practice, accessibility semantics, and unchanged practice targets
- sequential Lyric Cues pass behavior, ambiguity handling, shared cursor/pedal entry, browser-native print ranges, selected-system rendering, and immutable measure deletion with tie/annotation/history reconciliation
- shared automatic beaming for simple and 6/8 meters, including eighth/sixteenth/mixed runs, beat boundaries, real rests, GhostNote offsets, genuine gaps, and independent derived voices
- discoverable per-pitch Staff Builder enharmonic controls, musical-name accessibility, sharp/flat round trips, chord/tie isolation, key-change retention, score-file persistence, and MIDI-based Piece Practice grading
- Staff Builder on Chromebook mouse and touch, including direct notation targets and tap-versus-swipe behavior
- Android portrait and landscape layout, folded/unfolded devices where available, and the mobile keyboard sheet
- radial Duration, Key, and Time control reachability, touch ergonomics, focus return, and edge clamping
- direct event, rhythmic-position, clef/brace, key, and time taps at responsive score scales
- audition, measure, from-here, and piece playback, Stop, and the sliding playback highlight
- rests, ties, partial chords, trailing silence, key/time changes, Undo/Redo, and guided validation corrections
- local project close/reopen, draft recovery, validated Save, and installed-PWA behavior
- annotations in edit and Study View, multi-system placement, keyboard focus, and screen-reader verbosity
- full-piece, treble-range, and bass-range duplication with the source left unchanged
- authored upward rolled-chord creation, save/reload, export/import, playback, and accessible notation
- Blocking Piece Practice launch from a saved valid piece and disabled-reason behavior for invalid pieces
- physical MIDI single notes, block chords, slightly rolled chords, rapid retries, held tied/sustained notes across later opposite-hand targets, and practice start/restart inside a multi-measure tie chain
- MIDI hotplug/disconnect during practice and clean Staff Builder ownership after exit
- desktop VKB and Chromebook touch chord selection, toggle removal, restart, and source switching
- Android portrait/landscape score readability, keyboard reach, target feedback, safe areas, and exactly one keyboard
- same-staff polyphonic notation/stems with playback and practice attacks aligned; sustained notes must not be re-required
- mixed normal/rolled and multiple rolled chords at one onset, including order, wrong-note, timeout, and tempo-relative window behavior
- rest-only and consecutive targetless measure acknowledgement, Start at Measure, restart statistics, and completion focus
- screen-reader verbosity, expected/missing/extra pitch feedback, disabled Practice explanation, and keyboard focus order
- save, practice, exit, edit, save, and relaunch using the updated authoritative score without practice-progress persistence
- sustain-pedal behavior is not graded in Phase 1 and should be observed as a known hardware/browser limitation
- Melody timed-session expiry/interruption, Session Review filters, original/latest evidence, repeated repairs, next-needs-review, and separate Sight Read/Repair interval reports
- visible and audible alignment of the two-quarter-beat preparatory lead-in without counting it as scored evidence

This is risk-based guidance, not an exhaustive manual-QA gate. Non-blocking issues found during normal use may be recorded through the project's bug-log workflow.

### Mobile UX real-device matrix still required

| Device class            | Highest-risk checks                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 360px portrait          | Compact navigation/header, Free Play and Sequence action flow, keyboard adjacency, safe-area Exit controls                 |
| 390–412px portrait      | Mobile Play entry policy, Ear Training header, Flashcard disclosures/stats, Piece Practice rolled-check actions/completion |
| Phone landscape         | Score/keyboard proportions, horizontal overflow, safe areas, explicit exit without session reset                           |
| Chromebook laptop       | Whole Sequence scrolling, narrow/wide breakpoint behavior, keyboard and mouse focus visibility                             |
| Chromebook tablet/touch | Coarse-pointer Mobile Play entry, touch controls, one keyboard/input owner, physical MIDI handoff                          |
| Android Chrome          | Fullscreen/orientation accepted, rejected, and unavailable paths; Escape leaves Prelude Mobile Play active                 |
| Narrow desktop          | Entry visibility below 1024px, document-flow layouts, keyboard scrolling of Melody score and Session Review regions        |
| Wide desktop            | Mobile Play entry hidden for mouse input, desktop navigation/grouping and headers unchanged                                |

Across the matrix, verify real MIDI attacks and chords, no duplicate input, Sequence Whole Sequence active-step discoverability, Staff Builder Study View/duplication/rolled authoring, Melody lead-in/timed review/repair scrolling and focus, and Piece Practice normal-plus-rolled blocking/restart/targetless/completion controls. This QA has not yet been performed.

## Future Opportunities

After v2.0, consider:

- pure MIDI message parsing tests
- focused audio utility tests
- VexFlow smoke tests
- browser-level MIDI mocks
- end-to-end practice-flow tests
- PWA installation and offline tests
- selective visual regression tests

## Release Verification Baseline

Prelude's automated release baseline is the complete `pnpm verify` workflow. Focused manual QA supplements it where hardware and browser behavior warrants direct observation.

### Automated Verification

The following commands completed successfully against the release candidate:

```bash
pnpm test
pnpm lint
pnpm build
```

The current release-candidate counts are recorded in **Current Result** above; historical counts remain in their original records.

### Manual Verification

The following functionality was also verified prior to the v1.0 release:

- Physical MIDI keyboard input
- Virtual piano input
- Single-note practice
- Triad practice
- Rolled-chord detection and grace timing
- Correct and incorrect answer feedback
- Session statistics
- Clef, note, chord-quality, and inversion settings
- Responsive layouts
- Progressive Web App installation
- Offline application shell

Together, these automated and manual checks establish the release baseline. Future releases should meet or exceed this verification standard before being tagged.


### Feature configuration regression coverage

Feature `*-config.test.ts` suites cover exact defaults, JSON round trips, Set/array boundaries, invalid selections, schema errors, Sequence subtype selections and progression compatibility, and separation of Melody generation settings from timed options. Settings-hook tests cover supplied mount-time prescriptions and stable selections on rerender. Settings-controls tests render editors without an exercise engine or MIDI provider and omit runtime reset actions. Existing session tests remain responsible for target regeneration, reset/statistics, input ownership, Mobile Play, and Melody timed behavior.

For changes to these boundaries, manually check Flashcard defaults and settings; every Sequence subtype and its settings; Ear Training selections; and Melody generation settings plus Continuous Practice setup. Configured first-target launch is covered by the engine contract tests below; Scale Repertoire has additional coverage below.


### Configured engine contract coverage

The Flashcard, Sequence, and Ear Training `*-session-contract.test.tsx` suites exercise real settings, generators, locks, and grading with deterministic randomness. Presentation/audio/input boundaries are substituted so the tests can inspect the first presented target and invoke input without browser MIDI/audio. Coverage includes configured first targets, all Sequence subtypes, stable mount-time config, unchanged standalone starters, no Ear Training autoplay, partial and incorrect input, eventual success, exactly-once notifications, callback replacement, Strict Mode, reset/settings changes, delayed advancement, and unmount. Flashcards also exercises a host replacing a keyed engine directly from triad completion.

For standalone manual regression QA, open Flashcards normally and check its starter, settings, and reset. Exercise each Sequence subtype and check settings, completion, and reset. In Ear Training check explicit playback, guesses, replay, and reset. Existing session/input suites continue covering MIDI, virtual keyboard, audio, and engine-owned Mobile Play behavior; Practice Sessions exercise the configured launch contract through their own host.


### Practice Session preset coverage

The focused Practice Session validation suite covers every engine/config/target family, nested feature-parser delegation, independent schema versions, corrupt and unsupported data, positive and missing numeric targets, Scale Repertoire mode compatibility, timed Melody compatibility, preset-local exercise ID uniqueness, library-wide preset ID uniqueness, ordered and detached parsing, duplicate labels, and stale last-used normalization. Runnable validation coverage distinguishes structurally valid drafts from launch-ready prescriptions and checks concise issues for zero exercises, missing counts, empty repertoires, and non-continuous Melody.

The Practice Session library suite covers immutable create, rename, add, update, remove, reorder, duplicate, delete, and last-used operations. Duplication tests require fresh IDs and detached config snapshots. Storage tests cover the empty default, explicit JSON save/load, order preservation, no writes during load, stale-preference normalization without rewriting, corrupt/unsupported preservation, unavailable storage, failed writes, and refusal to save invalid libraries. There is no Practice Session UI or runtime manual QA in P4.

P5 builder option tests cover all eight human-facing concepts, parser-valid default entries, null numeric targets, Scale Repertoire's marker target, and Melody's config-owned duration. Presenter tests cover concise concept, configuration, and target language. Exercise-editor tests verify direct reuse of controlled Flashcard, Sequence, Ear Training, and Melody settings, temporary numeric draft input, and atomic numeric/repertoire Sequence target transitions.

Builder integration tests cover empty and valid loading, create/edit/reorder/duplicate/remove flows, readiness text, explicit single-write saves, save failure, preset deletion confirmation, and corrupt-storage recovery. Start Fresh coverage requires an absent saved baseline, an enabled empty replacement save, and unchanged original bytes until Save. App coverage keeps Practice Sessions in the local mode navigation and verifies that its builder remains mounted but inaccessible while hidden.

P6 pure reducer coverage checks detached snapshots, deterministic externally supplied identity/time, numeric achievement and uncapped Bonus, explicit Scale Repertoire completion, ordered final-scale events, Skip/Next/End/Finish dispositions, entered-only records, and stale exercise/run callback rejection. Runtime component tests substitute the four engine presentation boundaries to verify one keyed engine, exact initial config, immediate advancement, host progress, and Melody continuation success/failure without remounting.

Builder start tests cover Ready-only launch, current unsaved working presets, clean preference-only persistence, dirty no-write behavior, failed preference writes that do not cancel practice, and recovery-authorized no-write behavior. Engine contract tests verify hosted settings/reset suppression alongside unchanged standalone controls and retained performance actions. Melody review coverage separately preserves repair interactions while hiding Settings and New Timed Session in hosted presentation.

After deployment, create a short Ready preset with count, Scale Repertoire, Ear Training, and one-minute Reading Flow entries on the Chromebook/tablet. Start without an intervening configuration screen; reach one target, use Bonus, then advance. Confirm repertoire progress includes its final scale, Melody waits for its own timed Review, Skip advances neutrally, End produces an entered-only summary, Back restores unsaved builder state, and hosted Mobile Play remains continuous across prescribed exercises. Briefly verify standalone settings/reset and engine-owned Mobile Play remain present.

P7 hosted Mobile Play coverage verifies that the stable Practice Session runtime acquires fullscreen/orientation once, exposes one Exit action, remains the only fixed `.mobile-play-mode` shell, and retains that lifecycle across every four-engine transition. Tests keep one keyed child mounted, distinguish embedded hosted layouts from standalone fixed engine ownership, keep Skip/End/completion/Bonus controls reachable, preserve count and Melody Bonus without remounting, and confirm End/Finish/final Skip cleanup plus summary focus and Back behavior. Explicit Exit retains the active engine and restores focus to the host entry action. Existing hook and engine suites remain responsible for standalone acquisition, cleanup, Focus Staff interaction, Melody audio/timer continuity, Ear Training prompts, and local entry/exit behavior.

The hosted-presentation suite additionally covers independent Practice Session Focus and keyboard visibility state, persistence of both across Next and Skip, unchanged child identity, and no fullscreen/orientation reacquisition while either is toggled. Flashcard, Sequence, and Melody contract coverage verifies that hosted keyboard hiding reclaims its wrapper while physical MIDI behavior and standalone defaults remain intact. Target completion coverage verifies the labelled modal dialog, initial action focus, focus containment, Escape blocking, inert background, still-mounted exercise, reducer-owned progress freeze, same-instance count and Melody Bonus, and unchanged Next/Finish semantics. Final presentation QA is intentionally deferred to the deployed Chromebook/tablet for viewport allocation, touch ergonomics, physical MIDI, fullscreen/orientation, installed-PWA, and safe-area behavior.

Final viewport, safe-area, browser chrome, physical keyboard, and orientation behavior is verified after deployment on the actual Chromebook/tablet. P7 intentionally adds no broad browser/device matrix and preserves the established browser-Escape behavior.


### Scale Repertoire coverage and manual checks

`scale-repertoire.test.ts` checks all 28 catalog identities, exactly 26 selectable entries, disabled G-sharp altered-minor forms, exact 15-note C major and A natural/harmonic/melodic minor sequences, E major and C-sharp melodic minor spelling, and realization of every selectable scale in both clefs. Finite traversal tests check explicit order, deterministic shuffle permutations, no repeats, one completion boundary, fresh cycles, and no advancement from realization.

Sequence config tests cover version 2, explicit rejection of old/unknown versions and unsupported scales, ordered JSON round trips, detached arrays, Random defaults, and empty setup. Session contract tests cover first repertoire target, mount-time props, all-15-notes completion, retry/partial input, exactly-once native/traversal notifications, reset/reorder/mode changes, Shuffle cycles, empty input blocking, and Strict Mode/unmount. Target-hook coverage confirms regeneration cannot advance a traversal and repeated completion calls cannot advance a locked target twice. Settings tests cover 28 visible checkboxes, the accessible disabled reasons, selection/removal, and focus retention when reordering. Card coverage keeps status inside the existing Mobile Play layout.

Manual QA: open Sequences - Scales and verify Random first. Switch to Repertoire - In Order; select C major, A natural minor, A harmonic minor, A melodic minor, and G major. Reorder them, complete one 15-note scale, and verify the next selected scale appears. Try Shuffle and finish a full cycle without repeats. Check G-sharp natural minor is selectable and both altered forms are visible/disabled with the explanation. Reset traversal, clear the selection, then select again. Check Mobile Play retains one keyboard and readable notation/status. Briefly exercise Intervals, Arpeggios, and Chord Progressions. No CI or runner configuration is involved.


### Melody configured launch and timed-target contract coverage

`melody-session.test.tsx` uses the existing seeded generator, controllable audio clock, and animation-frame harness, plus fake interval timers. Coverage checks all configured generation settings/options in the first generator call, unchanged defaults, mount-only props, no pre-Start audio/deadline, and expiration during count-in/performance or between phrases. Completion assertions inspect committed Review and final trial evidence from the callback itself. Tests cover Strict Mode, latest callback delivery, no repeated notification, immediate host continuation/unmount, unfinished unmount, delayed audio startup, Settings cancellation, and fresh timed runs.

Runtime-ref continuation tests retain original and Repair evidence across fresh phrases and Review retries, reject concurrent continuation calls, and confirm that no new countdown or notification appears. Non-continuous results do not notify. Existing review, interval-analytics, recorder, audio, and Mobile Play suites continue guarding their respective feature behavior. Reusable settings controls remain tested independently of the performance engine.

Manual QA: open Melody directly and check standalone defaults; change staff/key/tempo/length and start a phrase (pitch/rhythm difficulty remain the existing easy-only settings). Enable Continuous Practice with a one-minute duration and confirm the countdown starts with the normal Start/count-in. Let the deadline expire during or between phrases; confirm the final phrase/result is retained in Review. Retry a reviewed phrase and check Original versus Latest results. Return to Settings and start again; also try New Timed Session and standalone Mobile Play. Standalone Melody exposes no host continuation button; Practice Session invokes that API through its own Bonus action, as covered by automated host tests.
