# Prelude: MIDI Mentor — ARCHITECTURE

> This document describes the current architecture of Prelude and the responsibilities of its major systems. It focuses on how the application is organized today rather than every possible future direction.

---

# Overview

Prelude is a browser-based musicianship application for learning piano through standard notation and real-time input.

The current application provides five top-level modes: Flashcards, Sequences, Free Play, Ear Training, and Staff Builder. Together they support:

- Treble, bass, and mixed clefs
- Natural notes and accidentals
- Single notes and triads
- Major, minor, diminished, and augmented triads
- Root position, first inversion, and second inversion
- Physical MIDI keyboards
- Virtual piano input
- Visual and audio feedback
- Session statistics
- Ascending and descending melodic interval sequences
- Major, minor, harmonic minor, melodic minor, and pentatonic scales
- Major, minor, diminished, augmented, and seventh arpeggios
- Curated major- and minor-key chord progressions using root-position triads
- Roman-numeral progression and concrete current-chord metadata
- Theory-aware note spelling for ordered musical material
- Ordered step validation
- Sequence completion statistics
- Live ungraded MIDI and virtual-keyboard notation on a persistent grand staff
- Free Play key signatures and key-aware enharmonic spelling

Prelude is currently a frontend-only application built with React and Vite. Ear Training owns melodic interval identification without reusing notation-first practice state machines. Staff Builder owns a separate score-editing domain while reusing shared MIDI, audio, and music primitives.

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
├── FlashcardSession
│   ├── Flashcard Feature Hooks
│   ├── Practice Logic
│   └── Target Validation
│
├── SequenceSession
│   ├── Sequence Feature Hooks
│   ├── Sequence Logic
│   └── Step Validation
│
├── FreeplaySession
    ├── Live Held-Note State
    ├── Grand-Staff Rendering
    └── Ungraded Keyboard Interaction
│
└── EarTrainingSession
    ├── Stable Aural Target
    ├── Prompt Playback
    ├── Interval-Name Validation
    └── Session Statistics

Shared Systems
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
- midi
- notation
- ui

Feature-specific components live under their corresponding `features/` folders.

## features/

Contains stateful behavior that belongs to a specific feature.

The `features/` directory contains independent practice modes.

The flashcard feature owns:

- flashcard settings
- isolated target lifecycle
- MIDI chord-attempt collection
- correct-answer sequencing
- flashcard timing constants

The sequence feature owns:

- sequence settings
- ordered target lifecycle
- interval, scale, arpeggio, and chord-progression configuration
- progression key/template compatibility and regeneration
- physical and virtual progression-input lifecycles
- sequence attempt state
- delayed step and completion transitions
- sequence timing constants

The Free Play feature owns:

- live MIDI and virtual-keyboard held-note state
- ungraded keyboard interaction
- notation-key and chromatic-spelling settings
- conversion from raw MIDI pitches to explicitly spelled notes
- free-play session composition

The Ear Training feature owns:

- melodic interval target generation within C4–C6
- enabled interval and direction settings
- prompt/replay UI state and response timing
- interval-name validation and one-failure-per-target statistics
- Ear Training-specific Mobile Play presentation

Current hooks include:

- `useFlashcardSettings`
- `useFlashcardTarget`
- `useChordAttempt`
- `useCorrectAnswerSequence`
- `useSequenceSettings`
- `useSequenceTarget`
- `useSequenceAttempt`
- `useSequenceTransition`
- `useEarTrainingSettings`
- `useEarTrainingTarget`
- `useEarTrainingPrompt`
- `useEarTrainingAttempt`

## hooks/

Reusable hooks shared outside a single feature.

This contains browser-level MIDI integration (`useMidi`) and generic cross-feature chord-attempt collection (`useChordAttempt`).

## lib/

Reusable domain logic independent of React.

Current domains include:

### audio/

Interface feedback and piano playback.

### music/

Music models, notation helpers, theory-aware spelling, VexFlow rendering, and generators.

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

## Sequence Session

`SequenceSession` coordinates ordered interval, scale, arpeggio, and chord-progression practice while delegating configuration, attempt state, target lifecycle, and timed transitions to focused hooks.

## Free Play Session

`FreeplaySession` combines shared MIDI input, piano playback, the virtual keyboard, key-aware spelling, and grand-staff notation without target generation, validation, feedback, or statistics. Physical and virtual held notes remain raw MIDI state; notation settings recompute their written spelling without clearing the state or replaying audio.

## Ear Training Session

`EarTrainingSession` composes the feature's settings, target, prompt, attempt, and Mobile Play hooks, then renders the normal or Mobile Play presentation. `useEarTrainingTarget` owns stable target generation and locking. `useEarTrainingPrompt` owns prompt playback state, playback cancellation, and response timing. `useEarTrainingAttempt` owns grading, feedback, statistics, and delayed advancement. Answers remain disabled until successful prompt completion, replays preserve target notes and response timing, and a correct answer advances without autoplaying the next target.

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

## useChordAttempt

Collects nearby MIDI note events into a single attempt.

The generic collector in `src/hooks/use-chord-attempt.ts` uses a 225 millisecond window and is shared by Flashcards and Sequences for physical MIDI chord input. It does not determine correctness; validation remains owned by each feature.

Its only responsibility is deciding which notes belong to one performed attempt.

## useCorrectAnswerSequence

Coordinates the delayed actions that occur after a correct answer, such as timing and target advancement.

## useSequenceSettings

Owns Sequence Mode configuration, including enabled directions, intervals, note categories, progression keys and templates, clef mode, and display preferences. Progression toggles preserve at least one compatible key/template pairing.

## useSequenceTarget

Owns the lifecycle and locking of the active sequence target.

## useSequenceAttempt

Owns the ordered attempt state machine, including the current step, feedback states, retries, and sequence completion.

## useSequenceTransition

Coordinates delayed step advancement, retry behavior, MIDI release, success feedback, and progression to the next sequence.

---

# Practice Logic

Reusable practice rules live in `lib/practice`.

These utilities are intentionally independent of React so they can be reused and tested independently.

Current responsibilities include:

- answer validation
- sequence validation
- flashcard session statistics
- sequence session statistics

---

# Music Architecture

Prelude keeps musical data separate from notation rendering.

`src/lib/music/intervals.ts` owns shared interval labels, semitone distances, and diatonic distances. Sequence and Ear Training consume these facts while keeping their generators and state machines separate.

## Musical-Event Playback

`src/lib/audio/musical-event-player.ts` is a React-independent scheduling boundary over cancellable grand-piano playback. A stable ordered event collection supplies MIDI notes, start offsets, and durations. One event may contain simultaneous notes. The player supports immediate zero-offset events, pending and active cancellation, replacement, completion, stale-callback protection, and non-throwing browser playback failure.

Ear Training translates each two-note target into two events. Staff Builder projects its score into the same boundary for deterministic playback while retaining measures, beats, tempo, notation, editor state, and transport UI inside its feature domain.

```text
PracticeTarget / SequenceTarget / Held Notes
                    │
                    ▼
               Music Model
                    │
                    ▼
                 VexFlow
```

VexFlow renders notation but does not own Prelude's musical model.

Generic flashcard notes may use either enharmonic accidental spelling. Ordered theory exercises use required diatonic letter patterns so intervals, scales, and arpeggios are spelled musically rather than by pitch class alone. Unsupported double accidentals are rejected intentionally until notation support is added.

Free Play uses a dedicated grand-staff renderer that splits already-spelled notes between bass and treble while preserving a blank staff when no notes are held.

## Shared Music-Key Domain

`src/lib/music/keys.ts` defines the reusable music-key boundary shared by Chord Progressions and Free Play, with future reuse available to Ear Training and Lessons. The 12-key MVP contains C, G, D, F, B♭, and E♭ major plus A, E, B, D, G, and C minor. Each definition provides a stable ID, display name, tonic, mode, sharp/flat/neutral orientation, correctly spelled diatonic scale, and validated VexFlow key-signature identifier.

Feature-specific progression templates and Free Play settings do not live in this shared module.

## Free Play Notation Pipeline

`src/features/freeplay/freeplay-notation.ts` converts authoritative raw MIDI numbers using a Free Play-owned notation context and chromatic preference:

```text
Physical MIDI + Virtual Keyboard
              │
              ▼
      Raw Held MIDI Numbers
              │
       Key / No Key Context
       Chromatic Preference
              │
              ▼
     Spelled PracticeNote[]
              │
              ▼
 MusicStaff → VexFlow Grand Staff
```

Diatonic pitch classes always use the selected key's spelling and cannot be overridden by a chromatic preference. Chromatic spellings are derived algorithmically from valid natural, single-sharp, and single-flat candidates. Automatic uses the key's orientation or a balanced neutral convention; explicit preferences select a representable sharp or flat spelling. MIDI outside 0–127 or a spelling that cannot be represented without unsupported accidentals returns `null` rather than being silently misrepresented.

`FreeplaySession` merges physical and virtual held MIDI exactly once, converts that collection to `PracticeNote` values, and supplies the selected key identity separately. Changing the key or preference recomputes the visible notes immediately without clearing held pitches or replaying audio.

`MusicStaff` accepts already-spelled Free Play notes plus an optional validated key identity. The VexFlow renderer resolves the signature, adds it to both staves, and applies key-aware accidental calculation independently to treble and bass voices. This suppresses signature-covered accidentals and adds naturals or chromatic accidentals where required. No Key passes no visible signature while using C internally only as the accidental-calculation context.

## Chord Progression Pipeline

### Shared chord construction

`src/lib/music/chords.ts` provides pure, deterministic construction of root-position major, minor, diminished, and augmented triads. Chord tones follow the required diatonic root-third-fifth letters rather than pitch-class-only enharmonic choices. Construction returns no candidate when correct spelling would require a double accidental, which remains an explicit unsupported boundary.

### Progression domain

`src/lib/music/chord-progressions.ts` owns the curated progression library. Supported major keys are C, G, D, F, B♭, and E♭; supported minor keys are A, E, B, D, G, and C. Each template records its mode and an ordered set of structured scale degrees, triad qualities, and Roman numerals. Realization deterministically derives correctly spelled concrete chords from the selected key and tonic octave. Minor roots use the natural-minor collection, while templates explicitly specify major V and diminished ii° harmony where required.

### Sequence target generation

`src/lib/music/generators/sequences.ts` converts a realized progression into a `SequenceTarget` with one chord per `SequenceStep`. Optional step metadata carries the Roman numeral and concrete chord name. Generation pairs only compatible key and template modes, enumerates every valid key/template/clef/tonic candidate before uniformly selecting one valid realization, and uses progression-specific clef ranges with slightly wider upper bounds than other Sequence exercises.

### Sequence orchestration

Sequence settings own enabled progression keys and templates. Invalid toggle operations are rejected instead of silently changing another setting group. A valid settings change regenerates the active target and resets its attempt lifecycle while preserving session statistics. `SequenceSession` coordinates step grading, feedback, retry, completion, and cleanup without moving progression theory into React.

### Physical and virtual chord input

Physical MIDI progression chords use the shared `useChordAttempt` collector and its 225 millisecond grouping window, supporting block and rolled input. Flashcard and Sequence validation remain separate even though collection is shared.

Virtual progression input deliberately does not use that timer. `SequenceSession` owns a persistent set of selected MIDI pitches: selecting a key adds it, selecting it again removes it, and grading occurs when the unique selected-note count reaches the active step's note count. The completed set is played once as a chord before grading. Selection is cleared across grading, retry, regeneration, settings and exercise changes, reset, completion, Focus Staff entry, MIDI input, and unmount.

### Practice-domain separation

- Flashcards remain isolated graded targets, including their existing virtual and MIDI chord behavior.
- Sequences remain ordered graded events, with Chord Progressions represented as ordered chord steps.
- Free Play remains ungraded and owns only live notation context; chord analysis or chord naming was not added to it.
- Flashcard and Sequence targets retain their existing theory-aware spelling and explicit accidental-rendering paths.

## Shared Mobile Play Lifecycle

`src/hooks/use-mobile-play.ts` owns the cross-feature browser lifecycle. Entering Mobile Play activates layout state synchronously, then requests fullscreen and landscape orientation on a best-effort basis. Missing, rejected, or externally exited fullscreen and unsupported orientation locking do not disable the layout. Cleanup releases only fullscreen and orientation state acquired by Prelude, and stale asynchronous requests are prevented from reacquiring state after exit or unmount.

Each session derives the effective layout state as `isMobilePlayMode && !isFocusMode`. Entering either Mobile Play or Focus Staff deactivates the other, including global Focus Staff activation. This coordination changes presentation only: target generation, statistics, feedback, sequence position, settings, and graded input state remain feature-owned.

Flashcards and Sequences continue to supply only `onNoteToggle` to `PianoKeyboard`. Free Play supplies toggle input plus momentary `onNotePress` and `onNoteRelease` callbacks for multitouch and clears momentary pointer notes on Mobile Play exit without affecting physical MIDI notes.

`MusicStaff` applies transform-based Mobile Play scaling by mode because the grand staff, flashcard staff, and sequence staff have different rendered proportions. These transforms are scoped to active staff instances. Container-measured responsive VexFlow sizing is deferred to the later UI/UX overhaul.

---

# Staff Builder

Staff Builder is a feature-owned, learning-focused score editor. It creates local practice material without turning Prelude into a professional notation editor or merging score authoring with the future Guided Lesson engine.

## Ownership Boundaries

The Staff Builder feature separates durable responsibilities:

- the score domain owns measures, events, staves, rhythm, pitches, rests, ties, tempo, and measure context;
- editor orchestration coordinates Capture Notes, Rhythm Correction, validation, history, and persistence;
- Capture Notes owns beginner transcription state, pending pitches, routing, cursor movement, and lock/rest operations;
- Rhythm Correction owns authoritative event selection and explicit correction operations;
- validation identifies structural issues while correction functions apply immutable score changes;
- persistence owns the local project library, schema validation, recovery, draft state, and validated saves;
- playback projects score data into shared musical events;
- notation rendering returns decorative output and public interaction geometry.

These boundaries live inside `src/features/staff-builder`; they do not turn Flashcards, Sequences, Free Play, Ear Training, or future Guided Lessons into one state machine.

## Application-Owned Score Model

Staff Builder score data is independent of VexFlow. Measures contain authoritative note/chord/rest events with staff, onset, and rhythm. Notes retain explicitly spelled pitches, ties are explicit score relationships, and effective key/time context is resolved from initial settings and measure overrides. Tempo and variable measure capacities remain score-domain facts.

The persistence schema validates stored data at the browser-storage boundary. Renderer geometry and transient UI state are never persisted as musical score data.

## Capture Notes and Rhythm Correction

Capture Notes and Rhythm Correction are separate workflows over one score.

Capture Notes is optimized for first-week transcription: MIDI or virtual-keyboard pitches are previewed, routed to grand/treble/bass input, and committed at a rhythmic cursor. Newly captured notes retain the beginner default of final quarter-note duration. Step Duration controls cursor advancement and the exact duration of an intentionally inserted rest.

Rhythm Correction selects authoritative events and supports duration changes, note/rest conversion, staff reassignment, spelling, ties, and deletion. It retains detailed explicit controls as a fallback even when the same operation is available directly from the score.

History is score history, not a universal command log. Rhythm and context mutations record reversible score snapshots. Capture score mutations intentionally clear stale Rhythm history when replaying it would conflict with the newly captured score.

## Rendering and Direct Score Interaction

VexFlow renders decorative notation. Its SVG remains hidden from assistive technology and is not queried for editor behavior. The Staff Builder renderer instead returns public render-only geometry for rendered and authoritative events, rhythmic timeline positions, and notation controls covering the clefs, grand-staff region, key signature, and time signature. Playback-follow geometry is derived from the public rhythmic-position geometry rather than a separate renderer-owned playback-anchor family.

React owns semantic controls, focus, hover, highlights, hit testing, and pointer orchestration. Cross-domain pointer ownership is deterministic:

1. original notation-control geometry;
2. actual authoritative event geometry;
3. expanded notation touch geometry;
4. expanded event touch geometry;
5. Capture position.

Meaningful pointer movement or cancellation suppresses activation so notation controls and score events do not convert a swipe into an edit.

## Radial Controls

Duration, Key, and Time wheels are specialized Staff Builder components sharing narrow local helpers for ring placement, anchor conversion, and viewport clamping. Duration retains event-type conversion behavior while Key and Time remain mutually exclusive context selectors.

A pointer gesture that opens any radial wheel cannot activate a newly mounted choice. The wheel arms only after a subsequent pointer gesture; keyboard users can operate it immediately, and Escape returns focus to the opening score control.

## Staff Builder Playback and Follow Visualization

Staff Builder projects score events into the shared React-independent musical-event player. The projection accounts for rests, trailing silence, ties, partial chords, playback scopes, tempo, and variable measure capacities. Staff Builder does not introduce a second audio scheduler.

The playback scheduler exposes its authoritative time origin. Staff Builder samples that clock to display the current measure and a sliding score highlight. Visualization does not schedule audio, and playback-follow measure display is ephemeral: it does not move the Capture cursor or Rhythm selection.

## Persistence, Validation, and Save

Staff Builder remains frontend-only. Draft autosave continuously preserves work and editor position in local browser storage. Validated Save has a distinct product meaning: the score has passed structural validation and is ready for later playback or use. Guided correction mode provides learner-facing fixes such as exact overflow durations and atomic gap filling without conflating validation with input collection.

## Responsive Presentation

Responsive score scaling, compact controls, and the mobile virtual-keyboard bottom sheet are presentations over the same authoritative editor state. Exactly one virtual-keyboard presentation is active at a time. Safe-area and viewport handling belong to the presentation layer; they do not create a mobile-specific score or Capture state machine.

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

Physical MIDI and the virtual piano reach the same feature-owned validation rules in graded modes, but their multi-note collection policies can differ. Free Play reuses the same input systems but intentionally bypasses validation.

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

Coordinates the overall flashcard practice session.

## SequenceSession

Coordinates ordered interval, scale, arpeggio, and chord-progression practice.

## FreeplaySession

Coordinates live ungraded notation and keyboard interaction.

## useFlashcardSettings

Owns configuration state.

## useFlashcardTarget

Owns target lifecycle.

## useChordAttempt

Owns generic timed physical-MIDI chord collection; each graded feature owns validation.

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
- Let session components coordinate rather than implement reusable domain behavior.
- Keep documentation synchronized with architectural changes.
