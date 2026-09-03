# Dev Log

A high-level release history and record of significant milestones in Prelude's development. The Unreleased section describes the current release candidate; a version is moved into a dated release section only when it is actually released.

## Unreleased

### Piece Practice

- Added validation-gated practice projected directly from authoritative saved Staff Builder pieces.
- Added blocking score-position progression across both staves, rests, ties, same-onset polyphony, held-note allowances, start/restart controls, and MIDI/VKB source separation.
- Added independent normal and rolled checks at one onset, with expressive upward rolls evaluated in a tempo-relative 1.5-quarter-note-beat window.

### Staff Builder

- Added automatic derived same-staff polyphony, `.prelude.json` import/export, schema v3 migration/validation, and collision-safe import.
- Added score annotations, annotation layers, and multi-system Study View.
- Added full-piece, treble-range, and bass-range duplication.
- Added authored upward rolled/arpeggiated chords across editing, validation, notation, playback, persistence, and Piece Practice.

### Melody

- Added generated continuous one- and two-measure sight-reading with count-in/metronome, MIDI/VKB capture, alignment, and independent Pitch, Movement, and Timing results.
- Added continuous timed diagnostics, interruption-safe Session Review, targeted repair retries, immutable original evidence, and original-versus-latest comparison.
- Added interval analytics that keep Sight Read evidence separate from Repair evidence.
- Added a two-quarter-beat preparatory display lead-in before authored and scored material.

### Mobile and Platform

- Coordinated explicit Mobile Play across supported modes while retaining one mounted session, MIDI owner, and virtual keyboard.
- Hardened Melody and Piece Practice mobile, focus, visibility, fullscreen/orientation, and offline-VKB behavior.

### Release Readiness

- Documented `package.json` as the visible application-version source. Its value remains unchanged until the planned release-version step, when it must be synchronized with the annotated tag.

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

## v2.4.0

### Staff Builder Foundation

- Added a learning-focused multi-measure score editor with MIDI and virtual-keyboard Capture Notes.
- Added direct score correction for rhythm, rests, ties, spelling, staff routing, key, and meter.
- Added score validation, guided corrections, score history, local project persistence, and distinct draft/validated saves.
- Added deterministic score playback and playback-follow visualization through the shared musical-event player.
- Added score-first notation controls, specialized radial controls, deterministic interaction geometry, and responsive mobile workflows.
- Released the Staff Builder foundation as the authoritative local score-authoring and project workflow.
