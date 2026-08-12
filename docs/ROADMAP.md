# Prelude: MIDI Mentor — ROADMAP

> This roadmap outlines the planned evolution of Prelude from a simple sight-reading trainer into a complete browser-based musicianship platform.
>
> **Current checkpoint:** August 10, 2026 — Staff Builder, automatic same-staff polyphony, and Blocking Piece Practice Phase 1 are implemented in post-v2.3 development; final real-device QA and any release decision remain pending.

---

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

## Mobile Play

- [x] Shared Mobile Play lifecycle across Flashcards, Sequences, and Free Play
- [x] Best-effort fullscreen and landscape orientation lock with safe fallback
- [x] Focus Staff mutual exclusion and state-preserving transitions
- [x] Free Play momentary multitouch without changing graded input semantics
- [x] Focused lifecycle, integration, and notation-scaling tests

Container-driven responsive VexFlow sizing is deferred to the later UI/UX overhaul. This milestone does not include a settings drawer, onboarding, or a full mobile redesign.

Future Free Play ideas such as chord analysis, phrase history, last-measure display, rhythm, zoom controls, and automatic key detection remain unimplemented.

## Current Direction

Chord Progressions, key-aware Free Play, shared Mobile Play, melodic-interval Ear Training, Staff Builder, automatic same-staff polyphony, and Blocking Piece Practice Phase 1 are complete. Development now pauses for review and final manual QA:

1. Perform combined physical-MIDI, Chromebook touch/mouse, Android portrait/landscape, responsive, playback, and persistence QA.
2. Fix only defects confirmed by that stabilization pass.
3. Decide release scope and version after QA; no post-v2.3 release number is selected yet.
4. Review the completed Phase 1 product before selecting the next feature milestone. Melody Mode is not underway, and Piece Practice Accuracy remains a separate future Phase 2.

Remaining unchecked Harmony, Musicianship, Guided Lesson, playback-instrument, and Composer items describe future possibilities rather than a strict delivery order.

## Melody Mode Phase 1 — Implementation complete

- Seeded one/two-measure beginner generation
- Web Audio count-in/metronome and continuous MIDI/VKB capture
- Timing-led alignment with independent Pitch/Movement/Timing scores
- Read-only notation, playhead, mobile presentation, and Pitch-result staff
- Cached-PWA basic offline VKB workflow
- Final device/accessibility/airplane-mode QA remains pending

Future work remains separate: rests, 6/8/richer meters, two-hand notes, dyads/chords, adaptive difficulty, latency calibration, and detailed timing/extra-note overlays. Piece Practice Accuracy Phase 2 has not started.

---

# ✅ Post-v2.3 — Staff Builder Foundation (Completed, Unreleased)

Staff Builder provides a beginner-focused transcription and practice-material workflow. It is current post-v2.3 development and is not part of the v2.3.0 release.

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

## Automatic Same-Staff Polyphony

- [x] Deterministic derived rhythmic voices without persisted voice IDs or manual Voice controls
- [x] Staff-wide union validation with render-only implicit voice gaps
- [x] Multi-voice VexFlow rendering with authoritative event anchors
- [x] Capture, Rhythm Correction, playback, ties, and Piece Practice compatibility

---

# ✅ Post-v2.3 — Blocking Piece Practice Phase 1 (Implemented, Manual QA Pending)

- [x] Validation-gated launch from saved Staff Builder pieces
- [x] Transient attack-onset projection without `SequenceTarget` or copied score persistence
- [x] Pitch-set blocking progression across measures, chords, both staves, polyphony, rests, and ties
- [x] Physical MIDI single/chord input with the shared 225 millisecond collector
- [x] Persistent virtual-keyboard chord input with strict MIDI/VKB source separation
- [x] Start at Measure, Restart Measure, Restart Piece, targetless-measure acknowledgement, completion, and session statistics
- [x] Read-only authored-score presentation and authoritative multi-event highlighting
- [x] Exit to the retained Staff Builder library context
- [x] Automated projection, state, input, rendering, accessibility, eligibility, launch/exit, and immutability coverage
- [ ] Final physical-MIDI, Chromebook, Android, responsive, audio, and screen-reader QA

Future Piece Practice Accuracy mode remains separate: it may add continuous BPM-driven capture and post-performance feedback, but no such engine is part of Phase 1. The next product step is a pause and assessment, not immediate Melody Mode implementation.

---

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
