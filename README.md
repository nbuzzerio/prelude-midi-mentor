# Prelude: MIDI Mentor

**Prelude is a browser-based piano sight-reading and musicianship trainer powered by real-time MIDI input.**

It displays notes using standard music notation, listens to a connected MIDI keyboard, and provides immediate feedback as the player practices.

The project began as a personal tool for improving note recognition and is being developed into a broader platform for learning how music works—not merely which keys to press.

## Live Demo

[Open Prelude: MIDI Mentor](https://nickbuzzerio.com/prelude/)

No account or installation is required.

A physical MIDI keyboard provides the full experience, but the on-screen keyboard can also be used.

---

## Features

### Flashcard Practice

- Treble, bass, and mixed-clef practice
- Single-note flashcards
- Major, minor, diminished, and augmented triad flashcards
- Root position, first inversion, and second inversion
- Configurable natural-note and accidental-note practice
- Standard staff notation rendered with VexFlow

### Sequence Practice

- Ascending and descending melodic intervals
- Major, natural minor, harmonic minor, and melodic minor scales
- Major and minor pentatonic scales
- Major, minor, diminished, and augmented arpeggios
- Dominant seventh, major seventh, and minor seventh arpeggios
- Curated Roman-numeral chord progressions in supported major and minor keys
- Root-position chord progressions with progression and current-chord labels
- Physical MIDI block and rolled-chord entry
- Persistent virtual-keyboard chord selection with toggle-to-deselect input
- Focus Staff support across all practice modes
- Step-by-step sequence validation
- Musically correct note spelling for intervals, scales, arpeggios, and chord progressions
- Current temporal measure view with `Measure n of m` and global step progress
- Optional presentation-only Show Whole Sequence view with readable horizontal scrolling

### Free Play

- Ungraded live notation from physical MIDI and the virtual keyboard
- Persistent grand staff with automatic treble- and bass-staff placement
- No Key or 12 supported major and minor key contexts
- Key signatures on both staves
- Key-aware diatonic and enharmonic spelling
- Automatic, Prefer sharps, and Prefer flats chromatic spelling
- Immediate respelling when notation settings change while notes are held
- Focus Staff support
- Neutral held-key highlighting for ungraded practice

### Ear Training

- Melodic interval identification from minor second through octave
- Configurable ascending and descending prompts
- Explicit Play Prompt and stable Replay Prompt controls
- Prompt-oriented feedback, streaks, accuracy, and response-time statistics
- Focus Staff exclusion and a dedicated Mobile Play answer layout

### Staff Builder

- Multi-measure authoring with treble, bass, and grand-staff MIDI or virtual-keyboard capture
- Direct correction of rhythm, rests, spelling, ties, key, time, and staff routing
- Automatic same-staff polyphony and authored upward rolled/arpeggiated chords
- Deterministic event, measure, position, and piece playback
- Local project persistence, draft recovery, structural validation, and validated Save
- Study View with score annotations and multi-system presentation
- Per-piece `.prelude.json` download and schema-validated import for local backup and recovery
- Full-piece, treble-range, and bass-range duplication without changing the source piece
- Responsive desktop, Chromebook, and mobile interaction

### Blocking Piece Practice

- Launch structurally valid saved Staff Builder pieces directly from the local library
- Practice a transient projection of the saved Staff Builder score without creating another persisted copy
- Practice one score position at a time; incorrect attempts remain blocked for retry
- Grade same-onset polyphony through one normal pitch-set check plus independent authored rolled-chord checks
- Evaluate upward rolls expressively with a tempo-relative window while retaining ordinary block-chord collection
- Support physical MIDI and persistent virtual-keyboard selection without merging their attempts
- Respect authored rests, pitch-specific ties, independent grand-staff rhythm, and automatic same-staff polyphony
- Start at any measure, restart the current measure or selected practice range, and return to the Staff Builder library
- Reuse the authored score as read-only notation without creating a copied Sequence score

Blocking Piece Practice Phase 1 grades pitch attacks and progression only. It does not grade BPM, note-hold duration, rhythmic timing, or continuous performance; those remain separate possible future Accuracy-mode work.

### Real-Time Input and Feedback

- Physical MIDI keyboard support
- Interactive on-screen piano
- Immediate correct and incorrect feedback
- MIDI connection status and diagnostics
- One user-initiated MIDI connection remains active while switching Prelude modes
- Simultaneous MIDI note tracking
- Rolled chord support
- Grace-based transitions between sequence notes
- Sample-based piano playback

### Melody Mode

- Continuous, non-blocking one- or two-measure sight-reading in treble or bass
- C/G/F major and A/D natural minor at 50, 60, 70, or 80 BPM
- Physical MIDI and momentary on-screen-keyboard input
- Count-in/metronome timing and a two-quarter-beat preparatory display lead-in
- Independent Pitch, Movement, and attack-Timing scores
- Pitch-result staff: green correct, dashed light blue missed, red wrong pitch; timing is scored separately
- Seeded Retry Same and Try Another exercises
- Timed diagnostic sessions with Session Review and targeted repair retries
- Original Sight Read evidence preserved separately from latest and accumulated Repair evidence
- Interval Trouble analytics reported independently for Sight Read and Repair attempts
- Explicit Mobile Play that preserves setup, count-in, performance, and results state
- Basic offline VKB workflow after the installed/loaded PWA has cached its assets

Melody is monophonic 4/4 without rests, chords, two-hand material, hold-duration grading, latency calibration, or server-side/persisted analytics. Timed diagnostic and repair evidence lasts only for the current in-memory session.

### Practice Statistics

- Accuracy
- Current streak
- Response time
- Session progress
- Separate statistics for flashcard and sequence practice

### Cross-Platform Experience

- Responsive desktop, tablet, and mobile layouts
- Explicit Mobile Play in Flashcards, Sequences, Free Play, Ear Training, Melody, and active Piece Practice
- Best-effort fullscreen and landscape orientation requests with a usable fallback when browser APIs refuse or are unavailable
- Chromebook MIDI support
- Installable Progressive Web App
- Offline application shell

---

## Why Prelude?

Many piano-learning applications use falling notes, highlighted keys, or memorized finger patterns.

Those tools can help someone reproduce a song, but they do not always develop skills that transfer to unfamiliar sheet music.

Prelude takes a notation-first approach:

```text
Standard Notation
        +
Real-Time MIDI Input
        +
Immediate Feedback
        =
Transferable Musicianship
```

The goal is to connect three ideas:

1. What a note looks like on the staff
2. Where that note exists on the keyboard
3. What that note sounds and feels like when played

---

## How It Works

Prelude currently provides six complementary top-level modes:

```text
Flashcards
    └── Identify isolated notes and triads

Sequences
    └── Play ordered intervals, scales, arpeggios, and chord progressions

Free Play
    └── View live notation while practicing without grading

Ear Training
    └── Identify ascending and descending melodic intervals by sound

Melody
    └── Perform continuous one- or two-measure sight-reading exercises

Staff Builder
    |-- Transcribe and edit practice material directly on a score
```

Flashcards and Sequences generate musical targets, render them using standard notation, validate MIDI or virtual-piano input, and provide immediate feedback.

Free Play removes the target and grading layers. Physical MIDI and virtual-piano notes share the same live held-note state and key-aware spelling pipeline before appearing on a persistent grand staff. Players can use No Key or one of the supported major and minor keys, choose a chromatic spelling preference, and change notation settings without clearing or replaying held notes.

Staff Builder is a separate learning-focused score editor. It combines beginner-oriented capture, direct score correction, validation, deterministic playback, Study View, annotations, duplication, and local projects without turning Prelude into a professional notation editor or a Guided Lesson engine. Structurally valid saved pieces can launch Piece Practice, which reads a transient projection of that authoritative score and advances only after all checks at the current score position are complete. Piece Practice is not a seventh top-level mode.

Shared MIDI, notation, keyboard, audio, interval-domain, and musical-event playback systems keep the experience consistent while each mode retains its own state machine.

---

## Technology Stack

### Application

- React
- TypeScript
- Vite
- Tailwind CSS

### Music

- Web MIDI API
- VexFlow
- Sample-based piano playback

### Progressive Web App

- vite-plugin-pwa
- Workbox

### Deployment

- DigitalOcean
- Nginx
- GitHub Actions
- Self-hosted deployment runner

---

## Getting Started

### Requirements

- Node.js
- pnpm
- A browser with Web MIDI support for physical keyboard input

Google Chrome and other Chromium-based browsers generally provide the strongest Web MIDI support.

### Installation

```bash
git clone https://github.com/nickbuzzerio/prelude-midi-mentor.git
cd prelude-midi-mentor
pnpm install
```

### Start the Development Server

```bash
pnpm dev
```

Open the local URL shown in the terminal.

### Production Build

```bash
pnpm build
```

### Preview the Production Build

```bash
pnpm preview
```

### Lint the Project

```bash
pnpm lint
```

---

### Run the Test Suite

```bash
pnpm test
```

Prelude uses **Vitest** and **React Testing Library** for automated testing.

Prelude's automated suite covers:

- music-theory utilities and notation-aware spelling
- flashcard, interval, scale, arpeggio, triad, and chord-progression generation
- deterministic chord construction and curated progression realization
- answer and sequence validation
- flashcard and sequence statistics
- stateful practice hooks
- Web MIDI integration
- focused session orchestration
- shared Mobile Play browser lifecycle, Focus Staff coordination, state preservation, and mode-specific presentation
- Ear Training target generation, prompt scheduling, grading, and session statistics
- Staff Builder score invariants, capture, correction, validation, persistence, playback, interaction geometry, radial controls, and responsive presentation
- Blocking Piece Practice projection, ties/polyphony, blocking progression, MIDI/VKB input separation, read-only presentation, validation-gated launch, exit, and source/storage immutability
- Staff Builder schema migration, annotations, Study View, duplication, and rolled-chord authoring
- Melody timed diagnostics, Session Review, repairs, interval analytics, and preparatory lead-in

Mobile Play preserves each mode's feature-owned session and input contract: Flashcards and Sequences retain graded toggle input, Free Play alone adds momentary multitouch press/release input, Melody retains its continuous recorder/clock/source lock, and Piece Practice retains blocking progression and pending chord input. Mobile Play and Focus Staff are mutually exclusive where both are available. Fullscreen and landscape lock are enhancements rather than requirements; if fullscreen exits externally, the Mobile Play layout remains active until the user explicitly exits it.

Run the complete release verification workflow with:

```bash
pnpm verify
```

See [`TESTING.md`](./docs/TESTING.md) for the complete testing philosophy and coverage.

---

## Using a MIDI Keyboard

1. Connect the MIDI keyboard to the computer.
2. Open Prelude in a supported browser.
3. Grant MIDI access when prompted.
4. Confirm that the device appears in the MIDI status area.
5. Begin a flashcard session and play the displayed note.

Some MIDI interfaces label their cables from the interface's perspective:

```text
Interface MIDI OUT → Keyboard MIDI IN
Interface MIDI IN  → Keyboard MIDI OUT
```

When a device is not detected, check the cable direction and use Prelude's MIDI diagnostic display.

Physical MIDI input depends on browser Web MIDI support and user permission; Chromium-based desktop browsers provide the most reliable current path. The virtual keyboard remains available where physical MIDI is unavailable, but MIDI, touch, audio-autoplay, fullscreen, and orientation behavior can vary by browser and device and should be verified before relying on a particular setup.

---

## Project Structure

```text
src/
├── assets/
│   └── audio/
│
├── components/
│   ├── audio/
│   ├── midi/
│   └── notation/
│
├── data/
│
├── features/
│   ├── ear-training/
│   ├── flashcards/
│   ├── freeplay/
│   ├── melody/
│   ├── piece-practice/
│   ├── sequences/
│   └── staff-builder/
│
├── hooks/
│
├── lib/
│   ├── audio/
│   ├── music/
│   │   └── generators/
│   ├── practice/
│   └── pwa/
│
├── types/
│
├── App.tsx
├── main.tsx
└── index.css
```

- **components/** — React UI components organized by feature and presentation.
- **data/** — Static musical data used by the application.
- **features/** — Feature-specific state, orchestration, and hooks.
- **hooks/** — Cross-feature reusable React hooks.
- **lib/** — Reusable audio, music, practice, MIDI, and platform logic that is independent of React.
- **types/** — Shared TypeScript models used throughout the application.

Current feature domains under `features/` include `ear-training`, `flashcards`, `freeplay`, `melody`, `sequences`, `staff-builder`, and the Sequence-adjacent `piece-practice` workflow. Piece Practice is launched from Staff Builder rather than exposed as a permanent top-level mode.

For a more detailed technical explanation, see
[`ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Current Status

Prelude's latest repository tag remains **v2.4.0 — Staff Builder** until the repository owner completes the manual release steps. The repository and application metadata are prepared for the backward-compatible **v2.5.0** release candidate.

The application now supports six complementary top-level modes:

- Flashcards for isolated notes and triads
- Sequences for intervals, scales, arpeggios, and chord progressions
- Free Play for live grand-staff notation without grading
- Ear Training for melodic interval identification by sound
- Melody for continuous one- or two-measure sight-reading and independent Pitch, Movement, and Timing results
- Staff Builder for beginner-friendly score transcription and editing

The release candidate includes Piece Practice, automatic same-staff polyphony, import/export, coordinated Mobile Play, annotations and Study View, Melody timed diagnostics and repair review, interval analytics, preparatory lead-in, piece duplication, and authored/graded rolled chords. A final owner sanity check, manual tag, deployment verification, and representative device/PWA smoke checks remain before release completion. Melody duration/hold grading, persisted practice evidence, and Piece Practice Accuracy remain future work.

`package.json` is the authoritative source for the version displayed in Prelude's navigation. It is set to `2.5.0`, so the prepared release candidate displays `v2.5.0`; the matching annotated tag is still created manually by the repository owner.

Staff Builder projects and drafts live only in the current browser's local storage. There is no account, cloud synchronization, or server-side analytics. Export important pieces as `.prelude.json` files: clearing site data, using another browser/profile, or losing the device can otherwise remove local work. An import restores a piece, not session history or practice evidence.

The PWA precaches the application shell and bundled piano samples for a basic offline virtual-keyboard workflow after a successful online load/install. Physical MIDI, browser permission, installation, update delivery, and offline behavior remain browser/device dependent and require release smoke testing.

See [`ROADMAP.md`](./docs/ROADMAP.md) for completed milestones and future development areas.

---

## Long-Term Direction

Prelude is designed to grow from single-note recognition into a complete browser-based musicianship platform.

Possible expansion areas include:

### Deeper Harmony

- Harmonic-interval study beyond current melodic interval practice
- Chord identification and analysis beyond current triads and progressions
- Suspended chords
- Additional seventh-chord practice
- Voicing and inversion study beyond current triad flashcards

### Deeper Technique and Theory

- Expanded scale and arpeggio material
- Expanded key-signature practice
- Cadences
- Dedicated rhythm practice
- Ear training beyond melodic interval identification

### Guided Lessons

- Short musical phrases
- Left- and right-hand isolation
- Ostinatos
- Tempo control
- Measure looping
- Teacher-created exercises
- Complete pieces

### Lesson Creation

Staff Builder now supplies the practical score-transcription foundation: users can select rhythmic positions, capture MIDI or virtual-keyboard notes, correct rhythm and rests, preview playback, and save local projects.

Future Lesson Builder work will build on that foundation with Guided Lesson integration, teacher workflows, sharing, structured interchange, and lesson consumption. Staff Builder projects are not currently Guided Lessons.

### Creative Exploration

Long-term composition tools may include:

- Phrase building
- Chord progression experiments
- Motif development
- Instrument playback
- MIDI export
- MusicXML export

Prelude is not intended to become a professional DAW or full notation editor. Creative tools will remain focused on learning and experimentation.

---

## Architectural Direction

Prelude uses separate practice models for isolated and ordered exercises.

`PracticeTarget` represents isolated musical concepts such as individual notes and triads.

`SequenceTarget` represents ordered musical material such as intervals, scales, arpeggios, and chord progressions.

Free Play bypasses target generation and grading. It preserves held MIDI pitches, applies Free Play-owned key and chromatic-spelling context, and supplies explicitly spelled notes to the shared grand-staff renderer.

Staff Builder owns an application-level score model independent of VexFlow. Capture Notes and Rhythm Correction are separate workflows over that score; VexFlow remains decorative while React-owned controls use public renderer geometry for direct interaction. Deterministic score playback reuses the shared musical-event player.

These modes share lower-level systems for MIDI input, virtual-piano interaction, music notation, audio playback, and musical note models while keeping their session behavior independent.

Future lesson-based features can build on these existing primitives without forcing flashcard, sequence, and ungraded practice into one oversized engine.

---

## Documentation

- [`ONBOARDING.md`](./docs/ONBOARDING.md) — Project orientation and development context
- [`VISION.md`](./docs/VISION.md) — Product purpose and learning philosophy
- [`ROADMAP.md`](./docs/ROADMAP.md) — Planned development phases
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Current structure and technical direction
- [`DECISIONS.md`](./docs/DECISIONS.md) — Important product and architectural decisions
- [`TESTING.md`](./docs/TESTING.md) — Testing philosophy and coverage
- [`DEVLOG.md`](./docs/DEVLOG.md) — Release history and prepared v2.5.0 notes
- [`RELEASING.md`](./docs/RELEASING.md) — Versioning, validation, tagging, and deployment process

---

## Product Principles

Prelude is guided by several principles:

- Learning before novelty
- Standard notation before imitation
- Understanding before speed
- Progression before complexity
- Reuse before duplication
- Browser-first accessibility
- Simple, coherent milestones

Every new feature should strengthen the student's understanding of music.

---

## License

This project is available under the [MIT License](./LICENSE).
