# Prelude: MIDI Mentor — ARCHITECTURE

> This document describes the current architecture of Prelude and the responsibilities of its major systems. It focuses on how the application is organized today rather than every possible future direction.

## Melody

Melody owns a transient seeded authored exercise and projects it through a pure adapter into a read-only Staff Builder display score. Expected attacks feed a feature-local Web Audio clock, continuous MIDI/VKB recorder, timing-led dynamic-programming alignment, and independent Pitch, Movement, and Timing scoring. Web Audio time is authoritative; React/RAF samples it only for presentation.

The display projection prepends a two-quarter-beat preparatory measure used by notation, count guide, and clock scheduling. That lead-in is presentation/timing support: it is not part of the authored exercise and contributes no scored or diagnostic evidence. Results reuse the exact display score. A pure adapter maps expected event IDs to generic `correct`, `missed`, or `wrong-pitch` highlights; these encode Pitch only.

Timed practice stores each completed original attempt as immutable diagnostic evidence under stable trial identity. Session Review derives summaries and review order without rewriting those originals. Repair attempts append to a separate retry history, allowing the UI to compare the original Sight Read with the latest Repair while retaining every retry. Interval analytics aggregate transitions from original results into the Sight Read dataset and retry results into the Repair dataset; neither dataset is persisted beyond the in-memory session.

App-level MidiProvider ownership remains separate from Melody attempt/source locking. Shared piano WAVs are PWA-precached; metronome clicks are oscillator-generated. No Melody exercise, attempt, result, or analytics is persisted.

Melody calls `useMobilePlay` once inside the mounted `MelodySession`. Entering or exiting the focused presentation may occur during setup, audio startup, count-in, performance, results, or Session Review without replacing the generated exercise, AudioContext, performance clock, recorder, first-input-source lock, MIDI consumer, PianoKeyboard, score/count guide, result, or diagnostic history. The existing visibility-interruption policy still cancels an active starting, count-in, or performing attempt when the document becomes hidden; completed timed trials remain available for review. Duration and hold grading are not part of Melody.

---

# Overview

Prelude is a browser-based musicianship application for learning piano through standard notation and real-time input.

The current application provides six top-level modes: Flashcards, Sequences, Free Play, Ear Training, Melody, and Staff Builder. Together they support:

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

This contains the low-level browser MIDI lifecycle (`useMidi`), the app-level MIDI consumer adapter (`useAppMidiInput`), and generic cross-feature chord-attempt collection (`useChordAttempt`).

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

### Authoritative timing and temporal measures

`SequenceTarget` carries required meter and ticks-per-quarter metadata, and every `SequenceStep` carries `durationTicks`. Current generators emit 4/4 targets at 480 ticks per quarter with 480 ticks per generated step. This is an explicit Prelude practice and presentation convention, not an intrinsic rhythmic property of intervals, scales, arpeggios, or chord progressions. A chord step containing simultaneous pitches is one graded attack with one onset and one duration.

Step onsets are derived cumulatively rather than stored. Measure membership follows onset time: an attack beginning exactly on a barline belongs to the following measure, while a step ending exactly at a barline is valid. Final partial measures are supported. Steps crossing a barline are deliberately rejected; the current Sequence domain does not add rests, arbitrary onset offsets, or ties to work around that limitation.

The authoritative `SequenceTarget` and global `currentStepIndex` continue to own grading and progression. Pure timing helpers derive the temporal timeline, and a presentation helper derives the current measure window from the global step. There is no independent current-measure progression state.

### Timed notation presentation

Sequence notation consumes the target's explicit meter and durations rather than treating the number of steps as a beat count. By default, the task displays only the current temporal measure alongside `Measure n of m` and the existing global `Step n of m`. Global-to-local active-step translation occurs only at the notation boundary.

`Show whole sequence` defaults off and is presentation-only. Toggling it neither regenerates the target nor resets the global step, input, transitions, or statistics. Whole view renders the complete authoritative target, highlights the same global current step, separates temporal measures, and may scroll horizontally instead of compressing long material until it is unreadable. Current generators still use the quarter-duration convention; mixed durations are supported by the timing and renderer contracts but are not currently generated exercises.

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

`src/hooks/use-mobile-play.ts` owns the shared browser-enhancement lifecycle used by Flashcards, Sequences, Free Play, Ear Training, Melody, and Piece Practice. Mobile Play itself is app presentation state. Entering it activates the focused layout synchronously, then requests fullscreen and landscape orientation on a best-effort basis. Missing, rejected, unavailable, or externally exited fullscreen and unsupported or rejected orientation locking do not disable the layout. External Escape exits browser fullscreen only; explicit `Exit Mobile Play` controls Prelude's presentation state. Cleanup releases only fullscreen and orientation state acquired by Prelude, and stale asynchronous requests are prevented from reacquiring state after exit or unmount.

Practice and session state remain feature-owned; there is no generic Mobile Play or cross-mode practice state machine. Modes with Focus Staff derive their effective layout state from Mobile Play and focus state, preserving their established mutual exclusion. Each feature keeps one mounted practice lifecycle and one relevant input owner and keyboard while presentation changes.

Flashcards and Sequences continue to supply only `onNoteToggle` to `PianoKeyboard`. Free Play supplies toggle input plus momentary `onNotePress` and `onNoteRelease` callbacks for multitouch and clears momentary pointer notes on Mobile Play exit without affecting physical MIDI notes.

`MusicStaff` applies transform-based Mobile Play scaling by mode because the grand staff, flashcard staff, and sequence staff have different rendered proportions. These transforms are scoped to active staff instances. Container-measured responsive VexFlow sizing is deferred to the later UI/UX overhaul.

---

# Staff Builder

Staff Builder is a feature-owned, learning-focused score editor. It creates local practice material without turning Prelude into a professional notation editor or merging score authoring with the future Guided Lesson engine.

## Ownership Boundaries

The Staff Builder feature separates durable responsibilities:

- the score domain owns measures, events, staves, rhythm, pitches, rests, ties, annotations, tempo, and measure context;
- editor orchestration coordinates Capture Notes, Rhythm Correction, validation, history, and persistence;
- Capture Notes owns beginner transcription state, pending pitches, routing, cursor movement, and lock/rest operations;
- Rhythm Correction owns authoritative event selection and explicit correction operations;
- validation identifies structural issues while correction functions apply immutable score changes;
- persistence owns the local project library, schema validation, recovery, draft state, and validated saves;
- playback projects score data into shared musical events;
- notation rendering returns decorative output and public interaction geometry.

These boundaries live inside `src/features/staff-builder`; they do not turn Flashcards, Sequences, Free Play, Ear Training, or future Guided Lessons into one state machine.

## Application-Owned Score Model

Staff Builder score data is independent of VexFlow. The canonical model is `StaffBuilderScoreV3`; `StaffBuilderScore` aliases that current form. Measures contain authoritative note/chord/rest events with staff, onset, and rhythm. Notes retain explicitly spelled pitches, ties are explicit score relationships, and effective key/time context is resolved from initial settings and measure overrides. A note event may carry `arpeggiation?: "up"` only when it contains at least two pitches. Tempo and variable measure capacities remain score-domain facts.

The persistence schema validates stored data at the browser-storage boundary. Legacy schema v1 scores receive an empty annotation collection; schema v2 score events are normalized into v3; current v3 data validates annotations and optional upward arpeggiation. Libraries and drafts likewise parse supported v1/v2 forms and return canonical v3 data. The local-storage keys retain historical `-v1` names for compatibility. Those key names are not schema declarations and must not be casually renamed when the score schema changes.

The same schema boundary validates imported `.prelude.json` files, which contain one authoritative score rather than a library envelope, draft, history, or practice state. On an imported top-level score-ID collision, the library creates a new score ID and timestamp without rewriting score-local measure, event, pitch, tie, or annotation identities. Full-piece duplication creates fresh score-local identities throughout the copy; treble- and bass-range copies also filter material to the requested range and remove invalid cross-copy relationships. No duplication operation mutates the source. Renderer geometry and transient UI state are never persisted as musical score data.

Same-staff rhythmic voices are deterministic derived state, not persisted score identity. Validation partitions authoritative half-open event intervals into the minimum non-overlapping voice count while checking completeness through staff-wide union coverage. The notation projection renders those voices with invisible, noninteractive gap tickables; playback, ties, editing, persistence, and practice continue to address authoritative event and pitch IDs rather than voice numbers.

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

Annotations remain canonical score data, separate from VexFlow geometry. Study View derives multi-system layout and annotation placement from the score and public renderer geometry, while React owns the semantic annotation presentation. Study View is read-only presentation over the same score; it does not create another persisted document.

## Radial Controls

Duration, Key, and Time wheels are specialized Staff Builder components sharing narrow local helpers for ring placement, anchor conversion, and viewport clamping. Duration retains event-type conversion behavior while Key and Time remain mutually exclusive context selectors.

A pointer gesture that opens any radial wheel cannot activate a newly mounted choice. The wheel arms only after a subsequent pointer gesture; keyboard users can operate it immediately, and Escape returns focus to the opening score control.

## Staff Builder Playback and Follow Visualization

Staff Builder projects score events into the shared React-independent musical-event player. The projection accounts for rests, trailing silence, ties, partial chords, playback scopes, tempo, and variable measure capacities. Staff Builder does not introduce a second audio scheduler.

The playback scheduler exposes its authoritative time origin. Staff Builder samples that clock to display the current measure and a sliding score highlight. Visualization does not schedule audio, and playback-follow measure display is ephemeral: it does not move the Capture cursor or Rhythm selection.

## Persistence, Validation, and Save

Staff Builder remains frontend-only. Draft autosave continuously preserves work and editor position in local browser storage. Validated Save has a distinct product meaning: the score has passed structural validation and is ready for later playback or use. Guided correction mode provides learner-facing fixes such as exact overflow durations and atomic gap filling without conflating validation with input collection.

Saved library pieces can be downloaded individually as human-readable `.prelude.json` score files and imported later. Import requires schema validity but intentionally permits structurally incomplete musical content so it can be repaired through the normal editor; existing structural validation continues to control Piece Practice eligibility.

## Responsive Presentation

Responsive score scaling, compact controls, and the mobile virtual-keyboard bottom sheet are presentations over the same authoritative editor state. Exactly one virtual-keyboard presentation is active at a time. Safe-area and viewport handling belong to the presentation layer; they do not create a mobile-specific score or Capture state machine.

## Blocking Piece Practice

Blocking Piece Practice is a Sequence-adjacent feature with its own domain under `src/features/piece-practice`; it does not use `SequenceTarget` or Sequence session state. Its launch path is:

```text
saved StaffBuilderScoreV3
  -> Staff Builder structural validation
  -> transient Piece Practice projection
  -> blocking session state
  -> stable MIDI/VKB input owner
  -> read-only StaffBuilderScoreView
```

Staff Builder remains the sole persisted score authority. A launch projects a stable in-memory snapshot containing source measure/event/pitch identity, staff, onset, duration, written spelling, rests, and ties. Nothing in the Piece Practice projection or session is written back to the Staff Builder library or converted into Sequence storage. Exiting unmounts the session and returns to the existing Staff Builder library; a later launch reads the latest saved score.

Targets describe score positions grouped by measure and onset across both staves. Sustained pitches are not repeated at later attacks, incoming tied pitches are retained as source metadata but excluded from required attacks, and simultaneous duplicate sounding pitches require one physical MIDI pitch while retaining all source identities. Rests remain visible source events but create no answer target.

Each score-position target owns a set of checks. All non-arpeggiated attacked pitches at that onset form at most one aggregated normal check. Every authored upward arpeggiated chord forms its own independent rolled check, even when normal notes or another roll share the onset. The target advances only after all checks complete; an incorrect attempt leaves the unresolved checks available for retry. Completed measures advance in domain state, while measures without attacks require explicit acknowledgement because Piece Practice has no continuous timing engine. Start-at-measure and restart operations remain transient session behavior.

One mounted input hook owns Web MIDI and the shared 225 millisecond chord collector for ordinary physical block chords. Authored rolled checks instead accept ordered attacks within a tempo-relative window equal to 1.5 quarter-note beats. Physical attacks and persistent virtual-keyboard selections never merge. Held pitches are supplied separately from attacks so only an immediately previous successful target or an incoming tie can receive the narrow approved held-note allowance. Responsive and explicit Mobile Play presentations reuse this one owner and never duplicate session state or keyboard instances.

Narrow or coarse-pointer detection remains Staff Builder editor presentation state; it no longer automatically places Piece Practice into a fixed Mobile Play layout. After `Start Practice`, the active Piece Practice session calls `useMobilePlay` once and exposes an explicit entry action. Ordinary narrow Piece Practice remains in normal document flow.

Entering or exiting Mobile Play preserves the current piece, measure, target, blocking attempt and mistake state, original session timing, pending physical chord collector, persistent virtual chord selection, MIDI owner, and PianoKeyboard. `Exit Mobile Play` leaves only the focused presentation; `Exit Piece Practice` retains its separate behavior of returning to Staff Builder. Restart Measure and Restart Piece retain their domain semantics, targetless measures still require explicit `Next Measure`, and completion may remain in Mobile Play until explicit exit. Staff Builder editor responsive ownership is unchanged.

The presentation reuses `StaffBuilderScoreView` in read-only mode and highlights authoritative source event IDs. It mounts no Capture, Rhythm Correction, history, persistence, or notation-edit controls. The pure Piece Practice domain owns check progress, mistakes, and advancement truth; React schedules expiry checks and presents the timer/result state without redefining completion. Piece Practice intentionally has no BPM grading, hold-duration grading, metronome, continuous performance capture, or post-performance accuracy overlay.

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

Owns browser MIDI access, physical input listeners, hotplug/disconnect state, and the physical held-note set. Exactly one `useMidi` instance is mounted by the app-level `MidiProvider`; feature sessions do not own Web MIDI access.

## MidiProvider and useAppMidiInput

`MidiProvider` remains mounted above top-level mode switching. It shares connection status, device identity, errors, and `connectMidi()` without requesting permission on page load. A token-safe active-consumer registration routes new note attacks and held-note snapshots only to the currently mounted MIDI-enabled feature. Switching through a feature with no MIDI consumer, such as Ear Training, leaves the physical connection and held state alive without grading attacks.

Feature adapters retain all musical behavior. Flashcards, Sequences, and Piece Practice keep their own chord collectors and grading; Staff Builder keeps Capture semantics; Free Play consumes held-note snapshots. An already-held key is published as held environmental state after a mode switch but is never replayed as a new attack.

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


## Feature configuration boundaries

Flashcards, Sequences, Ear Training, and Melody own their JSON-safe prescription types in `flashcard-config.ts`, `sequence-config.ts`, `ear-training-config.ts`, and `melody-config.ts`. Configs contain only settings, with enum arrays rather than Sets. SequenceConfig is version 2; the other feature configs remain version 1. Feature parsers return `corrupt` or `unsupported` results; they reject unknown/missing fields, invalid selections, and duplicate selections rather than silently repairing a prescription. `src/lib/config-validation.ts` contains only structural parsing primitives, not music rules or a mode registry.

The Flashcard, Sequence, and Ear Training settings hooks accept a mount-time initial config and otherwise use centralized existing defaults. Feature conversion functions create detached runtime Sets and serialize explicit settings fields back to plain arrays. Callback-bearing hook results may be supplied to these serializers; callbacks are not serialized. New initial props do not overwrite edits after mount.

Sequence config retains settings for all four subtypes so switching subtypes preserves existing selections. Every selection group remains valid, including inactive groups. Progression compatibility preserves the existing rule that at least one selected key/template pair is compatible; incompatible cross-products are not newly forbidden. SequenceConfig version 2 adds scalePracticeMode and an ordered scaleRepertoire array. The default remains Intervals, with Random selected for scale practice and an empty repertoire. Version 1 Sequence configs are explicitly unsupported; there is no persisted preset data to migrate. The structural parser takes the feature's expected version, defaulting to version 1 for unchanged features.

MelodyConfig composes existing MelodySettings with static Continuous Practice options. Conversion to MelodySettings excludes those timed options. Active deadlines, recordings, results, and diagnostic history remain session-owned. MelodySettingsControls renders controlled generation fields; optional MelodyPracticeOptions composes timed setup controls in the existing fieldset. Neither mounts an exercise engine. Existing Flashcard, Sequence, and Ear Training controls omit Reset Session when no reset callback is provided; standalone sessions continue supplying it.

These boundaries prepare future configuration editors without implementing Practice Session or storage. Standalone Flashcard/Sequence launches retain fixed starter targets; supplied configurations use the configured-launch boundary below. MIDI, audio, Mobile Play, grading, target regeneration, and reset ownership are unchanged.


### Configured launch and native completion

FlashcardSession, SequenceSession, and EarTrainingSession accept optional `initialConfig` and `onPracticeUnitCompleted?: () => void` props. The config is consumed at mount: it initializes the settings and the first target, not a live controlled configuration. Equivalent or changed initial props do not overwrite edits or restart the current target. A host must remount (for example, with a new React key) to launch another prescription, including consecutive entries using the same engine.

For a configured Flashcard or Sequence launch, the target hook's lazy state initializer calls the existing generator with the initialized settings. No default target is presented and then replaced in an effect. Configured response timing starts at initialization; no-config launches retain the fixed starters and their existing zero initial timestamp. Ear Training already generates lazily from its settings; supplying initialConfig now reaches that path. Its settings effect compares settings identity so Strict Mode effect replay does not regenerate the initial prompt. Initializer checks in development Strict Mode may generate discarded candidates, but do not emit completion or present the standalone starter.

The optional notification has no payload: it means one native unit completed. Flashcards emits after successfully locking a correctly answered note or triad target. Sequences emits at the guarded final-step boundary for intervals, random scales, arpeggios, and progressions. A whole ascending-descending generated sequence is one unit. Ear Training emits after successfully locking an eventually correctly identified prompt, even if earlier guesses were wrong. Partial input, incorrect attempts, replay, target generation, settings changes, and Reset Session do not emit completion. No statistic or DOM value is polled.

Notifications run synchronously from the authoritative success handler, after scheduling existing transitions, and outside React state updaters/effects. Existing target locks prevent repeated input from notifying twice. Flashcard virtual triad selection uses a ref alongside display state so grading and host notification happen in the input handler, including rapid input and Strict Mode. Callback changes update handlers without regenerating targets. Unmount cleanup retains existing transition and MIDI ownership; the host remains responsible for its own run identity.

Ear Training still requires the explicit prompt-play action and never autoplays on configured launch or advancement. These P1 engine contracts add no host presentation, persistence, progress targets, or Practice Session runtime. Melody has a distinct timed-target contract described below.


### Scale Repertoire

Scale practice supports Random, Repertoire - In Order, and Repertoire - Shuffle within the existing Sequence feature. Random retains its existing forms, directions, starting-note categories, and clef range. Repertoire hides the random-only filters, keeps clef selection, and exposes the catalog plus an explicitly ordered selection with Move Up, Move Down, and Remove controls. Catalog grouping does not constrain the user's traversal order.

`src/features/sequences/scale-repertoire.ts` owns catalog identity, realization, and finite traversal. Catalog IDs retain written tonic and form (for example `c-sharp-melodic-minor`), without using or expanding MusicKeyId. The 28 visible entries comprise C/D/E/F/G/A/B major and each relative natural, harmonic, and melodic minor. G-sharp harmonic and melodic minor remain visible but disabled with an accessible, visible double-accidental explanation. G-sharp natural minor is selectable. Config parsing rejects disabled entries, unknown identities, and duplicates rather than respelling or dropping them.

Every repertoire scale is one octave ascending and descending, with the top tonic once: exactly 15 single-note steps, one completed scale, no repetition multiplier. Realization calls the same scale-pattern function used by Random and supplies an explicit root letter. Classical melodic minor raises sixth/seventh ascending and uses natural minor descending; harmonic minor raises the seventh in both directions. Register is the lowest eligible written tonic in the existing clef range (C4 for treble C major); mixed clef retains existing clef selection. All 26 selectable entries are tested in both clefs without double accidentals.

SequenceConfig's scaleRepertoire is an ordered array of catalog IDs, detached at parser and runtime conversion boundaries. Empty selection is valid setup data, not a playable traversal: the session shows a selection prompt, hides notation/keyboard, and blocks grading. It never falls back to Random. Selecting the first scale starts the configured repertoire through the existing settings-change lifecycle.

A traversal holds one ordered permutation and a completed-entry count. Only the guarded musical success boundary advances it; retry or target regeneration does not. In Order uses the selected order. Shuffle uses one Fisher-Yates permutation without replacement. Completing the last scale emits `onScaleRepertoireCompleted?: () => void` once, in addition to that scale's existing `onPracticeUnitCompleted` notification. Completion state is visible inside the existing Sequence card, preserving the notation/keyboard stage layout. After the normal completion delay, continued standalone play starts another cycle (a new shuffle for Shuffle). The finite traversal boundary remains explicit for a future host.

Reset Session creates a new traversal, resets statistics as before, and starts its first entry. Selection/order/mode/clef changes restart traversal and preserve statistics, matching existing settings behavior. None emits completion. Supplied repertoire initialConfig generates its first repertoire target in the lazy initializer; no interval or Random target is shown first. Changing initialConfig after mount still does not restart the engine. MIDI, validation, notation, feedback, and keyboard input use the existing Sequence engine. Practice Session and persistence remain future work.


### Melody configured launch and timed target completion

`MelodySession` accepts `initialConfig?: MelodyConfig`. The existing version-1 parser validates a detached mount snapshot; generation settings and continuous-practice options initialize from that snapshot. The first phrase is generated in the lazy initializer from those settings, without a default phrase replacement effect. Prop changes do not override edits or restart the mounted engine. Without a config, standalone defaults are unchanged. Start remains explicit; configured launch does not create audio or start a deadline.

`onPracticeTargetReached?: () => void` reports timed achievement, not a phrase count. Melody retains its existing clock and deadline authority: the deadline begins at the first successful count-in, and expiration during count-in/performance waits for the phrase's normal evaluation. Expiration on results settles directly into existing Review. Both paths latch achievement, retain final original result/history, and deliver the notification in an effect after that state commits. The notified run is marked before calling the host, allowing immediate continuation or parent replacement. No statistics are polled. Callback changes do not re-notify; run identity, disposed interval guards, and existing attempt cancellation protect reset/unmount boundaries.

The optional React ref exposes `MelodySessionHandle.continuePractice(): boolean`, a runtime action only. From settled, achieved Review it resumes continuous practice with a fresh phrase using current generation settings and the existing count-in/recorder/grader. Normal results and Try Another (including the existing pedal action) support further phrases without host intervention; the expired countdown is no longer displayed. It returns false before achievement, during an active attempt, or after unmount. Repeated calls before rerender cannot start multiple attempts. The original target remains achieved; continuation neither creates another deadline nor emits another target notification. If the existing interruption/review lifecycle returns to Review, the action can resume again with history retained. No continuation button is added to standalone Melody.

Continuation preserves all immutable original results and retry histories. Fresh generated phrases append original diagnostic trials through the existing diagnostic branch; Review retries still append Repair evidence to their original trial through the separate review-retry branch. Review filters and Sight Read/Repair analytics remain Melody-owned. Returning to Settings clears the run as before; New Timed Session starts a genuinely new history/deadline and permits one new target notification. Non-continuous Melody retains ordinary phrase results and has no timed-target completion contract.

MelodyConfig remains schemaVersion 1. MelodySettingsControls and MelodyPracticeOptions remain configuration-only editors; runtime actions and achievement are never serialized. MIDI/audio ownership and Mobile Play are unchanged. Practice Session, its persistence/builder/runtime, and host-owned Mobile Play remain future work.


### Practice Session preset library

`src/features/practice-session/` owns the version-1 saved prescription domain. A library contains an ordered preset array and an optional last-used preset identity; each preset contains an ordered exercise array. Preset IDs are unique within the library, exercise IDs are unique within their owning preset, and the pair `{ presetId, exerciseId }` is sufficient identity outside that boundary. Names and custom exercise labels are persisted independently from engine identity. Creation and duplication use browser-native `crypto.randomUUID()` through injectable factories. Duplicating a preset regenerates its preset ID and every copied exercise ID.

Exercise entries form a discriminated union for Flashcards, Sequences, Ear Training, and Melody. Each entry stores its feature-owned JSON-safe config snapshot without flattening settings. Targets preserve native semantics: correct answers, completed sequences, complete Scale Repertoire, correct identifications, or Melody's configured timed practice. Scale Repertoire has no numeric repetition, and Melody duration exists only in MelodyConfig. The SequenceConfig version remains 2 while the other feature configs and Practice Session preset/library schemas remain independently versioned at 1.

One persisted representation supports both drafts and runnable presets. `count: null` is the only incomplete numeric target state. Empty presets, empty Scale Repertoires, and non-continuous Melody entries are valid saved drafts; explicit runnable validation reports concise launch-readiness issues for them. Structural parsing separately rejects malformed entries, incompatible engine/config/target families, duplicate owning-scope IDs, and corrupt nested configs. It delegates feature validity to each feature parser and propagates nested unsupported versions without dropping exercises or presets.

The complete library is stored under `prelude-practice-session-library-v1`. A missing key loads an empty library without demo content. Loading and parsing never write, repair, delete, or migrate storage. Malformed JSON, corrupt data, and unsupported schemas remain untouched for explicit future recovery. A stale `lastUsedPresetId` normalizes to `null` in memory so presets remain accessible, but the original bytes remain unchanged until an explicit save. Normal preset deletion deliberately clears that preference when it references the deleted preset.

Pure immutable functions create, rename, add, update, remove, reorder, duplicate, and delete prescription data. Domain mutations do not persist automatically; saving is an explicit storage operation. Practice Session UI, engine mounting, active-run state, progress, timers, evidence, history, analytics, and session recovery remain outside P4.

P5 adds Practice Sessions to the existing local App mode navigation without a router or registry. Its builder remains mounted behind a native `hidden` wrapper while another mode is active, preserving unsaved in-tab work while removing its controls from focus order and the accessibility tree. Inactive builder mutation announcements are suppressed. The builder mounts configuration controls only, never an exercise session engine or Practice Session runtime.

`PracticeSessionBuilder` owns a working library, an optional last-saved baseline, selection state, and explicit whole-library Save. Ordinary missing or valid storage creates a clean saved baseline; corrupt or unsupported storage has no baseline and blocks editing. Confirmed Start Fresh authorizes an empty replacement while leaving the saved baseline absent, so Save is available even before a preset is added. Existing bytes remain untouched until that Save succeeds. Successful saves establish a new baseline; failures retain the working library and unsaved state.

The feature-local builder option table creates eight human-facing concepts from existing config defaults. Numeric exercises begin with `count: null`; Scale Repertoire uses its marker target; Reading Flow enables Melody Continuous Practice and keeps duration only in MelodyConfig. The exercise editor directly updates the working library with no Apply layer. It reuses the controlled Flashcard, Sequence, Ear Training, and Melody settings components without their session hooks or Reset actions. Sequence subtype/mode edits change config and target family atomically when crossing the Scale Repertoire boundary.

Preset readiness comes only from `validateRunnablePracticeSessionPreset()` and is presented as Ready or Needs setup. Presentation helpers summarize configuration and native targets without serializing raw configs. Preset switching and top-level mode switching do not prompt or discard working edits. Preset deletion and unreadable-storage replacement use small native confirmations; exercise removal remains confirmation-free.

### Practice Session runtime

P6 keeps edit, active-run, and summary lifecycle ownership in `PracticeSessionBuilder`. Start Practice is available only for the selected runnable preset and uses its current working-library value, including unsaved edits. Start creates a JSON-detached, read-only preset snapshot; subsequent builder state cannot change the run. Starting always updates the working library's last-used identity. That preference is written immediately only when the working library matched a valid saved baseline before Start; dirty and recovery-authorized libraries retain explicit whole-library Save semantics.

`practice-session-runtime.ts` contains a pure reducer. IDs, callback tokens, and timestamps are created by the React boundary and carried in events. Runtime records exist only for entered exercises and retain identity/order, timing, actual count where applicable, monotonic target achievement, Bonus use, and a neutral completed/skipped/not-reached disposition. Runs and records remain memory-only; reload recovery, event logs, evidence persistence, analytics, APIs, and databases are absent.

The runtime mounts exactly one keyed Flashcard, Sequence, Ear Training, or Melody engine through an explicit discriminated-union switch. Every callback carries its run ID, exercise token, and exercise ID; mismatches are ignored after Next, Skip, End, unmount, or a new run. Count callbacks remain uncapped after achievement. Scale Repertoire separately counts completed scales and treats `onScaleRepertoireCompleted` as authoritative. Melody treats `onPracticeTargetReached` as authoritative, owns its timer, and continues Bonus through its existing imperative handle without remounting.

The optional `practiceSessionMode` engine prop is presentation-only. It suppresses settings, reset, Focus Staff entry, and timed-session replacement actions while retaining parsing, generation, grading, input, audio, timers, callbacks, Melody Start/count-in, review/repair, and Ear Training prompt playback. Standalone behavior remains the default. Practice completion is a nonmodal host strip; Skip and End require no confirmation, and summaries contain only entered exercises with neutral language. App retains its single persistent `MidiProvider`. Host-owned Mobile Play continuity remains deferred to P7.
