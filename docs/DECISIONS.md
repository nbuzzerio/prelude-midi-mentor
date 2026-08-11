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

## 2026-07 — Interface Feedback Uses a Dedicated Audio Layer

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

---

# 2026-07 — PracticeTarget Is the Core Practice Primitive

## Decision

Prelude's isolated practice engine is built around a generalized `PracticeTarget` model rather than separate models for notes, chords, intervals, or future exercises.

## Reason

Many practice modes share the same responsibilities:

- rendering notation
- validating user input
- providing feedback
- tracking statistics

Using a single abstraction allows new musical concepts to be introduced without duplicating the surrounding practice infrastructure.

## Consequences

- New isolated exercises should integrate with `PracticeTarget` whenever practical.
- Rendering, playback, and validation consume the same practice model.
- Future lesson systems may build upon this foundation while introducing higher-level sequence models.

---

# 2026-07 — Feature Modules Own Practice State

## Decision

Prelude organizes feature-specific logic into dedicated feature modules rather than concentrating application behavior inside React components.

## Reason

As the project expanded beyond simple note flashcards, separating orchestration from presentation made the codebase easier to maintain and extend.

Components should primarily render UI, while feature modules coordinate practice behavior and state.

## Consequences

- Feature-specific hooks belong within their feature module.
- UI components remain focused on presentation.
- Shared utilities continue to live outside React in reusable libraries.

---

# 2026-07 — Rendering, Validation, and Audio Remain Independent

## Decision

Notation rendering, answer validation, and audio playback are separate systems that communicate through shared application models rather than directly with one another.

## Reason

Each subsystem has a distinct responsibility:

- notation displays music
- validation evaluates user input
- audio produces sound

Keeping these responsibilities independent reduces coupling and makes future enhancements easier.

## Consequences

- Audio systems can evolve without changing validation logic.
- New rendering or playback technologies can be introduced with minimal architectural impact.
- Practice logic remains independent of presentation and output.

---

# 2026-07 — Stabilization Before Expansion

## Decision

Prelude reaches a stable v1.0 release before expanding into additional musicianship features.

## Reason

As the architecture matured, documentation and automated testing became more valuable than introducing additional feature work.

Establishing a well-documented, well-tested foundation reduces future maintenance costs and provides a stronger base for continued development.

## Consequences

- Major documentation is completed before new feature development resumes.
- Automated testing is prioritized alongside implementation.
- Future milestones can build upon a stable, documented architecture rather than revisiting earlier design decisions.

---

# 2026-08 — Chord Progressions Belong to Sequence Mode

## Decision

Chord Progressions are an exercise inside Sequence mode, not a new top-level mode. Flashcards remain isolated graded targets, Sequences remain ordered graded events, and Free Play remains ungraded without chord analysis.

## Reason

A progression is inherently an ordered series of graded chord events and already fits `SequenceTarget` and `SequenceStep` semantics.

## Consequences

- Progression settings, target lifecycle, statistics, and retries are owned by the Sequence feature.
- Chord Progressions do not merge the independent Flashcard, Sequence, or Free Play state machines.

---

# 2026-08 — Progressions Use Structured Curated Harmony

## Decision

Progressions come from a curated library rather than random chord ordering. Templates store explicit scale degree, triad quality, and Roman numeral data. Minor progressions derive roots from natural minor and explicitly specify major V and diminished ii° where the template requires them.

## Reason

Structured templates preserve recognizable harmonic function, deterministic realization, correct labels, and testable minor-key behavior.

## Consequences

- The initial supported keys are intentionally limited to C, G, D, F, B♭, and E♭ major and A, E, B, D, G, and C minor.
- MVP progression chords are root-position triads only; inversions and seventh chords are not implied.
- Correct diatonic spelling is required, and candidates requiring unsupported double accidentals are excluded.

---

# 2026-08 — Progressions Use Dedicated Candidate Ranges

## Decision

Chord Progressions use progression-specific clef ranges with slightly wider upper bounds than other Sequence exercises.

## Reason

The generator must fit every tone of every root-position triad while offering useful voicings in both clefs.

## Consequences

- Progression range changes remain isolated from interval, scale, and arpeggio generation.
- Generation enumerates all compatible key, template, clef, and tonic candidates before random selection.

---

# 2026-08 — Physical and Virtual Chord Collection Use Different Interaction Policies

## Decision

Physical MIDI uses the generic shared chord collector with a 225 millisecond note-grouping window. Virtual Sequence chord input uses persistent feature-owned selection with toggle-to-deselect behavior and no timer. The completed virtual set is played as a chord and graded when its unique-note count reaches the current step size.

## Reason

The short window supports human block and rolled MIDI performance but is not usable for sequential mouse, keyboard, or touch selection.

## Consequences

- `useChordAttempt` is shared by Flashcards and Sequences, while correctness validation remains feature-owned.
- Physical and virtual attempts never combine.
- Single-note Sequence input remains immediate.
- Pending virtual selection is cleared at every target and attempt lifecycle boundary, including Focus Staff entry.

---

# 2026-08 — Progression Settings Preserve Explicit Compatibility

## Decision

Key and template toggles reject changes that would leave no compatible key/template combination instead of silently enabling, disabling, or replacing unrelated selections.

## Reason

Settings should reflect direct user choices and always leave target generation with at least one valid candidate.

## Consequences

- Major templates pair only with major keys and minor templates only with minor keys.
- Accepted generation-setting changes regenerate the target while preserving session statistics.

---

# 2026-08 — Musical Keys Are a Shared Music Domain

## Decision

Stable major and minor key definitions belong in `src/lib/music/keys.ts`, not in Chord Progressions or Free Play. The initial shared domain intentionally supports six major and six minor keys rather than every conventional signature.

## Reason

Tonic spelling, mode, orientation, diatonic degrees, and notation-signature identity are music-domain facts reusable by progressions, Free Play, future Ear Training, and Lessons.

## Consequences

- Chord Progressions and Free Play consume one coherent set of 12 key definitions.
- Feature-owned templates, settings, and behavior remain outside the shared module.
- Unsupported keys and double-accidental spellings are explicit boundaries rather than implied support.

---

# 2026-08 — Free Play Owns Deterministic Spelling Context

## Decision

Free Play defaults to No Key plus Automatic chromatic spelling. Diatonic notes always retain the selected key's spelling; user sharp/flat preference applies only to chromatic notes. Automatic uses the selected key's sharp or flat orientation, or a balanced deterministic mapping for neutral and No Key contexts.

## Reason

Live held notes have no melodic or harmonic history from which to infer a uniquely contextual chromatic spelling. A deterministic policy is predictable without claiming harmonic analysis.

## Consequences

- No Key remains distinct from explicitly selected C major, even though neither displays signature accidentals.
- Prefer sharps and Prefer flats cannot corrupt a key's diatonic spelling.
- Free Play does not perform automatic key detection, chord identification, or contextual harmonic analysis.

---

# 2026-08 — Free Play Supplies Spelled Notes to Shared Notation

## Decision

Free Play preserves raw physical and virtual MIDI pitches as session state, applies its own notation context, and supplies explicitly spelled `PracticeNote` values plus an optional validated key identity to `MusicStaff`. Changing notation settings preserves held notes and does not replay audio.

## Reason

Feature ownership keeps spelling policy out of the renderer and allows held notes to respell immediately without changing their sounding pitch or input lifecycle.

## Consequences

- Physical and virtual Free Play input use identical spelling after their raw MIDI sets are merged.
- VexFlow renders the supplied spelling and calculates Free Play accidentals relative to each stave's signature.
- Flashcard and Sequence spelling and explicit-accidental paths remain isolated and unchanged.

---

# 2026-08 — Mobile Play Uses a Best-Effort Shared Browser Lifecycle

## Decision

Flashcards, Sequences, and Free Play share `useMobilePlay` for fullscreen and landscape-orientation acquisition and cleanup. Layout activation does not depend on either browser API succeeding, and external fullscreen exit does not automatically exit the layout. Focus Staff and Mobile Play are mutually exclusive.

## Reason

Fullscreen and orientation support varies across mobile browsers and installed-app contexts. Treating those APIs as enhancements preserves a usable, explicit layout fallback while keeping browser lifecycle ownership out of feature sessions.

## Consequences

- Prelude releases only fullscreen and orientation state that it acquired.
- The user can use Exit Mobile Play after fullscreen refusal or external fullscreen exit.
- Flashcards and Sequences retain graded toggle input; only Free Play uses momentary multitouch callbacks.
- Current notation enlargement is mode-specific and transform-based. Container-driven responsive VexFlow sizing remains deferred to the later UI/UX overhaul.

---

# 2026-08 — Ear Training Owns Aural Classification

## Decision

Ear Training is a fourth top-level feature with an independent target, prompt, grading, settings, and statistics lifecycle. Its first release contains melodic interval identification only.

## Reason

An aural interval prompt is neither a notation-first Flashcard target nor a Sequence the learner performs step by step. Explicit ownership preserves those domain boundaries while allowing shared musical facts and playback infrastructure.

## Consequences

- Answers use interval-name buttons rather than MIDI or the virtual piano.
- Focus Staff is unavailable; Mobile Play uses an Ear Training-specific answer layout.
- One target contributes at most one incorrect attempt, and any failed target contributes no streak credit.
- Single notes, harmonic intervals, chords, melodies, notation reveal, reference tones, keys, and persisted history remain deferred.

---

# 2026-08 — Deterministic Playback Uses Shared Musical Events

## Decision

Ordered piano playback is scheduled by a React-independent musical-event player. Events contain simultaneous MIDI notes, a start offset, and a duration. Grand-piano notes return backward-compatible cancellable handles.

## Reason

Ear Training needs reliable two-note prompt replay now, while Staff Builder will next need mechanically correct note, chord, location, and piece playback. Sharing the smallest timing boundary avoids disposable Ear Training scheduling without introducing a lesson or DAW model.

## Consequences

- Replacement cancels pending events and currently sounding notes.
- Completion and browser playback failure are explicit non-throwing results.
- Ear Training owns prompt UI state but not timer scheduling.
- Measures, beats, BPM, looping, cursor tracking, notation data, and transport UI are not part of the shared primitive.

---

# 2026-08 — Staff Builder Is a Learning-Focused Score Editor

## Decision

Staff Builder prioritizes beginner transcription and creation of practice material rather than professional engraving or general-purpose composition. The visible score is the primary editing surface where practical, while complete explicit controls remain available as fallbacks.

## Reason

Prelude's purpose is transferable musicianship. A constrained score editor can keep first-week learners close to notation without importing the complexity and expectations of professional notation software or prematurely defining Guided Lessons.

## Consequences

- Beginner defaults and learner-facing corrections take priority over exposing every engine capability immediately.
- Staff Builder projects remain distinct from future Guided Lessons and teacher assignments.
- Advanced correction capabilities remain available without dominating the main workspace.

---

# 2026-08 — Staff Builder Owns Score Data Independently of VexFlow

## Decision

Measures, events, staves, rhythm, ties, tempo, and measure context are application-owned domain data. VexFlow renders decorative notation and returns public render geometry; React owns semantic interaction overlays.

## Reason

Musical meaning must remain stable across rendering, validation, persistence, playback, responsive presentation, and future lesson integration. Depending on VexFlow SVG nodes or private renderer state would couple core behavior to an implementation detail.

## Consequences

- Renderer anchors are transient and never enter score history or persistence.
- Direct score interaction uses public geometry rather than querying SVG DOM.
- Rendering can evolve without redefining the score schema or editor ownership.

---

# 2026-08 — Capture Notes and Rhythm Correction Are Separate Workflows Over One Score

## Decision

Capture Notes optimizes transcription and rhythmic cursor movement; Rhythm Correction edits selected authoritative events. Both operate on one score but retain separate interaction state and responsibilities.

## Reason

Pitch entry and detailed correction have different beginner workflows. Combining them into one state machine would obscure intent and make direct score editing harder to reason about.

## Consequences

- Capture owns pending pitches, routing, Step Duration, cursor navigation, and lock/rest entry.
- Rhythm owns event selection and explicit duration, event-type, staff, spelling, tie, and deletion operations.
- Capture mutations may invalidate stale Rhythm history; history is not a universal command log.

---

# 2026-08 — Draft Autosave and Validated Save Have Different Meanings

## Decision

Staff Builder continuously preserves recoverable draft work locally, while the explicit Save action represents a score that has passed structural validation.

## Reason

Learners should not lose incomplete work, but an incomplete draft should not be presented as ready practice material. One save concept cannot communicate both guarantees clearly.

## Consequences

- Draft persistence may contain unresolved issues and editor position.
- Validated Save remains gated by score validation and guided correction.
- Both meanings use the existing local persistence boundary; no cloud or lesson-sharing model is implied.

---

# 2026-08 — Staff Builder Scores Remain Authoritative for Piece Practice

## Decision

Blocking Piece Practice reads a transient attack-onset projection of a structurally valid saved Staff Builder score. It does not persist a copied practice score or convert the piece into `SequenceTarget`.

## Reason

One musical source avoids synchronization bugs and ensures that the next practice launch naturally reflects the latest validated save. Piece Practice also needs measure, onset, staff, rest, duration, spelling, and tie identity that the older Sequence abstraction does not represent.

## Consequences

- Active practice uses a stable in-memory snapshot; edits appear on the next launch rather than live-syncing.
- Practice progress and statistics remain session-only.
- The Staff Builder library owns eligibility and launch/return context.

---

# 2026-08 — Blocking Piece Practice Phase 1 Grades Attacks, Not Performance Timing

## Decision

Phase 1 groups newly attacked pitches by musical onset and grades exact sounding MIDI pitch sets. Incorrect attempts remain on the current target. Sustained and incoming tied pitches are not re-required, and targetless measures require explicit acknowledgement.

## Reason

This produces musically correct beginner blocking practice without pretending to measure BPM, held duration, silence, or continuous rhythmic accuracy. Those concerns require a separate timestamped performance model.

## Consequences

- Simultaneous same-staff and cross-staff attacks form one target regardless of rendered voice count.
- Written durations and rests remain visible/source metadata but do not create Phase 1 hold or silence timers.
- Future continuous Accuracy work remains separate and has not started.

---

# 2026-08 — Same-Staff Rhythmic Voices Are Derived

## Decision

Staff Builder infers the minimum deterministic rhythmic voice allocation from authoritative staff, onset, and duration data. Voice IDs and voice-local gap rests are not persisted or exposed as beginner controls.

## Reason

Solo-piano notation commonly sustains one event beneath later attacks on the same staff. Requiring manual voice management or authored hidden rests would expose notation-software machinery that is unnecessary for the beginner workflow.

## Consequences

- Staff-wide union coverage determines structural completeness.
- Render-only implicit gaps never become selectable events, history, persistence, playback, or practice targets.
- Ties and interaction remain attached to authoritative event/pitch IDs rather than derived voice indexes.

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
