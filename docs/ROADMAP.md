# Prelude: MIDI Mentor — ROADMAP

> This roadmap outlines the planned evolution of Prelude from a simple sight-reading trainer into a complete browser-based musicianship platform.

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

## Current Direction

Chord Progressions are complete as part of the foundational Sequence practice platform. Ear Training is the next major capability. Remaining unchecked Harmony, Musicianship, Lesson, Builder, Playback, and Composer items continue to describe future possibilities rather than a strict delivery order.

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
- [ ] Interval identification
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

Allow users to create their own practice material.

## MIDI Step Recorder

- [ ] Measure editor
- [ ] Beat/grid editor
- [ ] Step recording using MIDI
- [ ] Duration editing
- [ ] Rest insertion
- [ ] Playback preview

## Lesson Editing

- [ ] Edit existing lessons
- [ ] Duplicate measures
- [ ] Copy/Paste measures
- [ ] JSON import/export
- [ ] Local lesson library

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
- [ ] Interval recognition
- [ ] Chord recognition by ear
- [ ] Melody playback

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
