# Architecture

## Overview

Prelude: MIDI Mentor is a frontend-only piano sight-reading trainer.

The application displays musical notation, receives note input from a physical MIDI keyboard, compares the played note with the target, and tracks session performance.

No backend, authentication, or database is required for the MVP.

## Technology Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Web MIDI API
- VexFlow

## Application Structure

```text
src/
├── app/
│   └── page.tsx
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
│   │   ├── piano-keyboard.tsx
│   │   └── staff-placeholder.tsx
│   └── ui/
├── data/
│   └── note-ranges.ts
├── hooks/
├── lib/
│   ├── midi/
│   ├── music/
│   │   └── notes.ts
│   └── utils/
└── types/
    └── practice.ts
```
