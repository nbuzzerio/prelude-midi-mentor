# Dev Log

A high-level record of significant milestones in Prelude's development.

## Unreleased — Melody Mode Phase 1

Completed generated continuous sight-reading with Web Audio count-in/metronome, MIDI/VKB capture, timing-led alignment, independent Pitch/Movement/Timing results, a Pitch-only colored result staff, mobile/visibility hardening, and cached-PWA support for the basic offline VKB workflow.

---

## v0.1.0

### Project Foundation

- Project initialized.
- Migrated to a Vite + React + TypeScript architecture.
- Core documentation created.

### Flashcard MVP

- Built the initial responsive practice interface.
- Added bass, treble, and mixed clefs.
- Added randomized note generation.
- Added session statistics.
- Added a four-octave virtual piano.
- Added latest-answer highlighting.
- Added MIDI diagnostics.
- Replaced the original unsupported E-MU MIDI interface with a class-compliant USB MIDI interface.

### Musicianship Expansion

- Added accidentals.
- Added single-note and triad practice targets.
- Added major, minor, diminished, and augmented triads.
- Added root position, first inversion, and second inversion.
- Added simultaneous MIDI note detection with a grace period for rolled chords.
- Added virtual piano input alongside physical MIDI.
- Added sampled piano playback.
- Added configurable practice settings.
- Refactored the flashcard engine into feature hooks and reusable practice utilities.

### Current Focus

- v1.0 stabilization
- Automated testing
- Documentation refinement
- Initial public release

---

## v1.0.0

### Stable Flashcard Release

- Completed the generalized flashcard practice engine.
- Added single-note and triad practice.
- Added natural-note and accidental-note configuration.
- Added physical MIDI and virtual piano input.
- Added sampled piano playback and interface feedback.
- Added responsive PWA support and production deployment.
- Completed the initial automated testing and documentation baseline.

---

## v1.1.0

### Sequence Mode

- Added a dedicated melodic Sequence Mode.
- Added ascending and descending interval generation.
- Added configurable interval and note-category settings.
- Added ordered step validation and sequence retry behavior.
- Added MIDI-release-aware step and completion transitions.
- Added sequence completion statistics.
- Organized flashcard and sequence behavior into dedicated feature modules.

### Testing Expansion

- Added interval-generator tests.
- Added sequence validation and statistics tests.
- Added tests for all Sequence Mode hooks.
- Expanded the automated suite to 223 passing tests across 18 test files.

---

## v2.0.0

### Practice Platform

- Expanded Sequence Mode beyond melodic intervals with major and minor scales and arpeggio exercises.
- Added seventh-arpeggio practice and related Sequence settings improvements.
- Added the initial ungraded Free Play mode on an interactive grand staff.

---

## v2.1.0

### Chord Progressions

- Added playable chord progressions to Sequence Mode.
- Added curated Roman-numeral progression templates and deterministic triad realization.
- Added physical MIDI and persistent virtual-keyboard chord input with progression-focused practice controls.

---

## v2.2.0

### Key-Aware Free Play

- Added supported major and minor key contexts and visible key signatures to Free Play.
- Added key-aware diatonic spelling with Automatic, Prefer sharps, and Prefer flats chromatic controls.
- Added live respelling of held notes when notation settings change without clearing or replaying them.

---

## v2.3.0

### Melodic Interval Ear Training

- Released ascending and descending melodic interval identification.
- Added stable prompt/replay behavior, interval-name grading, session statistics, and mobile presentation.

---

## Post-v2.3 Development (Unreleased)

### Staff Builder Foundation

- Added a learning-focused multi-measure score editor with MIDI and virtual-keyboard Capture Notes.
- Added direct score correction for rhythm, rests, ties, spelling, staff routing, key, and meter.
- Added score validation, guided corrections, score history, local project persistence, and distinct draft/validated saves.
- Added deterministic score playback and playback-follow visualization through the shared musical-event player.
- Added score-first notation controls, specialized radial controls, deterministic interaction geometry, and responsive mobile workflows.
- Completed the August 9, 2026 implementation checkpoint at `92cf7e5`; physical-device and responsive manual QA remains before any release decision.

### Blocking Piece Practice Phase 1

- Added validation-gated direct practice for saved Staff Builder pieces without copying scores into Sequence or persistence.
- Added blocking pitch-attack progression through authored measures with MIDI/VKB input, chords, rests, pitch-specific ties, and automatic same-staff polyphony.
- Reused the authored score as read-only notation with target highlights, start/restart controls, completion feedback, and return to the Staff Builder library.
- Completed automated projection, state-machine, input-lifecycle, rendering, accessibility, launch/exit, and immutability verification; real-device QA remains before any release decision.
