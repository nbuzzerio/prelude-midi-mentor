# Prelude: MIDI Mentor — ROADMAP

> This roadmap outlines the planned evolution of Prelude from a simple sight-reading trainer into a complete browser-based musicianship platform.
>
> **Current checkpoint:** September 3, 2026 — the repository, application version, and release notes are prepared for the v2.5.0 release candidate containing the completed feature work since the v2.4.0 Staff Builder tag. Owner review, final sanity checks, the manual tag, and deployment verification remain.

---

# Completed

The milestones in this section describe implemented product behavior. An unchecked manual-QA item does not turn the implemented feature back into a future commitment.

# ✅ Phase 1 — Core Flashcard MVP (Completed)

## Foundation

- [x] Project architecture
- [x] Vite + React + TypeScript setup
- [x] Tailwind CSS
- [x] Documentation
- [x] Production deployment
- [x] GitHub Actions CI/CD
- [x] DigitalOcean hosting
- [x] Progressive Web App support
- [x] Offline application shell

---

## Practice

- [x] Treble clef mode
- [x] Bass clef mode
- [x] Mixed mode
- [x] Random note generation
- [x] Immediate answer feedback
- [x] Accuracy tracking
- [x] Response-time tracking
- [x] Streak tracking
- [x] Session statistics

---

## Notation

- [x] Dynamic notation rendering with VexFlow
- [x] Ledger lines
- [x] Responsive notation scaling
- [x] Accidentals
- [x] Grand staff support

---

## Input

- [x] Physical MIDI keyboard support
- [x] On-screen piano keyboard
- [x] MIDI diagnostics
- [x] Chromebook compatibility
- [x] Mobile support

---

# ✅ Phase 2 — v1.0 Stabilization (Completed)

This phase stabilized the flashcard engine through documentation, testing, and release preparation before later practice modes were added.

## Notation

- [x] Support sharps and flats
- [x] Sharp-only / Flat-only / Mixed practice modes
- [ ] Natural-notes-only beginner mode

## Practice

- [x] Major triad flashcards
- [x] Minor triad flashcards
- [x] Diminished triad flashcards
- [x] Augmented triad flashcards
- [x] Generalized practice target model
- [x] Grace-based simultaneous MIDI note validation
- [x] Sampled piano playback
- [x] Adjustable feedback volume
- [ ] Expanded configurable note ranges
- [ ] Difficulty presets
- [ ] Local progress persistence
- [ ] Weak-note review

## Platform

- [ ] Final browser compatibility review
- [ ] Additional MIDI interface testing

---

# ✅ Phase 2.5 — v1.1 Sequence Mode (Completed)

Introduce the first ordered, multi-step practice mode while preserving the existing flashcard architecture.

## Sequence Practice

- [x] Dedicated Sequence Mode
- [x] Ascending melodic intervals
- [x] Descending melodic intervals
- [x] Configurable interval selection
- [x] Natural-note and accidental-note filters
- [x] Step-by-step answer validation
- [x] Correct and incorrect step feedback
- [x] MIDI-release-aware transitions
- [x] Sequence completion statistics
- [x] Dedicated sequence feature module
- [x] Automated tests for sequence logic, hooks, and generators

---

# ✅ Phase 2.75 — v2.0 Practice Platform (Completed)

Complete Prelude's foundational practice platform with expanded sequence exercises and ungraded live notation.

## Expanded Sequence Practice

- [x] Major scales
- [x] Natural minor scales
- [x] Harmonic minor scales
- [x] Melodic minor scales
- [x] Major pentatonic scales
- [x] Minor pentatonic scales
- [x] Major and minor arpeggios
- [x] Diminished and augmented arpeggios
- [x] Dominant seventh, major seventh, and minor seventh arpeggios
- [x] Theory-aware interval, scale, and arpeggio spelling

## Chord Progressions

- [x] Chord Progressions inside Sequence Mode
- [x] Curated major and minor Roman-numeral templates
- [x] Supported major and minor key selection
- [x] Deterministic theory-aware root-position triads
- [x] Progression and current-chord metadata
- [x] Physical MIDI block and rolled-chord input
- [x] Persistent virtual-keyboard chord selection and playback
- [x] Focus Staff and settings-driven target regeneration

## Free Play

- [x] Dedicated Free Play mode
- [x] Live MIDI and virtual-keyboard notation
- [x] Persistent grand staff
- [x] Automatic treble- and bass-staff placement
- [x] Neutral held-key highlighting
- [x] No Key and supported major/minor notation contexts
- [x] Key signatures on treble and bass staves
- [x] Key-aware diatonic and chromatic spelling preferences
- [x] Immediate respelling of held notes after settings changes

## Mobile Play and coordinated mobile UX

- [x] Shared Mobile Play lifecycle across Flashcards, Sequences, Free Play, Ear Training, Melody, and active Piece Practice
- [x] Best-effort fullscreen and landscape orientation lock with safe fallback
- [x] Focus Staff mutual exclusion and state-preserving transitions
- [x] Free Play momentary multitouch without changing graded input semantics
- [x] Focused lifecycle, integration, and notation-scaling tests
- [x] Compact mobile mode navigation, Flashcard task hierarchy/disclosures/stats, and Ear Training phone header
- [x] Temporal Sequence current-measure presentation with optional Show Whole Sequence
- [x] Explicit state-preserving Melody and Piece Practice Mobile Play
- [x] Common responsive entry availability, portrait support, narrow action flow, and keyboard-focusable Melody score scrolling

Container-driven responsive VexFlow sizing is deferred to the later UI/UX overhaul. This milestone does not include a settings drawer, onboarding, or a full mobile redesign.

Future Free Play ideas such as chord analysis, phrase history, last-measure display, rhythm, zoom controls, and automatic key detection remain unimplemented.

## Completed v2.5.0 Release-Candidate Scope

Chord Progressions, key-aware Free Play, melodic-interval Ear Training, Staff Builder, automatic same-staff polyphony, Piece Practice, Melody, and the coordinated Mobile Play stream are complete in code. The v2.5.0 release candidate also includes annotations and Study View, timed Melody diagnostics and review, piece duplication, and authored and practiced rolled chords. Development now pauses for final release preparation:

1. Perform the final owner sanity check across application startup, MIDI, Melody, Staff Builder to Piece Practice, persistence, and the installed PWA.
2. Review and commit the prepared v2.5.0 version and release documentation, then create the annotated tag manually.
3. Verify deployment and the installed-PWA update after pushing the release commit and tag.
4. Review the completed product checkpoint before selecting the next feature milestone. Melody duration/hold grading and Piece Practice Accuracy remain separate future work.

Remaining unchecked Harmony, Musicianship, Guided Lesson, playback-instrument, and Composer items describe future possibilities rather than a strict delivery order.

## Melody Mode Phase 1 — Implementation complete

- Seeded one/two-measure beginner generation
- Web Audio count-in/metronome and continuous MIDI/VKB capture
- Timing-led alignment with independent Pitch/Movement/Timing scores
- Read-only notation, playhead, mobile presentation, and Pitch-result staff
- Explicit Mobile Play through setup, count-in, performance, and results without replacing audio/input ownership
- Cached-PWA basic offline VKB workflow
- Two-quarter-beat preparatory display lead-in before scored material
- Timed diagnostic sessions with interruption-safe Session Review
- Targeted repair retries with immutable original versus latest evidence
- Interval Trouble analytics separated into Sight Read and Repair evidence
- Final device/accessibility/airplane-mode QA remains pending

Future work remains separate: rests, 6/8/richer meters, two-hand notes, dyads/chords, adaptive difficulty, latency calibration, and detailed timing/extra-note overlays. Piece Practice Accuracy Phase 2 has not started.

---

# ✅ v2.4.0 — Staff Builder Foundation (Completed)

Staff Builder provides a beginner-focused transcription and practice-material workflow and is represented by the v2.4.0 repository tag.

## Score and Editing Foundation

- [x] Application-owned multi-measure grand-staff score model
- [x] Notes, chords, rests, durations, ties, tempo, key signatures, and time signatures
- [x] MIDI and virtual-keyboard Capture Notes with grand, treble, and bass routing
- [x] Rhythmic cursor positioning and direct measure navigation
- [x] Duration editing, rest insertion, staff reassignment, spelling, ties, and deletion
- [x] Score-history Undo and Redo

## Validation, Projects, and Playback

- [x] Score validation with guided learner-facing corrections
- [x] Draft autosave and distinct validated Save
- [x] Local project library and persistence
- [x] Per-piece `.prelude.json` import/export with schema validation and collision-safe insertion
- [x] Full-piece, treble-range, and bass-range duplication
- [x] Event, measure, position, and piece playback with Stop
- [x] Deterministic score projection through shared musical-event playback
- [x] Playback-follow measure display and sliding score highlight

## Score-First and Mobile UX

- [x] Direct event, rhythmic-position, clef/brace, key, and time interaction
- [x] Specialized duration, key, and time radial controls
- [x] Deterministic pointer ownership and tap-versus-drag protection
- [x] Responsive score scaling and touch-compensated interaction
- [x] Safe-area-aware mobile virtual-keyboard bottom sheet with one active presentation
- [x] Collapsed technical and advanced fallback controls
- [x] Score annotations and multi-system Study View
- [x] Authored upward rolled/arpeggiated chords

## Automatic Same-Staff Polyphony

- [x] Deterministic derived rhythmic voices without persisted voice IDs or manual Voice controls
- [x] Staff-wide union validation with render-only implicit voice gaps
- [x] Multi-voice VexFlow rendering with authoritative event anchors
- [x] Capture, Rhythm Correction, playback, ties, and Piece Practice compatibility

---

# ✅ Post-v2.4.0 — Piece Practice (Implemented for v2.5.0)

- [x] Validation-gated launch from saved Staff Builder pieces
- [x] Transient attack-onset projection without `SequenceTarget` or copied score persistence
- [x] Score-position blocking progression across measures, chords, both staves, same-onset polyphony, rests, and ties
- [x] One aggregated normal check plus independent authored rolled-chord checks at an onset
- [x] Physical MIDI single/chord input with the shared 225 millisecond collector
- [x] Expressive upward rolled-chord evaluation in a tempo-relative 1.5-quarter-note-beat window
- [x] Persistent virtual-keyboard chord input with strict MIDI/VKB source separation
- [x] Start at Measure, Restart Measure, Restart Piece, targetless-measure acknowledgement, completion, and session statistics
- [x] Read-only authored-score presentation and authoritative multi-event highlighting
- [x] Exit to the retained Staff Builder library context
- [x] Automated projection, state, input, rendering, accessibility, eligibility, launch/exit, and immutability coverage
- [ ] Final physical-MIDI, Chromebook, Android, responsive, audio, and screen-reader QA

Piece Practice has explicit Mobile Play during an active session; narrow/coarse responsive layout alone does not activate it. This presentation change preserves the blocking session, pending input, restart, targetless-measure, completion, and Staff Builder return semantics. Future Piece Practice Accuracy mode remains separate: it may add continuous BPM-driven capture and post-performance feedback, but no such engine is part of the current release candidate.

---

# Future / Exploratory

The following areas are possibilities, not existing capabilities or committed delivery dates. They must not be read as a promise or as a strict implementation order.

## Near-Term Post-Release Direction

- [ ] Acquire and persist learner practice evidence across sessions
- [ ] Define product and privacy requirements before designing any persistence schema
- [ ] Use accumulated evidence to inform later review and practice guidance without claiming server-side analytics today

This direction is intentionally not a data-model commitment. The current application keeps Melody diagnostic/repair evidence in memory and Staff Builder projects in browser-local storage.

# 🎹 Phase 3 — Harmony Trainer

Expand the existing multi-note practice engine into a complete harmony trainer.

## Chords

- [x] Simultaneous MIDI note detection
- [x] Diatonic triad practice
- [x] Major chord flashcards
- [x] Minor chord flashcards
- [x] Diminished chord flashcards
- [x] Augmented chord flashcards
- [ ] Suspended chords
- [ ] Seventh chords
- [x] Root position (Chord Inversions)
- [x] First inversion (Chord Inversions)
- [x] Second inversion (Chord Inversions)
- [ ] Chord recognition mode

---

# 🎼 Phase 4 — Musicianship

Expand beyond isolated note and chord recognition.

## Intervals

- [x] Melodic interval construction
- [x] Ascending / descending modes
- [x] Melodic interval identification by ear
- [ ] Harmonic interval practice
- [ ] Expanded interval difficulty settings

## Scales

- [x] Major scales
- [x] Natural minor scales
- [x] Harmonic minor scales
- [x] Melodic minor scales
- [ ] Scale flashcards

## Arpeggios

- [x] Major arpeggios
- [x] Minor arpeggios
- [x] Seventh arpeggios

## Rhythm

- [ ] Rhythm trainer
- [ ] Tempo trainer
- [ ] Metronome

---

# 📚 Phase 5 — Guided Lessons

Move from isolated flashcards to structured lessons.

## Lesson Engine

- [ ] Lesson data model
- [ ] Multi-measure lessons
- [ ] Phrase practice
- [ ] Left-hand practice
- [ ] Right-hand practice
- [ ] Both-hands practice
- [ ] Loop selected measures
- [ ] Adjustable tempo
- [ ] Lesson progress tracking

## Lesson Types

- [ ] Scale lessons
- [ ] Chord lessons
- [ ] Arpeggio lessons
- [ ] Cadence lessons
- [ ] Ostinato exercises
- [ ] Teacher-created exercises
- [ ] Song studies

---

# ✏️ Phase 6 — Lesson Builder

Build lesson authoring, sharing, and consumption on top of the completed Staff Builder score foundation. A Staff Builder project is not yet a Guided Lesson.

## MIDI Step Recorder

- [x] Measure editor foundation
- [x] Beat/grid positioning foundation
- [x] Step-style MIDI/VKB capture foundation
- [x] Duration editing
- [x] Rest insertion
- [x] Playback preview

## Lesson Editing

- [x] Edit existing local Staff Builder projects
- [ ] Duplicate measures
- [ ] Copy/Paste measures
- [x] Per-piece `.prelude.json` backup import/export
- [x] Local Staff Builder project library
- [ ] Guided Lesson data-model integration
- [ ] Teacher assignment workflow
- [ ] Lesson sharing and consumption
- [ ] Broader structured external interchange beyond Prelude score backup files

Whole-piece and treble-/bass-range duplication are complete. “Duplicate measures” above is a distinct future editor operation and is not implied by the existing piece-copy workflows.

---

# 🎻 Phase 7 — Playback & Ear Training

Expand listening and orchestration capabilities.

## Instrument Playback

- [ ] Browser SoundFont playback
- [ ] Piano
- [ ] Strings
- [ ] Violin
- [ ] Cello
- [ ] Choir
- [ ] Organ
- [ ] Brass
- [ ] Drum kit

## Audio Features

- [ ] Layered instruments
- [ ] Keyboard splits
- [ ] Playback controls

## Ear Training

- [ ] Note identification
- [x] Melodic interval recognition
- [ ] Chord recognition by ear
- [ ] Melody playback

The initial Ear Training release supports ascending and descending melodic interval-name identification, stable explicit replay, session statistics, Focus Staff exclusion, and Mobile Play. Harmonic intervals, note identification, chord recognition, and melody imitation remain deferred.

---

# 🎼 Phase 8 — Composer Sandbox

Turn Prelude into a lightweight composition and experimentation environment.

## Composition

- [ ] Phrase editor
- [ ] Chord progression explorer
- [ ] Harmony experimentation
- [ ] Motif builder

## Playback

- [ ] Play composed phrases
- [ ] Instrument switching
- [ ] Tempo adjustments

## Export

- [ ] MIDI export
- [ ] MusicXML export
- [ ] Audio rendering

---

# 🌟 Future Ideas

These ideas are intentionally outside the current roadmap but represent possible future directions.

## Learning

- [ ] Adaptive difficulty
- [ ] AI-generated exercises
- [ ] Personalized practice plans
- [ ] Practice streak calendar
- [ ] Heat maps for weak notes
- [ ] Practice analytics dashboard

## Sharing

- [ ] Community lesson library
- [ ] Teacher lesson sharing
- [ ] Lesson import from URL

## Accessibility

- [ ] Colorblind-friendly themes
- [ ] Keyboard-only navigation
- [ ] Screen-reader improvements

## Platform

- [ ] Desktop application
- [ ] Cloud synchronization
- [ ] User accounts (optional)

---

# Guiding Principle

Prelude grows one musical concept at a time.

Each phase should be fully polished before moving to the next, ensuring that every new feature builds naturally on the existing architecture while reinforcing real musicianship rather than simply adding functionality.
