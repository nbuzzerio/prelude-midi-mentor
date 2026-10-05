# Prelude: MIDI Mentor — VISION

> Prelude is a browser-based musicianship platform designed to help students learn how music works, not merely which keys to press.

---

# Purpose

Prelude exists to make music learning more interactive, accessible, and understandable.

The project began as a MIDI-powered sight-reading trainer, but has grown into a broader browser-based musicianship platform:

- teach standard notation
- connect written music to the keyboard
- reinforce music theory through practice
- support Guided Studies that explain and apply musical concepts
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

The teaching cycle is explanation → demonstration → experiment → repetition → comparison → reflection. Students should learn:

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

## Bounded Acoustic Participation

Microphone pitch observations can extend learning to monophonic acoustic instruments and sung voice. They describe pitch and stability, not physical fingering, MIDI attacks/releases or speech. Instrument guidance should connect both detected and target pitches to ways of producing them, while showing uncertainty honestly. Claims and practice assessment depend on evidence for the instrument, device and activity; a tuning aid does not automatically establish reliable rhythmic grading.

Instrument playback and instrument input serve different purposes: one produces sound, the other observes it. Neither implies the other is supported.

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

These stages describe learning relationships, not a rigid delivery order. The authoritative [rolling roadmap](./ROADMAP.md) allows practice, creativity, Studies, acoustic support and product quality to develop at different rates.

---

# Guided Studies

Guided Studies are a permanent product pillar. They own the teaching journey and compose Prelude's native modes as interactive tools. Those modes retain rendering, timing, input, grading, persistence, notation, playback and evidence responsibilities.

A Study may teach:

- a scale
- a chord progression
- an arpeggio pattern
- an ostinato
- hand independence
- a cadence
- a short phrase
- a complete song section

A Practice Session organizes what to practice. A Guided Study explains why, offers demonstrations and experiments, supports repetition and comparison, and invites reflection. Completing an activity is not proof of understanding; Studies should not introduce a universal mastery score. Staff Builder's Study View is score presentation, not this teaching system.

The likely first vertical slice is a D Minor Study. Its concept bank spans natural, harmonic and melodic minor, F major, notation, scales, intervals, arpeggios, harmony, listening, singing/playing, improvisation and eventual excerpt application. The first objective and audience remain owner decisions when the thread becomes active; this bank is not initial implementation scope.

Use mature native activities through explicit launch, completion and return boundaries. Prepare only the musical material and capability gaps needed for the chosen slice. Full curriculum authoring, continuous reading and acoustic input are not universal prerequisites. Musical character should be explored through listening and context rather than reduced to fixed emotional labels.

---

# Practice Material and Study Authoring

Students and teachers should be able to create targeted practice material without needing professional notation software.

Staff Builder now provides the first practical transcription and practice-material creation workflow through MIDI and virtual-keyboard capture, direct score editing, validation, playback, and local projects. Structurally valid saved pieces can also be practiced measure by measure through Blocking Piece Practice, which grades pitch attacks without copying the authored score or claiming continuous timing accuracy.

A user may:

1. Select a measure and rhythmic position.
2. Play one or more notes.
3. Assign a duration.
4. Confirm the event.
5. Continue through the score.
6. Preview and edit the result.

This workflow should support:

- teacher assignments
- exercises copied from sheet music
- scale and chord drills
- song excerpts
- original musical ideas

Future Study authoring may connect teaching content and native activity prescriptions to this score foundation. Teacher assignments, sharing and broader interchange remain later possibilities. A Staff Builder project or blocking Piece Practice run is not itself a Guided Study; continuous authored-piece performance remains a separate future capability.

---

# Improv / Creative Exploration

Improv helps players invent, explore, compare and develop musical ideas. It adds intentional creative guidance beyond Free Play's observation, complements Piece Practice's work on existing music, and supplies experimentation for Studies. A bounded first experience can use key/scale context and constrained exploration; chord/progression context, motifs and idea capture can develop later, including eventual material for MACEDON.

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

Creative experimentation should reinforce music theory. Composition possibilities extend the Improv direction rather than defining a competing Composer product.

---

# Instrument Playback

Prelude already has sampled piano playback. Broader sampled-instrument choices may eventually support demonstrations, practice material and creative exploration.

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

Features should reuse musical facts, rendering and playback where their semantics fit while retaining their native practice state machines. Studies orchestrate those capabilities rather than replacing them.

## Architecture Follows Demonstrated Need

Prelude should evolve architecture when a real feature needs it and keep implemented boundaries documented. Conceptual future inputs or teaching systems do not justify universal frameworks in advance.

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
