# Prelude: MIDI Mentor — Testing

> **Status:** v2.0 Release Suite
> **Current milestone:** v2.0 Practice Platform
> **Last updated:** August 2026

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

- Test files: 34 passed
- Tests: 426 passed
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

## Intentionally Not Tested for v2.0

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

Before the v2.0.0 release, run:

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
