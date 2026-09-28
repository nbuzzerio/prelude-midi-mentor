# Prelude: MIDI Mentor — ONBOARDING

> **Latest Repository Tag:** v2.5.0
> **Last Updated:** September 7, 2026
> **Current Milestone:** v2.8.0 Practice Session comprehensive reporting, Phase 4 browser printing
>
> Automated release preparation is complete after verification. Final Practice Session interaction and presentation QA follows deployment on the Chromebook/tablet; do not expand the feature before that real-use checkpoint.

---

# Project Overview

Prelude: MIDI Mentor is an open-source, browser-based musicianship platform focused on teaching piano through standard music notation and real-time MIDI interaction.

The project began as a lightweight sight-reading trainer for bass clef practice but has grown into a long-term platform for learning music theory, keyboard technique, harmony, ear training, and eventually composition.

Unlike many beginner piano applications, Prelude is designed around **reading music**, not memorizing falling notes. Every feature should reinforce transferable musicianship skills.

---

# Vision

Prelude aims to become a complete browser-based musicianship platform.

Long-term goals include:

- Sight-reading practice
- Chord recognition and construction
- Scale and interval training
- Guided lessons
- Teacher-created exercises
- Ear training
- Rhythm practice
- Interactive lesson builder
- Browser-based composition tools
- Multiple instrument playback using SoundFonts

The goal is **not** to compete with professional DAWs or notation software.

The goal is to create the best possible learning experience for piano students using modern web technologies.

---

# Project Philosophy

Every feature should answer three questions:

1. What musical skill does this teach?
2. Why is this valuable to a pianist?
3. Does this reinforce real musicianship?

Prelude prioritizes:

- Standard sheet music
- Understanding over memorization
- Progressive learning
- Clean, intuitive interfaces
- Browser-first accessibility
- Professional software architecture

Features should never exist simply because they are technically interesting—they should improve the learning experience.

---

# Practice Platform Foundation

The current milestone completes Prelude's foundational practice platform before work begins on more advanced musicianship and guided-learning systems.

Users should be able to:

1. Practice isolated notes and triads with Flashcards.
2. Practice ordered intervals, scales, arpeggios, and chord progressions with Sequences.
3. Use Free Play for key-aware live grand-staff notation without grading.
4. Play using either a MIDI keyboard or the on-screen keyboard.
5. Receive immediate feedback in graded modes.
6. Track session performance in Flashcards and Sequences.
7. Practice anywhere using an installable Progressive Web App.
8. Build and run reusable Practice Session presets across Flashcards, Sequences, Ear Training, and timed Melody practice.

---

# Current Status

The core flashcard and melodic-sequence systems are functional.

Completed features include:

## Practice

- Treble clef mode
- Bass clef mode
- Mixed mode
- Single-note flashcards
- Major triad flashcards
- Minor triad flashcards
- Diminished triad flashcards
- Augmented triad flashcards
- Root position, first inversion, and second inversion
- Configurable exercise types
- Random target generation
- Session statistics
- Accuracy tracking
- Response-time tracking
- Streak tracking
- Ascending and descending melodic interval sequences
- Configurable interval selection
- Natural-note and accidental-note filters
- Step-by-step sequence validation
- Sequence accuracy and completion statistics
- Major, natural minor, harmonic minor, and melodic minor scales
- Major and minor pentatonic scales
- Major, minor, diminished, augmented, dominant seventh, major seventh, and minor seventh arpeggios
- Theory-aware spelling for intervals, scales, and arpeggios
- Curated Roman-numeral chord progressions in supported major and minor keys
- Theory-aware root-position triads with progression and current-chord labels
- Progression-specific clef ranges and compatible key/template settings
- Free Play mode with No Key or 12 supported major/minor key contexts
- Automatic, Prefer sharps, and Prefer flats live note spelling
- Immediate respelling of held physical or virtual notes without replay

## Input

- Physical MIDI keyboard support
- On-screen piano keyboard
- Simultaneous MIDI note tracking
- Timed chord collection
- Rolled chord support
- Physical MIDI block and rolled-chord progression input
- Persistent virtual progression-chord selection with toggle removal and chord playback
- Exact chord validation
- Permanent raw MIDI diagnostic mode with independent multi-input connection, exact bytes, browser timestamps, decoded channel/message data, bounded capture, and copy/manual-copy workflow
- One user-initiated Web MIDI connection persists across top-level mode changes; active features retain their own input/grading semantics
- Chromebook compatibility

## Feedback

- Immediate visual feedback
- Sample-based piano playback
- Adjustable feedback volume
- Persistent local preferences

## Notation

- Dynamic notation rendering with VexFlow
- Ledger lines
- Accidentals
- Breakpoint- and mode-specific transform scaling for current notation layouts
- Explicit Mobile Play across Flashcards, Sequences, Free Play, Ear Training, Melody, and active Piece Practice, with best-effort fullscreen/orientation
- Temporal Sequence measure windows with optional presentation-only Whole Sequence view
- Persistent grand staff for Free Play
- Automatic treble- and bass-staff placement for held notes
- Key signatures on both Free Play staves
- Natural signs and chromatic accidentals relative to the selected signature

## Platform

- Responsive desktop layout
- Responsive tablet layout
- Responsive mobile layout
- Progressive Web App
- Offline application shell
- Automated deployment
- Production hosting on DigitalOcean

## Staff Builder

- Application-owned canonical schema v4 multi-measure grand-staff score model; persisted/imported v1/v2/v3 scores migrate into v4 at the validation boundary
- MIDI and virtual-keyboard Capture Notes with rhythmic positioning and staff routing
- Direct duration, rest, tie, spelling, staff, key, and time correction
- Validation with guided corrections and learner-facing issue text
- Local project library, draft autosave, and distinct validated Save
- Per-piece `.prelude.json` download/import for backup and recovery without exporting draft or practice state
- Score annotations and multi-system Study View
- Full-piece, treble-range, and bass-range duplication; copies receive new top-level identity without mutating the source
- Upward rolled/arpeggiated chord authoring through optional schema v3 `arpeggiation` data
- Deterministic event, measure, position, and piece playback with playback-follow visualization
- Direct notation interaction, radial controls, responsive score scaling, and a mobile keyboard bottom sheet
- Automatic derived same-staff rhythmic voices with no persisted voice IDs or beginner-facing Voice controls

The Staff Builder **Copy Score for AI** action beside Piece Library copies the current editor score, including unsaved authored edits, using the same pure, pretty-printed schema-v4 JSON as `.prelude.json` export. It reuses `serializeStaffBuilderPiece` and the existing import validator; editor state and library usage metadata remain excluded. Clipboard failure exposes a labeled, focused, selected read-only textarea for manual copying. No AI service is contacted.

Staff Builder score schema v4 adds optional measure-level `clefChanges`, for example `{"bass":"treble"}`. Keys remain the semantic staff identities `treble` (upper) and `bass` (lower); values select treble or bass display clef independently. Changes take effect at the measure start and carry forward until superseded. There are no mid-measure changes. Historical scores default to upper Treble/lower Bass; legacy migrations preserve existing annotation/arpeggiation behavior. Explicit redundant changes survive canonical export. The current-measure Display clefs disclosure supports explicit selection or Inherit/Default removal, with Undo and autosave. Clef editing never changes pitches, MIDI values, spelling, timing, staff assignment, ties, or annotations. System and print-range starts resolve prior context; changes inside systems render at their measure boundary. Piece Practice propagates display context without changing grading. Library-v4 and draft-v3 envelopes and historical storage keys remain unchanged.

## Blocking Piece Practice

- Structurally valid saved Staff Builder pieces launch directly from the local library
- Staff Builder remains authoritative; practice uses a transient score-position projection rather than `SequenceTarget`
- Each position contains one aggregated normal check plus independent checks for authored rolled chords
- A position advances only after every check completes; mistakes remain blocked for retry and targetless measures require acknowledgement
- Chords, cross-staff attacks, independent/polyphonic rhythm, rests, and pitch-specific ties retain their authored musical meaning
- One stable MIDI owner, the ordinary 225 millisecond block-chord collector, tempo-relative rolled evaluation, persistent VKB chord selection, and strict MIDI/VKB source separation
- Start at Measure, Restart Measure, Restart Piece, completion statistics, read-only score reuse, and exit to the library
- Ordinary narrow Piece Practice remains responsive document flow; explicit Mobile Play preserves the same blocking session and input owner
- No persisted practice progress and no BPM, hold-duration, metronome, or continuous timing grading

## Melody

- Seeded monophonic one/two-measure 4/4 exercises with Web Audio count-in and continuous MIDI/VKB capture
- Two-quarter-beat preparatory display lead-in before authored and scored material
- Independent Pitch, Movement, and attack-Timing results with a read-only Pitch-result staff
- Timed diagnostic sessions with interruption-safe Session Review and targeted repair retries
- Immutable original diagnostic evidence, separate accumulated retry evidence, and original-versus-latest comparison
- Interval Trouble analytics separated into Sight Read and Repair datasets
- Explicit Mobile Play preserves the generated exercise, AudioContext, clock, recorder, source lock, keyboard, and results
- No duration/hold grading, richer meters, rests, chords, or persisted analytics in Phase 1

## Practice Sessions

- `src/features/practice-session/` owns browser-local preset types, validation, immutable library operations, the controlled builder, runtime reducer, summary, and hosted Mobile Play shell
- Presets contain ordered stable exercise entries and feature-owned configuration snapshots for Flashcards, Sequences, Ear Training, and Melody
- The library envelope is schema v2; stored v1 libraries migrate in memory with an empty curriculum list and are not rewritten until explicit Save
- Lightweight curriculum records preserve title/instructions, weekdays, rest/day notes, estimated duration, and references to ordinary presets without copying exercise data or adding scheduling state
- `src/features/practice-session/import/` owns the independently versioned reduced Weekly Practice contract, collecting validator, canonical translator, tested examples, JSON Schema, and pure Copy-for-AI specification generator
- The same folder owns pure Weekly Practice import preparation/application and preview derivation; the builder dialog only collects input and presents those results. Import changes working state, selects the first imported practice preset, and requires the existing Save action to persist.
- `createWeeklyPracticeLlmSpecification()` is the one clipboard payload for the AI generation guide. React explains the copy/paste workflow but does not duplicate contract fields or allowed values; clipboard failure exposes the same generated text for manual copying, and no student data is sent by Prelude.
- When extending an importable exercise, update feature-owned constants first, then the reduced variant, translator, schema/specification inputs, examples, and canonical compatibility tests together
- Explicit Save persists the complete preset library; active runs, progress, evidence, and summaries remain memory-only
- One keyed exercise engine mounts at a time while the stable Practice Session host preserves Mobile Play across transitions

## Quality

- Vitest test runner
- React Testing Library
- Pure music-theory tests
- Stateful hook tests
- Web MIDI integration tests
- Flashcard session integration tests
- Automated tests for flashcards, sequences, music theory, MIDI behavior, and theory-aware spelling
- Focused Mobile Play lifecycle and cross-mode preservation tests

---

# Current Development Focus

The package version is 2.8.5 for the Phase 0 Raw MIDI Diagnostic Viewer. The diagnostic is an ordinary reachable mode and owns an independent, in-memory Web MIDI observation path; it does not expand the shared feature-facing MIDI contract, Piece Practice evidence, persistence, analytics, or grading. Tagging and releasing remain manual owner actions.

The repository owner next reviews and commits the prepared release metadata, creates the annotated tag, and verifies deployment. Final Practice Session interaction, viewport, fullscreen/orientation, and installed-PWA behavior is checked on the deployed Chromebook/tablet. Scheduling, persistent practice evidence, analytics, active-run recovery, broader Staff Builder editor mobile redesign, and Piece Practice Accuracy remain future work.

Staff Builder owns its schema v4 score domain, editor orchestration, Capture Notes, Rhythm Correction, score history, validation/corrections, annotations, local persistence/library, notation projection, and playback projection. Derived voices are transient notation/domain facts. Historical local-storage keys retain `-v1` names for compatibility and must not be renamed merely because the current score schema is v4. Piece Practice owns transient projection, check-based blocking state, input, and read-only presentation without copying the score or coupling back into the editor.

The current automated baseline is established by `pnpm verify`; exact passing test-file and test counts are recorded in the v2.7.0 release handoff. Physical Web MIDI, installed-PWA behavior, real offline behavior, browser printing, and representative browser/device behavior still require manual validation where relevant.

---

# Long-Term Architecture

Prelude is intentionally designed so today's isolated practice engine can evolve naturally into tomorrow's guided lesson system without requiring major architectural rewrites.

Prelude uses `PracticeTarget` for isolated flashcards and `SequenceTarget` for ordered intervals, scales, arpeggios, and chord progressions. Sequence targets carry explicit meter/PPQ timing and step durations; current generators apply Prelude's 4/4, 480-PPQ, quarter-duration practice convention. Temporal measure windows are derived from cumulative onset time while the target and global step remain authoritative for grading. Progressions store one simultaneous chord attack per `SequenceStep` with optional Roman-numeral and concrete chord metadata. Free Play bypasses target generation and grading: raw held MIDI remains authoritative, Free Play-owned settings convert it to explicitly spelled `PracticeNote` values, and shared notation renders those notes with an optional key signature. No chord analysis is performed.

A `PracticeTarget` can represent one or more notes, allowing the same validation and rendering systems to support:

- Single-note flashcards
- Triad flashcards
- Future interval exercises
- Future chord exercises

This provides a simple, reusable foundation while keeping the current practice engine focused on isolated musical concepts.

Long-term, Prelude may evolve toward a structured lesson architecture:

Lesson

↓

Measures

↓

Events

↓

Notes

This larger model could power:

- Flashcards
- Chord practice
- Scale practice
- Arpeggio practice
- Guided lessons
- Songs
- Composition tools

The current `PracticeTarget` model should remain the foundation for isolated practice exercises until sequence-based features (such as rhythm, phrases, and complete lessons) justify introducing the larger lesson architecture.

---

# Teaching Philosophy

Prelude is designed to teach concepts—not just songs.

Examples include:

- reading notes
- recognizing intervals
- building chords
- understanding scales
- practicing ostinatos
- learning cadences
- developing hand independence
- understanding harmony

Songs become one application of these skills rather than the primary learning method.

---

# Development Philosophy

When contributing to Prelude:

- Favor small, focused commits.
- Keep documentation synchronized with the implementation.
- Keep components modular.
- Document architectural decisions.
- Prefer simple solutions before introducing abstractions.
- Build features that can be expanded rather than rewritten.
- Test musical behavior at the lowest useful layer.

Every new feature should fit naturally into the long-term vision of the application.

---

# Documentation

Project documentation consists of:

- ONBOARDING.md — Project overview and current status
- ROADMAP.md — Planned milestones and upcoming features
- ARCHITECTURE.md — Technical design and project structure
- DECISIONS.md — Record of important architectural decisions
- VISION.md — Long-term goals and design philosophy
- README.md — Public project overview
- TESTING.md — Testing philosophy and coverage

New contributors should read these documents before beginning
development.


### Staff Builder AI Authoring Guide

The compact **?** beside **Copy Score for AI** opens the AI Authoring Guide. **Copy Score for AI** copies the current canonical v4 score, including unsaved edits. The guide dialog's **Copy for AI** copies a self-contained authoring contract for creating new importable scores in a fresh AI conversation. Save returned raw JSON as a `.prelude.json` file and use **Import Piece** in Piece Library.

The deterministic guide draws from Staff Builder's shared capabilities and explains all portable fields, measure-context inheritance, notes/chords/rests, rhythm, pitch spelling, upward arpeggiation, ties, and study annotations. It distinguishes structural import acceptance from musical validation and practice readiness. Clefs are display context only: staff identity, pitch, MIDI, and grading remain unchanged.

The accessible dialog supports keyboard focus containment, Escape/Close, and focus restoration. Clipboard failure provides the exact guide in a selected read-only textarea for manual copying. Opening or copying the guide does not edit or save a score and performs no network requests.
