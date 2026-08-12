# Prelude: MIDI Mentor — Testing

> **Status:** Post-v2.3 Melody Mode Phase 1 checkpoint (unreleased)

Melody automated coverage includes seeded generation, spelling/ranges, Web Audio timing/cleanup, continuous capture, source locking, dynamic-programming alignment, independent scoring/movement facts, display projection, Pitch-result highlights/details, accessibility, mobile ownership, visibility interruption, app/MIDI integration, and WAV precaching. Manual release QA remains required for physical MIDI, Android/Chromebook interaction, screen readers/reduced motion, and installed-PWA airplane mode.
> **Latest release:** v2.3.0 — Melodic Interval Ear Training
> **Last updated:** August 10, 2026

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

- Test files: 101 passed
- Tests: 1,144 passed
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

- score-domain invariants, measure context, meter capacity, notes, chords, rests, and ties
- Capture Notes routing, rhythmic cursor movement, pending input, replacement, and rest insertion
- Rhythm Correction selection, duration, event type, staff, spelling, ties, deletion, and score history
- validation, guided corrections, draft persistence, validated Save, and local project recovery
- direct-score `.prelude.json` serialization, schema-validated import, round trips, collision-safe insertion, and accessible library file actions
- deterministic event, measure, position, and piece playback, including silence and partial chords
- playback-follow measure display and sliding highlight without editor-state mutation
- renderer projection and public event, position, playback, and notation-control anchors
- deterministic pointer ownership, tap-versus-drag behavior, and responsive interaction geometry
- Duration, Key, and Time radial controls and their opening-gesture guard
- mobile virtual-keyboard lifecycle, safe-area presentation, and responsive state preservation
- accessible score semantics, direct notation controls, disclosures, and workspace integration

### Block 13 — Blocking Piece Practice

Automated coverage includes:

- validation-gated projection from authoritative Staff Builder scores without copied persistence or `SequenceTarget`
- attack-onset grouping across chords, both staves, same-staff polyphony, independent rhythms, rests, and ties
- exact pitch-set grading, blocking retries, measure/piece completion, targetless measures, start-at-measure, and restarts
- physical single-note and 225 millisecond chord input, stale-attempt cleanup, and stable MIDI ownership
- held/lingering and incoming-tie allowances without allowing held notes to satisfy missing attacks
- persistent virtual chord selection and strict MIDI/VKB attempt separation
- read-only score presentation, authoritative multi-event highlighting, feedback, accessibility, and one responsive keyboard
- Staff Builder library eligibility, launch/failure/exit flow, updated-save relaunch, and source/storage immutability
- app-level MIDI connection persistence, token-safe active-feature routing, held-note handoff, idempotent connect, hotplug cleanup, and cross-mode listener stability
- realistic multi-measure 6/8 integration with polyphony, grand-staff chord material, rests, a cross-measure tie, retry, completion, and exit

## Intentionally Not Deeply Tested

The initial suite should not deeply test:

- VexFlow's generated SVG structure
- browser audio playback internals
- the complete Web MIDI API
- PWA manifest and Workbox configuration
- GitHub Actions, Nginx, or DigitalOcean deployment
- Tailwind layout details
- random statistical distribution
- implementation-private helper functions
- large snapshots
- coverage percentage targets

These areas are better served by build checks, focused manual verification, or later integration and browser testing.

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
- Staff Builder on Chromebook mouse and touch, including direct notation targets and tap-versus-swipe behavior
- Android portrait and landscape layout, folded/unfolded devices where available, and the mobile keyboard sheet
- radial Duration, Key, and Time control reachability, touch ergonomics, focus return, and edge clamping
- direct event, rhythmic-position, clef/brace, key, and time taps at responsive score scales
- audition, measure, from-here, and piece playback, Stop, and the sliding playback highlight
- rests, ties, partial chords, trailing silence, key/time changes, Undo/Redo, and guided validation corrections
- local project close/reopen, draft recovery, validated Save, and installed-PWA behavior
- Blocking Piece Practice launch from a saved valid piece and disabled-reason behavior for invalid pieces
- physical MIDI single notes, block chords, slightly rolled chords, rapid retries, held previous notes, and tied destinations
- MIDI hotplug/disconnect during practice and clean Staff Builder ownership after exit
- desktop VKB and Chromebook touch chord selection, toggle removal, restart, and source switching
- Android portrait/landscape score readability, keyboard reach, target feedback, safe areas, and exactly one keyboard
- same-staff polyphonic notation/stems with playback and practice attacks aligned; sustained notes must not be re-required
- rest-only and consecutive targetless measure acknowledgement, Start at Measure, restart statistics, and completion focus
- screen-reader verbosity, expected/missing/extra pitch feedback, disabled Practice explanation, and keyboard focus order
- save, practice, exit, edit, save, and relaunch using the updated authoritative score without practice-progress persistence
- sustain-pedal behavior is not graded in Phase 1 and should be observed as a known hardware/browser limitation

This is risk-based guidance, not an exhaustive manual-QA gate. Non-blocking issues found during normal use may be recorded through the project's bug-log workflow.

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
