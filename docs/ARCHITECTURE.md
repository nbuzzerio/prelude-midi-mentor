# Architecture

## Overview

Prelude: MIDI Mentor is a frontend-only piano sight-reading trainer.

The application renders musical notation, receives note input from a physical MIDI keyboard or on-screen piano, compares the played note with the target, and tracks session performance.

No backend, authentication system, or database is currently required.

## Technology Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Web MIDI API
- VexFlow
- vite-plugin-pwa
- Workbox

## Runtime Architecture

The main practice loop is:

1. Generate a target note.
2. Render the target using VexFlow.
3. Receive a MIDI or on-screen piano event.
4. Normalize the played note.
5. Compare it with the target.
6. Update feedback and statistics.
7. Generate the next target.

## State Ownership

`FlashcardSession` owns the core session state:

- current practice mode
- target note
- latest played note
- answer feedback
- correct and incorrect totals
- streak
- accuracy
- response time
- MIDI note handling

Presentational components receive state and callbacks through props.

## Application Structure

```text
src/
├── components/
│   ├── flashcards/
│   │   ├── flashcard-session.tsx
│   │   ├── practice-controls.tsx
│   │   ├── practice-stats.tsx
│   │   └── target-note-card.tsx
│   ├── midi/
│   │   ├── midi-diagnostic.tsx
│   │   └── midi-status.tsx
│   ├── notation/
│   │   ├── music-staff.tsx
│   │   └── piano-keyboard.tsx
│   └── ui/
├── data/
│   └── note-ranges.ts
├── hooks/
├── lib/
│   ├── midi/
│   ├── music/
│   │   ├── notes.ts
│   │   └── vexflow.ts
│   ├── pwa/
│   │   └── register-service-worker.ts
│   └── utils/
├── types/
│   └── practice.ts
├── App.tsx
├── index.css
├── main.tsx
└── vite-env.d.ts
```
