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

### Sight-Reading Flashcards

- Treble clef practice
- Bass clef practice
- Mixed-clef practice
- Randomized target notes
- Standard staff notation rendered with VexFlow

### Real-Time Input

- Physical MIDI keyboard support
- Interactive on-screen piano
- Immediate correct and incorrect feedback
- MIDI connection status and diagnostics

### Practice Statistics

- Accuracy
- Current streak
- Best streak
- Response time
- Session progress

### Cross-Platform Experience

- Responsive desktop and mobile layouts
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

```text
Generate Target Note
        │
        ▼
Render Standard Notation
        │
        ▼
Wait for MIDI or On-Screen Input
        │
        ▼
Normalize the Played Pitch
        │
        ▼
Compare It with the Target
        │
        ▼
Provide Feedback and Update Statistics
```

Physical MIDI input and the on-screen keyboard share the same validation path, keeping the practice experience independent of the input device.

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
├── components/
│   ├── flashcards/    # Practice sessions, controls, and statistics
│   ├── midi/          # MIDI status and diagnostic components
│   ├── notation/      # Staff and piano keyboard rendering
│   └── ui/            # Shared UI components
│
├── data/              # Static music and application data
├── hooks/             # Reusable React hooks
│
├── lib/
│   ├── midi/          # MIDI utilities
│   ├── music/         # Note logic and VexFlow helpers
│   ├── pwa/           # Progressive Web App utilities
│   └── utils/         # General shared helpers
│
├── types/             # Shared TypeScript types
├── App.tsx
├── main.tsx
└── index.css
```

For a more detailed technical explanation, see
[`ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Current Status

Prelude's core sight-reading MVP is complete and usable.

Current development is focused on expanding music-reading options and preparing the application for multi-note practice.

Near-term work includes:

- Improved enharmonic spelling
- Natural-notes-only practice
- Expanded practice ranges
- Simultaneous MIDI note tracking
- Chord flashcards
- Chord inversions

See [`ROADMAP.md`](./ROADMAP.md) for the broader development plan.

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
- Key signatures
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

The current application uses a single target note for each flashcard.

Over time, Prelude will evolve toward a shared musical lesson model:

```text
Lesson
    │
    ▼
Measures
    │
    ▼
Events
    │
    ▼
Notes
```

That model can support:

- Flashcards
- Chords
- Scales
- Arpeggios
- Guided exercises
- Songs
- Composition tools

In this architecture, a flashcard is simply the smallest possible lesson.

---

## Documentation

- [`ONBOARDING.md`](./docs/ONBOARDING.md) — Project orientation and development context
- [`VISION.md`](./docs/VISION.md) — Product purpose and learning philosophy
- [`ROADMAP.md`](./docs/ROADMAP.md) — Planned development phases
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Current structure and technical direction
- [`DECISIONS.md`](./docs/DECISIONS.md) — Important product and architectural decisions

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
