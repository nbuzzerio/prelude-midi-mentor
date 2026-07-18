# Prelude: MIDI Mentor — ARCHITECTURE

> This document describes the technical architecture of Prelude: MIDI Mentor, how the project is currently organized, and the long-term architectural direction.

---

# Overview

Prelude is a browser-based musicianship platform focused on teaching piano through standard music notation and real-time MIDI interaction.

The current application centers around single-note sight-reading flashcards, but the architecture is intentionally designed to expand into chords, scales, guided lessons, ear training, and composition tools without requiring major rewrites.

Prelude is currently a frontend-only application and requires no backend services, authentication, or database.

---

# Design Goals

Prelude is built around several core architectural principles.

- Modular React components
- Clear separation of UI and music logic
- Browser-first development
- Progressive enhancement
- Reusable systems over one-off features
- Small, maintainable components
- Long-term extensibility

Every major feature should build upon existing systems rather than introducing parallel implementations.

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

## Music

- Web MIDI API
- VexFlow

## Platform

- vite-plugin-pwa
- Workbox
- GitHub Actions
- Nginx
- DigitalOcean

---

# High-Level Architecture

Today, Prelude revolves around a single flashcard practice session.

```text
App
│
├── Flashcard Session
│     ├── Practice Controls
│     ├── Music Staff
│     ├── Piano Keyboard
│     └── Practice Statistics
│
├── MIDI
│     ├── Status
│     └── Diagnostic
│
└── Music Library
      ├── Notes
      ├── VexFlow
      └── MIDI Helpers
```

Each area has a single responsibility, making future expansion straightforward.

---

# Project Structure

```text
src/
├── components/
│   ├── flashcards/
│   │   ├── flashcard-session.tsx
│   │   ├── practice-controls.tsx
│   │   ├── practice-stats.tsx
│   │   └── target-note-card.tsx
│   │
│   ├── midi/
│   │   ├── midi-diagnostic.tsx
│   │   └── midi-status.tsx
│   │
│   ├── notation/
│   │   ├── music-staff.tsx
│   │   └── piano-keyboard.tsx
│   │
│   └── ui/
│
├── data/
│   └── note-ranges.ts
│
├── hooks/
│
├── lib/
│   ├── midi/
│   ├── music/
│   │   ├── notes.ts
│   │   └── vexflow.ts
│   ├── pwa/
│   └── utils/
│
├── types/
│
├── App.tsx
├── main.tsx
└── index.css
```

---

# Current Folder Responsibilities

## components/

Reusable React UI components grouped by feature.

### flashcards/

Contains the primary practice experience including session logic, controls, statistics, and target note display.

### midi/

Displays MIDI connection status and diagnostic tools.

### notation/

Responsible for rendering the music staff and interactive piano keyboard.

### ui/

Generic reusable UI components that are not music-specific.

---

## data/

Static application data.

Examples include note ranges and future configuration data.

---

## hooks/

Custom React hooks.

Currently lightweight, but intended to house reusable application logic as the project grows.

---

## lib/

Reusable business logic separated from React.

### lib/midi/

MIDI utilities.

### lib/music/

Music theory, note utilities, notation helpers, and VexFlow rendering.

### lib/pwa/

Progressive Web App utilities.

### lib/utils/

General shared helper functions.

---

## types/

Shared TypeScript interfaces and types used throughout the application.

---

# Current Runtime Flow

The application's primary loop is currently:

```text
Generate Target Note
        │
        ▼
Render Staff with VexFlow
        │
        ▼
Wait for MIDI / On-Screen Input
        │
        ▼
Normalize Played Note
        │
        ▼
Compare Against Target
        │
        ▼
Update Statistics
        │
        ▼
Generate Next Note
```

Everything in Prelude currently supports this practice loop.

---

# State Ownership

The primary application state currently lives inside:

`FlashcardSession`

It owns:

- practice mode
- target note
- played note
- feedback
- streak
- accuracy
- response time
- statistics
- MIDI interaction

Presentation components remain as stateless as practical and communicate through props and callbacks.

---

# Music Architecture

Prelude intentionally separates music concepts from rendering.

```text
Target Note

↓

Music Model

↓

VexFlow Renderer

↓

Rendered Staff
```

Likewise, MIDI input is separated from notation rendering.

```text
MIDI Input

↓

Normalize Note

↓

Practice Engine

↓

Feedback
```

This separation allows new practice modes to reuse the same underlying music systems.

---

# Long-Term Architecture

Prelude is intentionally evolving toward a generalized lesson engine.

Rather than every practice mode implementing its own logic, everything will eventually be represented using the same hierarchy.

```text
Lesson
│
├── Measures
│
├── Events
│
└── Notes
```

An Event may represent:

- single note
- interval
- chord
- rest
- sustained note
- future articulations

This unified model naturally supports:

- Flashcards
- Chord Trainer
- Scale Trainer
- Arpeggio Trainer
- Guided Lessons
- Songs
- Composition Tools

Flashcards simply become the smallest possible lesson.

---

# Future Lesson Builder

Lesson playback and lesson creation are intentionally separate systems.

The planned Lesson Builder will allow users to create exercises using MIDI step recording rather than graphical notation editing.

Planned capabilities include:

- measure editor
- beat/grid editor
- MIDI step recording
- duration editing
- playback preview
- JSON import/export

This approach provides a much simpler workflow for students, teachers, and composers while avoiding the complexity of a traditional notation editor.

---

# Future Audio Architecture

Current versions rely on the user's physical keyboard for audio.

Future versions may optionally support browser-based playback using SoundFonts.

```text
MIDI Keyboard
      │
      ▼
Prelude
      │
      ▼
Playback Engine
      │
      ▼
SoundFont Library
      │
      ▼
Speakers
```

Keeping playback separate from lesson logic allows different instrument libraries to be swapped without affecting the rest of the application.

---

# Guiding Principles

When extending Prelude:

- Build one musical concept at a time.
- Prefer reusable systems over duplicated logic.
- Keep UI separate from music logic.
- Build the simplest useful version first.
- Avoid premature abstraction.
- Document important architectural decisions.

The long-term goal is to build a cohesive musicianship platform where every new feature naturally extends the existing architecture rather than replacing it.
