# Prelude: MIDI Mentor — ONBOARDING

> **Version:** 1.1
> **Last Updated:** July 2026
> **Current Milestone:** Multi-Note Musicianship MVP

---

# Project Overview

Prelude: MIDI Mentor is an open-source, browser-based musicianship platform focused on teaching piano through standard music notation and real-time MIDI interaction.

The project began as a lightweight sight-reading trainer for bass clef practice but has grown into a long-term platform for learning music theory, keyboard technique, harmony, ear training, and eventually composition.

Unlike many beginner piano applications, Prelude is designed around **reading music**, not memorizing falling notes. Every feature should reinforce transferable musicianship skills.

---

# Vision

Prelude aims to become a complete browser-based musicianship platform.

Long-term goals include:

- Sight-reading practice
- Chord recognition and construction
- Scale and interval training
- Guided lessons
- Teacher-created exercises
- Ear training
- Rhythm practice
- Interactive lesson builder
- Browser-based composition tools
- Multiple instrument playback using SoundFonts

The goal is **not** to compete with professional DAWs or notation software.

The goal is to create the best possible learning experience for piano students using modern web technologies.

---

# Project Philosophy

Every feature should answer three questions:

1. What musical skill does this teach?
2. Why is this valuable to a pianist?
3. Does this reinforce real musicianship?

Prelude prioritizes:

- Standard sheet music
- Understanding over memorization
- Progressive learning
- Clean, intuitive interfaces
- Browser-first accessibility
- Professional software architecture

Features should never exist simply because they are technically interesting—they should improve the learning experience.

---

# Current MVP Goal

The current milestone focuses on building a complete multi-note musicianship practice loop.

Users should be able to:

1. View notation rendered on a musical staff.
2. Play the answer using either:
   - a MIDI keyboard
   - the on-screen keyboard
3. Receive immediate visual and audio feedback.
4. Practice both single notes and triads.
5. Track performance over time.
6. Practice anywhere using an installable Progressive Web App.

---

# Current Status

The core flashcard system is functional.

Completed features include:

## Practice

- Treble clef mode
- Bass clef mode
- Mixed mode
- Single-note flashcards
- Diatonic triad flashcards
- Configurable exercise types
- Random target generation
- Session statistics
- Accuracy tracking
- Response-time tracking
- Streak tracking

## Input

- Physical MIDI keyboard support
- On-screen piano keyboard
- Simultaneous MIDI note tracking
- Timed chord collection
- Rolled chord support
- Exact chord validation
- MIDI diagnostics
- Chromebook compatibility

## Feedback

- Immediate visual feedback
- Browser-generated audio feedback
- Adjustable feedback volume
- Persistent local preferences

## Notation

- Dynamic notation rendering with VexFlow
- Ledger lines
- Accidentals
- Responsive notation scaling

## Platform

- Responsive desktop layout
- Responsive tablet layout
- Responsive mobile layout
- Progressive Web App
- Offline application shell
- Automated deployment
- Production hosting on DigitalOcean

---

# Current Development Focus

Development is currently focused on expanding the flashcard engine into a more complete musicianship platform.

Immediate priorities are:

1. Interval practice
2. Additional chord qualities
3. Expanded practice settings
4. Scale practice
5. Improved enharmonic spelling
6. Long-term lesson architecture

---

# Long-Term Architecture

Prelude is intentionally being designed so that today's flashcard system can evolve naturally into tomorrow's guided lesson system.

The current practice engine is built around a generalized `PracticeTarget` model rather than a single target note.

A `PracticeTarget` can represent one or more notes, allowing the same validation and rendering systems to support:

- Single-note flashcards
- Triad flashcards
- Future interval exercises
- Future chord exercises

This provides a simple, reusable foundation while keeping the current practice engine focused on isolated musical concepts.

Long-term, Prelude may evolve toward a structured lesson architecture:

Lesson

↓

Measures

↓

Events

↓

Notes

This larger model could power:

- Flashcards
- Chord practice
- Scale practice
- Arpeggio practice
- Guided lessons
- Songs
- Composition tools

The current `PracticeTarget` model should remain the foundation for isolated practice exercises until sequence-based features (such as rhythm, phrases, and complete lessons) justify introducing the larger lesson architecture.

---

# Teaching Philosophy

Prelude is designed to teach concepts—not just songs.

Examples include:

- reading notes
- recognizing intervals
- building chords
- understanding scales
- practicing ostinatos
- learning cadences
- developing hand independence
- understanding harmony

Songs become one application of these skills rather than the primary learning method.

---

# Development Philosophy

When contributing to Prelude:

- Favor small, focused commits.
- Update documentation when meaningful architectural changes occur.
- Keep components modular.
- Document architectural decisions.
- Prefer simple solutions before introducing abstractions.
- Build features that can be expanded rather than rewritten.

Every new feature should fit naturally into the long-term vision of the application.

---

# Documentation

Project documentation consists of:

- ONBOARDING.md — Project overview and current status
- ROADMAP.md — Planned milestones and upcoming features
- ARCHITECTURE.md — Technical design and project structure
- DECISIONS.md — Record of important architectural decisions
- VISION.md — Long-term goals and design philosophy
- README.md — Public project overview

New contributors should read these documents before beginning
development.
