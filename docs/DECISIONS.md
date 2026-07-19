# Prelude: MIDI Mentor — DECISIONS

> This document records important product and architectural decisions made during the development of Prelude.

Each entry explains:

- what was decided
- why the decision was made
- what consequences it has for future development

This is not a changelog. Routine implementation details and minor UI changes do not need to be recorded here.

---

# Decision Format

Future decisions should use this structure:

```text
## YYYY-MM — Decision Title

### Decision

What was decided.

### Reason

Why this direction was chosen.

### Consequences

How the decision affects future development.
```

---

# 2026-07 — Standard Notation Is the Primary Interface

## Decision

Prelude will teach music using standard sheet music notation.

Falling-note visualizations similar to Synthesia or rhythm-game interfaces will not be the primary learning method.

## Reason

The goal of Prelude is to build transferable sight-reading ability.

Standard notation allows users to apply what they learn to:

- printed sheet music
- piano method books
- teacher assignments
- ensemble music
- composition
- other instruments

A falling-note interface may help users reproduce finger movements, but it does not teach conventional music reading as directly.

## Consequences

- VexFlow remains central to the application.
- New practice modes should use standard notation whenever appropriate.
- Visual assistance may supplement notation but should not replace it.
- Full-song practice should resemble interactive sheet music rather than a rhythm game.

---

# 2026-07 — Prelude Is a Learning Platform, Not a DAW

## Decision

Prelude will remain focused on musicianship education rather than becoming a general-purpose digital audio workstation.

## Reason

Professional DAWs and notation editors already solve broad recording, mixing, sequencing, and publishing problems.

Prelude’s strength is its focused learning experience.

Every major feature should help users improve skills such as:

- sight reading
- rhythm
- intervals
- chords
- scales
- harmony
- ear training
- composition

## Consequences

- Features should be evaluated by their educational value.
- Composition tools should remain lightweight and learning-oriented.
- Advanced audio production features are outside the project’s core scope.
- The interface should remain approachable for students.

---

# 2026-07 — MIDI and On-Screen Input Share One Practice Path

## Decision

Physical MIDI keyboards and the on-screen piano should produce the same normalized note input before reaching the practice engine.

## Reason

Practice logic should not depend on the user’s input device.

A target note should be validated the same way whether it was played through:

- a physical MIDI keyboard
- the on-screen piano
- another future input source

## Consequences

- Input handling remains separate from answer validation.
- New practice modes can support multiple input methods without duplicating logic.
- MIDI-specific details should not leak into notation or session components.

---

# 2026-07 — Enharmonic Spellings Are Distinct Written Notes

## Decision

Prelude will distinguish between enharmonic spellings such as D-sharp and E-flat even when they correspond to the same MIDI pitch.

## Reason

MIDI identifies sounding pitch, but sheet music also communicates musical spelling and context.

For example:

- D-sharp and E-flat sound the same on a tempered piano.
- They do not always serve the same theoretical or notational purpose.
- Real sheet music uses both sharp and flat spellings.

Prelude should teach users to recognize the notation they will encounter outside the application.

## Consequences

- A note cannot be represented only by MIDI number.
- Music models must preserve written spelling.
- Answer checking may compare sounding pitch while notation preserves the intended note name.
- Practice settings may eventually support sharp-only, flat-only, or mixed accidental modes.

---

# 2026-07 — Multiple Simultaneous Notes Are a First-Class Concept

## Decision

Prelude will evolve from single-note input toward tracking sets of currently pressed notes.

## Reason

Many planned features require simultaneous input, including:

- intervals
- chords
- chord inversions
- two-hand exercises
- polyphonic lessons
- full pieces

Adding chords as an isolated special case would create unnecessary duplication.

## Consequences

- Input state will eventually support multiple held MIDI notes.
- The `PracticeTarget` model represents one or more expected notes.
- Chord comparison is based on note sets rather than the order in which notes are pressed.
- Timing rules may be needed to determine when a group of notes counts as one answer.
- Single-note and multi-note exercises share the same rendering and validation pipeline.

---

# 2026-07 — Flashcards Will Become the Simplest Form of Lesson

## Decision

Prelude’s long-term architecture will treat flashcards as a minimal lesson rather than maintaining separate systems for every practice mode.

## Reason

Flashcards, chords, scales, exercises, and songs all share similar concepts:

- expected musical events
- rendered notation
- user input
- validation
- feedback
- progression through material

A generalized lesson model allows these features to reuse the same engine.

## Consequences

The long-term hierarchy will move toward:

```text
Lesson
    ↓
Measures
    ↓
Events
    ↓
Notes
```

An event may eventually represent:

- one note
- an interval
- a chord
- a rest
- a sustained note
- an articulation

The current flashcard implementation should remain simple, but new systems should avoid architectural dead ends that prevent this transition.

---

# 2026-07 — Lesson Data Is Independent of Rendering

## Decision

Lessons will be stored as structured musical data rather than as VexFlow-specific objects or rendered notation.

## Reason

VexFlow is responsible for displaying notation, but it should not define the permanent lesson format.

A rendering-independent model can be used by:

- the practice engine
- VexFlow
- the Lesson Builder
- playback systems
- JSON import and export
- future MusicXML conversion
- AI-generated exercises

## Consequences

- Lesson data should use application-owned TypeScript types.
- VexFlow-specific conversion belongs in the notation layer.
- Rendering libraries may be replaced or upgraded without rewriting saved lessons.
- Imported formats should be converted into Prelude’s internal model.

---

# 2026-07 — Lesson Playback and Lesson Creation Are Separate Systems

## Decision

The Guided Lesson engine and the Lesson Builder will be developed as separate features.

## Reason

Playing a lesson and creating a lesson have different responsibilities.

The lesson engine needs to:

- render musical events
- track the current position
- validate input
- provide feedback
- control tempo and looping

The Lesson Builder needs to:

- create and edit events
- navigate measures
- change durations
- preview playback
- save and export data

Building the lesson consumer first creates a stable format for the editor to produce.

## Consequences

- The Lesson Engine should be implemented before the full Lesson Builder.
- Both systems will share the same lesson data model.
- Editing state should remain separate from practice-session state.
- The builder should not contain its own incompatible playback logic.

---

# 2026-07 — Lesson Builder Uses MIDI Step Recording

## Decision

The primary lesson-entry workflow will use MIDI step recording rather than attempting to recreate a full graphical notation editor.

## Reason

Students and teachers should be able to enter music quickly by playing it.

A step-recording workflow can allow the user to:

1. Select a rhythmic position.
2. Play one or more notes.
3. Assign a duration.
4. Confirm the event.
5. Advance to the next position.

This is substantially simpler than building a MuseScore-style editor while still supporting targeted exercises, sheet-music transcription, and composition.

## Consequences

- Lesson entry will support chords and single notes through MIDI.
- A configurable rhythmic grid will be needed.
- Visible editing controls must work with mouse, touch, and Chromebook input.
- Right-click should not be the only way to delete or edit data.
- Explicit duration controls are preferred over hidden repeated-click behavior.

---

# 2026-07 — Rhythmic Input Uses a Configurable Grid

## Decision

Lesson entry will not assume that every event begins on a quarter-note beat.

Instead, measures will use a configurable rhythmic subdivision.

## Reason

Music commonly contains:

- eighth notes
- sixteenth notes
- off-beat entrances
- rests
- notes sustained across multiple positions

A beat-only editor would be too restrictive for even many beginner pieces.

## Consequences

Possible grids may include:

```text
Quarter-note grid:
1    2    3    4

Eighth-note grid:
1  & 2  & 3  & 4  &

Sixteenth-note grid:
1 e & a 2 e & a ...
```

The first implementation may support only a small number of common subdivisions.

---

# 2026-07 — Explicit Duration Controls Are Preferred

## Decision

The Lesson Builder should use visible note-duration controls rather than relying primarily on repeated clicks to lengthen notes.

## Reason

A repeated-click system may be fast after learning it, but it is less discoverable and easier to use incorrectly.

Explicit controls such as the following are clearer:

```text
Eighth
Quarter
Half
Dotted Half
Whole
```

## Consequences

- Duration controls should be visible and touch-friendly.
- Keyboard shortcuts may later be added for speed.
- The interface should make the selected duration obvious.
- Duration values should be stored independently of visual notation symbols.

---

# 2026-07 — Interface Feedback Uses the Web Audio API

## Decision

Prelude generates interface feedback sounds using the browser's Web Audio API rather than bundled audio files.

## Reason

The application requires lightweight success and failure feedback without introducing external assets or dependencies.

Generating sounds programmatically keeps feedback responsive while remaining independent of future instrument playback.

## Consequences

- No audio files need to be bundled with the application.
- Feedback sounds remain lightweight and responsive.
- Interface feedback stays separate from future playback systems and SoundFonts.
- A single shared volume preference controls all interface feedback.

---

# 2026-07 — Browser-First and Frontend-Only Until Needed

## Decision

Prelude will remain browser-first and frontend-only while its core features can be supported without a backend.

## Reason

The current application does not require:

- authentication
- cloud storage
- social features
- server-side processing
- a database

Keeping the system frontend-only reduces complexity and makes deployment inexpensive.

## Consequences

- User preferences and progress may initially use local storage or IndexedDB.
- Lessons may initially be imported and exported as files.
- A backend should only be introduced when a feature clearly requires it.
- Cloud accounts and synchronization remain optional future features.

---

# 2026-07 — Progressive Web App Support Is Part of the Product

## Decision

Prelude will continue to support installation and offline application-shell access through Progressive Web App technology.

## Reason

A piano practice tool benefits from being easy to open on:

- desktop computers
- Chromebooks
- tablets
- phones

An installable browser application provides much of the convenience of a native app without requiring separate platform codebases.

## Consequences

- PWA behavior should be tested when major assets or routing behavior changes.
- Core application resources should remain cacheable.
- MIDI features should degrade gracefully on unsupported browsers.
- Responsive and touch-friendly design remain architectural concerns.

---

# 2026-07 — Playback Engine and Instrument Libraries Remain Separate

## Decision

Future instrument playback will keep the playback engine separate from the instrument sample library.

## Reason

MIDI contains performance instructions but no audio.

A playback engine interprets MIDI events, while a SoundFont or sample library provides the instrument sounds.

Separating the two allows Prelude to use:

- free SoundFonts
- higher-quality paid libraries
- different browser playback engines
- different instruments

without changing lesson or practice logic.

## Consequences

The future audio flow may resemble:

```text
MIDI Input
    ↓
Prelude
    ↓
Playback Engine
    ↓
SoundFont or Instrument Library
    ↓
Speakers
```

SpessaSynth and GeneralUser GS are current candidates for future evaluation, but no playback dependency has been selected yet.

---

# 2026-07 — Development Proceeds in Small, Coherent Milestones

## Decision

Prelude will be developed through small, focused features and commits rather than large multi-system rewrites.

## Reason

The project is both a useful application and a structured software-learning project.

Incremental development makes it easier to:

- understand each architectural change
- test behavior thoroughly
- maintain working deployments
- identify regressions
- keep documentation current

## Consequences

- Each milestone should have a clear purpose.
- Unrelated changes should not be grouped together.
- Architecture should evolve only when a current feature justifies it.
- Documentation should be updated at meaningful checkpoints.

---

# Adding Future Decisions

Add a new entry when a choice:

- affects multiple future features
- changes the project’s architecture
- establishes a lasting product principle
- chooses between meaningful technical alternatives
- would be difficult for a future developer to understand without context

Do not add entries for:

- minor styling adjustments
- routine dependency updates
- temporary bug fixes
- file renames with no architectural impact
- ordinary implementation details
