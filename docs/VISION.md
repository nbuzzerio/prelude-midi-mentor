# Prelude: MIDI Mentor — VISION

> Prelude is a browser-based musicianship platform designed to help students learn how music works, not merely which keys to press.

---

# Purpose

Prelude exists to make music learning more interactive, accessible, and understandable.

The project began as a MIDI-powered sight-reading trainer, but has grown into a broader browser-based musicianship platform:

- teach standard notation
- connect written music to the keyboard
- reinforce music theory through practice
- support targeted lessons
- encourage experimentation and composition
- make high-quality music-learning tools available in the browser

Prelude should help students move from recognizing isolated notes to understanding complete musical ideas.

---

# The Problem

Many beginner piano applications focus on imitation.

They show:

- falling notes
- highlighted keys
- finger sequences
- simplified visual cues

These tools can help users reproduce a song, but they do not always develop skills that transfer to:

- printed sheet music
- unfamiliar pieces
- ensemble playing
- music theory
- composition
- independent practice

Traditional notation and theory tools often sit at the opposite extreme. They may be powerful, but they can feel technical, slow, or disconnected from actually playing an instrument.

Prelude aims to bridge that gap.

---

# Core Vision

Prelude should combine:

```text
Standard Notation
        +
Real-Time Practice
        +
Immediate Feedback
        +
Progressive Musicianship
```

The result should feel more interactive than a method book and more educational than a rhythm game.

---

# Learning Philosophy

Prelude is built around understanding.

Students should learn:

- what a note is
- where it appears on the staff
- where it lives on the keyboard
- how it relates to nearby notes
- how notes combine into intervals and chords
- how chords belong to keys
- how rhythm organizes sound
- how phrases and patterns create music

The application should gradually reveal these relationships instead of presenting them as disconnected facts.

---

# Standard Notation First

Standard sheet music is the primary visual language of Prelude.

Prelude may use:

- keyboard highlighting
- note names
- colors
- playback
- hints
- animations

These features should support notation rather than replace it.

The goal is for skills learned in Prelude to transfer directly to real-world sheet music.

---

# MIDI as a Learning Interface

MIDI allows Prelude to understand what the student plays.

A physical keyboard becomes more than an instrument. It becomes an interactive learning controller.

MIDI enables Prelude to provide:

- immediate practice validation
- simultaneous note detection
- chord recognition
- timing feedback
- rhythm analysis
- guided practice
- lesson recording
- composition input

The on-screen piano should remain available for accessibility and casual use, but physical MIDI input is central to the full learning experience.

---

# Progression of Learning

Prelude should grow with the student.

## Stage 1 — Note Recognition

- treble clef
- bass clef
- mixed reading
- accidentals
- note ranges
- response speed

## Stage 2 — Musical Relationships

- intervals
- chord construction
- inversions
- scales
- arpeggios
- key awareness

## Stage 3 — Musical Fluency

- rhythm
- multi-note reading
- both-hand exercises
- phrases
- ostinatos
- cadences

## Stage 4 — Guided Application

- teacher-created exercises
- custom lessons
- short studies
- song excerpts
- full pieces
- focused technical drills

## Stage 5 — Creative Understanding

- chord progressions
- melody writing
- motif development
- harmony experiments
- arrangement
- composition

Each stage should build naturally on the previous one.

---

# Guided Lessons

Prelude should eventually support structured lessons rather than only isolated exercises.

A lesson may teach:

- a scale
- a chord progression
- an arpeggio pattern
- an ostinato
- hand independence
- a cadence
- a short phrase
- a complete song section

A strong lesson should explain what the student is practicing and why it matters.

For example:

```text
Lesson: D Minor Ostinato

Goal:
Keep the left-hand pattern steady while adding a simple melody.

Step 1:
Practice the left hand alone.

Step 2:
Practice the melody alone.

Step 3:
Combine both hands.

Step 4:
Increase the tempo gradually.
```

Prelude should teach the concept behind the music, not only require correct notes.

---

# Lesson Creation

Students and teachers should be able to create targeted practice material without needing professional notation software.

The planned Lesson Builder will use MIDI step recording.

A user may:

1. Select a measure and rhythmic position.
2. Play one or more notes.
3. Assign a duration.
4. Confirm the event.
5. Continue through the lesson.
6. Preview and edit the result.

This workflow should support:

- teacher assignments
- exercises copied from sheet music
- scale and chord drills
- song excerpts
- original musical ideas

Lesson data should also be importable and exportable in structured formats so lessons can be generated, shared, and edited in multiple ways.

---

# Composition as Learning

Prelude should eventually provide lightweight composition tools.

The purpose is not to compete with a digital audio workstation.

Composition features should help students explore questions such as:

- What happens if I change this chord?
- Why does this melody sound resolved?
- How does an ostinato change the mood?
- What notes belong to this key?
- How can I turn this idea into a phrase?

Potential tools include:

- phrase builder
- chord progression explorer
- motif editor
- instrument playback
- MIDI export
- MusicXML export

Creative experimentation should reinforce music theory rather than exist as a separate activity.

---

# Instrument Playback

Prelude may eventually allow MIDI input and lesson playback through sampled instruments.

Possible instruments include:

- piano
- violin
- cello
- strings
- choir
- organ
- brass
- drums

Instrument playback can help students understand:

- timbre
- orchestration
- register
- texture
- arrangement

The same musical phrase can feel completely different when played by piano, cello, or a string ensemble.

These features should support learning and creativity without turning Prelude into a production environment.

---

# Accessibility

Prelude should be usable across a wide range of devices and learning situations.

The platform should remain:

- browser-based
- installable as a PWA
- usable on desktop
- usable on Chromebook
- responsive on tablets and phones
- compatible with physical MIDI keyboards
- usable with an on-screen piano
- functional without mandatory subscriptions

Future accessibility work may include:

- keyboard-only navigation
- screen-reader improvements
- colorblind-friendly feedback
- scalable notation
- configurable visual assistance

---

# Product Principles

Future features should follow these principles.

## Learning Before Novelty

A feature should improve musicianship, not exist only because it is technically impressive.

## Notation Before Imitation

Prelude should teach the visual language musicians use outside the application.

## Understanding Before Speed

Fast answers are useful, but comprehension matters more than reaction time.

## Progression Before Complexity

Advanced features should emerge gradually from simple concepts.

## Reuse Before Duplication

Flashcards, chords, lessons, and songs should share common systems whenever possible.

## Architecture Before Expansion

Prelude should establish a stable, well-documented foundation before introducing major new features.

Thoughtful architecture and clear documentation make future musicianship features easier to build, understand, and maintain.

## Browser First

Prelude should remain easy to access without requiring specialized desktop software.

## Simple Before Powerful

The first version of any feature should solve the core learning problem clearly.

---

# What Prelude Is Not

Prelude is not intended to become:

- a professional DAW
- a full replacement for MuseScore or Dorico
- a falling-note rhythm game
- a passive video-course platform
- a social-media network
- a substitute for a skilled music teacher

Prelude should complement:

- teachers
- method books
- sheet music
- practice routines
- creative exploration

---

# Long-Term Outcome

A student should be able to begin with:

```text
What note is this?
```

and gradually progress toward:

```text
What key is this phrase in?

What chord am I playing?

Why does this progression work?

Can I keep this ostinato steady?

Can I read this piece?

Can I create my own musical idea?
```

That progression—from recognition to understanding to creation—is the long-term vision of Prelude.
