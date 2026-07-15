# Prelude: MIDI Mentor — Onboarding

## Project Overview

Prelude: MIDI Mentor is a browser-based piano sight-reading trainer built with Next.js, React, TypeScript, Tailwind CSS, and the Web MIDI API.

The project began as a focused replacement for bass-clef flashcards that only use touch controls. The application will instead let the user read a note from a musical staff and answer using a real MIDI piano keyboard.

## Current MVP Goal

Display one note at a time and determine whether the correct piano key was played through MIDI input.

## Current Status

The initial front-end practice interface is complete.

Implemented:

- Bass, treble, and mixed practice modes
- Random target-note generation
- Simulated correct and incorrect answers
- Correct, incorrect, streak, accuracy, and response-time statistics
- Rudimentary four-octave piano keyboard
- Latest-answer key highlighting
- Responsive dark-mode layout
- MIDI diagnostic component
- Graceful empty-device handling

Not yet implemented:

- VexFlow notation rendering
- Natural-note-only filtering
- Real MIDI integration with the flashcard session
- Chromebook hardware testing
- Persistence
- Difficulty levels

## Hardware Status

The original E-MU XMIDI 1x1 interface was not recognized by Windows or Chrome.

A replacement class-compliant LEKATO USB MIDI interface is expected Thursday.

The Yamaha keyboard uses traditional five-pin MIDI IN and MIDI OUT ports.

Connection should be:

Keyboard MIDI OUT → Interface MIDI IN → USB computer

## Architecture

`FlashcardSession` currently owns:

- practice mode
- target note
- feedback
- statistics
- latest answer
- response timing

Presentational components include:

- `MidiStatus`
- `PracticeControls`
- `PracticeStats`
- `TargetNoteCard`
- `PianoKeyboard`
- `StaffPlaceholder`

Music utilities are located under:

- `src/lib/music`
- `src/data`
- `src/types`

## Important Configuration

The TypeScript alias is configured so that:

```text
@/* → ./src/*
```
