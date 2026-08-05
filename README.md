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

### Real-Time Input and Feedback

- Physical MIDI keyboard support
- Interactive on-screen piano
- Immediate correct and incorrect feedback
- MIDI connection status and diagnostics
- Simultaneous MIDI note tracking
- Rolled chord support
- Grace-based transitions between sequence notes
- Sample-based piano playback

### Practice Statistics

- Accuracy
- Current streak
- Response time
- Session progress
- Separate statistics for flashcard and sequence practice

### Cross-Platform Experience

- Responsive desktop, tablet, and mobile layouts
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

Prelude currently provides three complementary practice modes:

```text
Flashcards
    └── Identify isolated notes and triads

Sequences
    └── Play ordered intervals, scales, arpeggios, and chord progressions

Free Play
    └── View live notation while practicing without grading
```

Flashcards and Sequences generate musical targets, render them using standard notation, validate MIDI or virtual-piano input, and provide immediate feedback.

Free Play removes the target and grading layers. Physical MIDI and virtual-piano notes share the same live held-note state and key-aware spelling pipeline before appearing on a persistent grand staff. Players can use No Key or one of the supported major and minor keys, choose a chromatic spelling preference, and change notation settings without clearing or replaying held notes.

Shared MIDI, notation, keyboard, and audio systems keep the experience consistent across all three modes.

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
│   ├── flashcards/
│   │   ├── components/
│   │   └── hooks/
│   ├── freeplay/
│   └── sequences/
│       ├── components/
│       └── hooks/
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

For a more detailed technical explanation, see
[`ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Current Status

Prelude's v2.0 practice foundation is feature-complete.

The application now supports three complementary practice modes:

- Flashcards for isolated notes and triads
- Sequences for intervals, scales, arpeggios, and chord progressions
- Free Play for live grand-staff notation without grading

Current development is focused on automated testing, documentation, final manual verification, and the v2.0.0 release.

See [`ROADMAP.md`](./docs/ROADMAP.md) for completed milestones and future development areas.

---

## Long-Term Direction

Prelude is designed to grow from single-note recognition into a complete browser-based musicianship platform.

Planned areas include:

### Harmony

- Intervals
- Major and minor chords
- Diminished and augmented chords
- Suspended chords
- Seventh chords
- Chord inversions

### Technique and Theory

- Scales
- Arpeggios
- Expanded key-signature practice
- Cadences
- Rhythm
- Ear training

### Guided Lessons

- Short musical phrases
- Left- and right-hand isolation
- Ostinatos
- Tempo control
- Measure looping
- Teacher-created exercises
- Complete pieces

### Lesson Creation

A future MIDI step recorder will allow students and teachers to create exercises by:

1. Selecting a rhythmic position
2. Playing notes through MIDI
3. Assigning a duration
4. Previewing the result
5. Saving or exporting the lesson

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
