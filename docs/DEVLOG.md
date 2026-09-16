# Dev Log

A high-level release history and record of significant milestones in Prelude's development. The Unreleased section records work after the prepared release, while dated sections preserve finalized release notes. The v2.7.0 candidate remains subject to the repository owner's review, manual release commit, and annotated tag.

## Unreleased

- Prepared v2.6.5 with sequential Staff Builder Lyric Cues authoring, browser-native Study View printing with measure ranges, and undoable measure deletion with safe tie and annotation cleanup.

---

## v2.6.0 — September 7, 2026

### Practice Sessions

- Added reusable named presets with ordered exercises, feature-owned configuration snapshots, explicit local Save, and Ready / Needs setup validation.
- Added direct configured launches across Flashcards, Sequences, Ear Training, and timed Melody practice, including Scale Repertoire in ordered or shuffled traversal.
- Added native completion targets, Practice Complete actions, Keep Playing / Bonus, Skip for Today, End Session, and an entered-only neutral summary.
- Added one-at-a-time exercise orchestration with immutable run snapshots while keeping active-run state and practice evidence memory-only.
- Added stable hosted Mobile Play continuity across prescribed exercise transitions while preserving standalone engine behavior.
- Expanded automated coverage across preset validation and persistence, builder recovery and editing, runtime transitions, stale-callback protection, engine contracts, and hosted Mobile Play lifecycle.

### Release Readiness

- Synchronized the visible application version and release documentation for v2.6.0 preparation.
- Kept Practice Session prescriptions browser-local with no accounts, cloud dependency, analytics, or persisted run history.

---

## v2.5.0 — September 3, 2026

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
- Added a two-quarter-beat preparatory display lead-in and improved first-note alignment before authored and scored material.

### Mobile and Platform

- Coordinated explicit Mobile Play across supported modes while retaining one mounted session, MIDI owner, and virtual keyboard.
- Hardened Melody and Piece Practice mobile, focus, visibility, fullscreen/orientation, and offline-VKB behavior.

### Release Readiness

- Synchronized the visible application version with the canonical `package.json` version for v2.5.0 release preparation.
- Completed focused repository, documentation, automated-testing, PWA-configuration, and release-readiness cleanup.

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
# v2.7.0 candidate

- Expanded Piece Practice completion into an attempt-local diagnostic report with chronological mistake evidence, accumulated measure time, slow-response evidence, expandable authored notation, problem filtering, and browser-print reporting.
- Added additive pitch anchors and red/amber diagnostic overlays while preserving Melody's event-highlight behavior.
- Excluded hidden-tab time from active practice timing and froze all attempt timing at completion.
