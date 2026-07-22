# Prelude: MIDI Mentor — ARCHITECTURE

> This document describes the current architecture of Prelude and the responsibilities of its major systems. It focuses on how the application is organized today rather than every possible future direction.

---

# Overview

Prelude is a browser-based musicianship application for learning piano through standard notation and real-time input.

The current application provides a flashcard-based practice engine supporting:

- Treble, bass, and mixed clefs
- Natural notes and accidentals
- Single notes and triads
- Major, minor, diminished, and augmented triads
- Root position, first inversion, and second inversion
- Physical MIDI keyboards
- Virtual piano input
- Visual and audio feedback
- Session statistics

Prelude is currently a frontend-only application built with React and Vite.

---

# Design Goals

The architecture follows a few simple principles:

- Keep music logic separate from React UI.
- Keep reusable logic separate from feature-specific state.
- Prefer small focused modules over large components.
- Share one music model across rendering, playback, and validation.
- Avoid premature abstractions.
- Build features incrementally.

---

# Technology Stack

## Application

- React
- TypeScript
- Vite
- Tailwind CSS

## Music

- Web MIDI API
- VexFlow
- Web Audio API

## Platform

- vite-plugin-pwa
- GitHub Actions
- Nginx
- DigitalOcean

---

# High-Level Architecture

```text
App
│
└── FlashcardSession
    ├── Feature Hooks
    ├── Practice Logic
    ├── Music Rendering
    ├── MIDI Input
    ├── Virtual Piano
    ├── Audio
    └── Statistics
```

`FlashcardSession` coordinates the practice experience by composing focused hooks, utilities, and presentation components.

---

# Project Structure

```text
src/
├── assets/
├── components/
├── data/
├── features/
├── hooks/
├── lib/
├── types/
├── App.tsx
└── main.tsx
```

The repository is organized into a few major layers.

## components/

React presentation components.

Important groups include:

- audio
- flashcards
- midi
- notation
- ui

`flashcard-session.tsx` is the primary coordinator for the flashcard feature.

## features/

Contains stateful behavior that belongs to a specific feature.

The current flashcard feature owns:

- practice settings
- target lifecycle
- MIDI attempt collection
- correct-answer sequencing
- timing constants

Current hooks include:

- `useFlashcardSettings`
- `useFlashcardTarget`
- `useMidiChordAttempt`
- `useCorrectAnswerSequence`

## hooks/

Reusable hooks shared outside a single feature.

Currently this contains browser-level MIDI integration (`useMidi`).

## lib/

Reusable domain logic independent of React.

Current domains include:

### audio/

Interface feedback and piano playback.

### music/

Music models, notation helpers, and generators.

### practice/

Reusable practice logic including:

- answer validation
- session statistics

### pwa/

Progressive Web App registration.

## data/

Static application data such as note ranges.

## types/

Shared TypeScript models used throughout the application.

---

# Flashcard Session

`FlashcardSession` coordinates the current practice loop.

Its responsibilities include:

- rendering the current target
- coordinating feature hooks
- updating statistics
- triggering feedback
- advancing to the next target

Most implementation details live in hooks and reusable utilities rather than inside the component itself.

---

# Feature Hooks

## useFlashcardSettings

Owns practice configuration.

Examples include:

- clef selection
- enabled exercises
- enabled chord qualities
- enabled inversions
- display preferences

## useFlashcardTarget

Owns the lifecycle of the current practice target.

Responsibilities include:

- generating targets
- storing the active target
- locking answers
- advancing after success

## useMidiChordAttempt

Collects nearby MIDI note events into a single attempt.

This hook does not determine correctness.

Its only responsibility is deciding which notes belong to one performed attempt.

## useCorrectAnswerSequence

Coordinates the delayed actions that occur after a correct answer, such as timing and target advancement.

---

# Practice Logic

Reusable practice rules live in `lib/practice`.

These utilities are intentionally independent of React so they can be reused and tested independently.

Current responsibilities include:

- answer validation
- session statistics

---

# Music Architecture

Prelude keeps musical data separate from notation rendering.

```text
PracticeTarget
      │
      ▼
Music Model
      │
      ▼
VexFlow
```

VexFlow renders notation but does not own Prelude's musical model.

---

# Input Flow

```text
MIDI Keyboard / Virtual Piano
            │
            ▼
     Input Collection
            │
            ▼
     Answer Validation
            │
     ┌──────┴──────┐
     ▼             ▼
 Correct      Incorrect
     │
     ▼
 Next Target
```

Both physical MIDI and virtual piano ultimately use the same validation rules.

---

# Audio

Prelude currently has two audio systems.

**Interface feedback**

- success sounds
- incorrect sounds

**Instrument playback**

- piano samples
- virtual key playback
- chord playback

Keeping these systems separate makes each easier to evolve independently.

---

# State Ownership

State is distributed according to responsibility.

## FlashcardSession

Coordinates the overall practice session.

## useFlashcardSettings

Owns configuration state.

## useFlashcardTarget

Owns target lifecycle.

## useMidiChordAttempt

Owns the current MIDI attempt.

## useCorrectAnswerSequence

Owns post-success timing.

## useMidi

Owns browser MIDI integration.

---

# Current Runtime Flow

```text
Read Settings
      │
      ▼
Generate Target
      │
      ▼
Render Notation
      │
      ▼
Receive Input
      │
      ▼
Validate Attempt
      │
  ┌───┴────┐
  ▼        ▼
Correct  Incorrect
  │
  ▼
Next Target
```

---

# Architectural Principles

When extending Prelude:

- Keep music logic independent of React.
- Keep validation separate from input collection.
- Prefer reusable domain logic over duplicated component logic.
- Let feature hooks own coherent behavior.
- Let `FlashcardSession` coordinate rather than implement everything.
- Keep documentation synchronized with architectural changes.
