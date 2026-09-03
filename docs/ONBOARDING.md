# Prelude: MIDI Mentor — ONBOARDING

> **Latest Repository Tag:** v2.4.0 — Staff Builder
> **Last Updated:** September 2, 2026
> **Current Milestone:** Planned v2.5.0 documentation and release-readiness pass
>
> Combined physical-device, responsive, accessibility, MIDI, and installed-PWA QA is next. Do not begin Piece Practice Accuracy or expand Melody scope without a new approved plan.

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
- MIDI diagnostics
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

- Application-owned canonical schema v3 multi-measure grand-staff score model; persisted/imported v1 and v2 scores migrate into v3 at the validation boundary
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

Prelude's latest repository tag is v2.4.0. The current release candidate is preparing the backward-compatible work since that tag for a planned v2.5.0 release, including Piece Practice, automatic same-staff polyphony, import/export, annotations and Study View, Melody and its timed review workflow, coordinated Mobile Play, duplication, and rolled-chord authoring/practice.

The next step is combined physical-MIDI, Chromebook mouse/touch, Android portrait/landscape, responsive, fullscreen/orientation, accessibility, playback, persistence, and installed-PWA QA. Fix only confirmed defects, then finalize the release version and notes before selecting another milestone. Melody duration/hold grading, persistent practice evidence, broader Staff Builder editor mobile redesign, and Piece Practice Accuracy remain future work.

Staff Builder owns its schema v3 score domain, editor orchestration, Capture Notes, Rhythm Correction, score history, validation/corrections, annotations, local persistence/library, notation projection, and playback projection. Derived voices are transient notation/domain facts. Historical local-storage keys retain `-v1` names for compatibility and must not be renamed merely because the current schema is v3. Piece Practice owns transient projection, check-based blocking state, input, and read-only presentation without copying the score or coupling back into the editor.

The current automated baseline is 137 passing test files and 1,544 passing tests. Real-device/manual QA remains pending; run the complete `pnpm verify` workflow again against the eventual release candidate.

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
