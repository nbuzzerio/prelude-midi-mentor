# Prelude: MIDI Mentor — ONBOARDING

> **Current package/application version:** 2.9.1
> **Last updated:** October 7, 2026
> **Product direction:** owner-approved [rolling roadmap](./ROADMAP.md); instrument learning now precedes Improv
>
> Implementation, automated validation, physical QA and owner-controlled release/tag/deployment are separate facts. Broad device/instrument QA remains pending; this document does not assert a release.

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
- Guided Studies that orchestrate native learning activities
- Teacher-created exercises
- Ear training
- Rhythm practice
- Practice-material authoring and later Study/teacher workflows
- Improv and later motif/idea development
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

# Implemented Practice Platform

Prelude already contains multiple working feature domains. The rolling roadmap extends their musical value while keeping physical QA visible. Users can:

1. Practice isolated notes and triads with Flashcards.
2. Practice ordered intervals, scales, arpeggios, and chord progressions with Sequences.
3. Use Free Play for key-aware live grand-staff notation without grading.
4. Play using either a MIDI keyboard or the on-screen keyboard.
5. Receive immediate feedback in graded modes.
6. Track session performance in Flashcards and Sequences.
7. Practice anywhere using an installable Progressive Web App.
8. Build and run reusable Practice Session presets across Flashcards, Sequences, Ear Training, and timed Melody practice.

---

# Current Status

Nine top-level modes/tools are implemented: Flashcards, Sequences, Free Play, Ear Training, Melody, Staff Builder, Practice Sessions, MIDI Diagnostic and Chromatic Tuner. Staff Builder also launches Piece Practice and its Targeted Practice workflow.

Completed features include:

## Practice

- Treble clef mode
- Bass clef mode
- Mixed mode
- Single-note flashcards
- Major triad flashcards
- Minor triad flashcards
- Diminished triad flashcards
- Augmented triad flashcards
- Root position, first inversion, and second inversion
- Configurable exercise types
- Random target generation
- Session statistics
- Accuracy tracking
- Response-time tracking
- Streak tracking
- Ascending and descending melodic interval sequences
- Configurable interval selection
- Natural-note and accidental-note filters
- Step-by-step sequence validation
- Sequence accuracy and completion statistics
- Major, natural minor, harmonic minor, and melodic minor scales
- Major and minor pentatonic scales
- Major, minor, diminished, augmented, dominant seventh, major seventh, and minor seventh arpeggios
- Theory-aware spelling for intervals, scales, and arpeggios
- Curated Roman-numeral chord progressions in supported major and minor keys
- Theory-aware root-position triads with progression and current-chord labels
- Progression-specific clef ranges and compatible key/template settings
- Free Play mode with No Key or 12 supported major/minor key contexts
- Automatic, Prefer sharps, and Prefer flats live note spelling
- Immediate respelling of held physical or virtual notes without replay

## Input

- Physical MIDI keyboard support
- On-screen piano keyboard
- Simultaneous MIDI note tracking
- Timed chord collection
- Rolled chord support
- Physical MIDI block and rolled-chord progression input
- Persistent virtual progression-chord selection with toggle removal and chord playback
- Exact chord validation
- Permanent raw MIDI diagnostic mode with independent multi-input connection, exact bytes, browser timestamps, decoded channel/message data, bounded capture, and copy/manual-copy workflow
- One user-initiated Web MIDI connection persists across top-level mode changes; active features retain their own input/grading semantics
- Chromebook compatibility

## Feedback

- Immediate visual feedback
- Sample-based piano playback
- Adjustable feedback volume
- Persistent local preferences

## Notation

- Dynamic notation rendering with VexFlow
- Ledger lines
- Accidentals
- Breakpoint- and mode-specific transform scaling for current notation layouts
- Explicit Mobile Play across Flashcards, Sequences, Free Play, Ear Training, Melody, and active Piece Practice, with best-effort fullscreen/orientation
- Temporal Sequence measure windows with optional presentation-only Whole Sequence view
- Persistent grand staff for Free Play
- Automatic treble- and bass-staff placement for held notes
- Key signatures on both Free Play staves
- Natural signs and chromatic accidentals relative to the selected signature

## Platform

- Responsive desktop layout
- Responsive tablet layout
- Responsive mobile layout
- Progressive Web App
- Offline application shell
- Automated deployment
- Production hosting on DigitalOcean

## Staff Builder

- Application-owned canonical schema v4 multi-measure grand-staff score model; persisted/imported v1/v2/v3 scores migrate into v4 at the validation boundary
- MIDI and virtual-keyboard Capture Notes with rhythmic positioning and staff routing
- Direct duration, rest, tie, spelling, staff, key, and time correction
- Validation with guided corrections and learner-facing issue text
- Local project library, draft autosave, and distinct validated Save
- Per-piece `.prelude.json` download/import for backup and recovery without exporting draft or practice state
- Score annotations and multi-system Study View
- Full-piece, treble-range, and bass-range duplication; copies receive new top-level identity without mutating the source
- Upward rolled/arpeggiated chord authoring through optional schema v3 `arpeggiation` data
- Deterministic event, measure, position, and piece playback with playback-follow visualization
- Direct notation interaction, radial controls, responsive score scaling, and a mobile keyboard bottom sheet
- Automatic derived same-staff rhythmic voices with no persisted voice IDs or beginner-facing Voice controls

The Staff Builder **Copy Score for AI** action beside Piece Library copies the current editor score, including unsaved authored edits, using the same pure, pretty-printed schema-v4 JSON as `.prelude.json` export. It reuses `serializeStaffBuilderPiece` and the existing import validator; editor state and library usage metadata remain excluded. Clipboard failure exposes a labeled, focused, selected read-only textarea for manual copying. No AI service is contacted.

Staff Builder score schema v4 adds optional measure-level `clefChanges`, for example `{"bass":"treble"}`. Keys remain the semantic staff identities `treble` (upper) and `bass` (lower); values select treble or bass display clef independently. Changes take effect at the measure start and carry forward until superseded. There are no mid-measure changes. Historical scores default to upper Treble/lower Bass; legacy migrations preserve existing annotation/arpeggiation behavior. Explicit redundant changes survive canonical export. The current-measure Display clefs disclosure supports explicit selection or Inherit/Default removal, with Undo and autosave. Clef editing never changes pitches, MIDI values, spelling, timing, staff assignment, ties, or annotations. System and print-range starts resolve prior context; changes inside systems render at their measure boundary. Piece Practice propagates display context without changing grading. Library-v4 and draft-v3 envelopes and historical storage keys remain unchanged.

## Blocking Piece Practice

- Structurally valid saved Staff Builder pieces launch directly from the local library
- Staff Builder remains authoritative; practice uses a transient score-position projection rather than `SequenceTarget`
- Each position contains one aggregated normal check plus independent checks for authored rolled chords
- A position advances only after every check completes; mistakes remain blocked for retry and targetless measures require acknowledgement
- Chords, cross-staff attacks, independent/polyphonic rhythm, rests, and pitch-specific ties retain their authored musical meaning
- One stable MIDI owner, the ordinary 225 millisecond block-chord collector, tempo-relative rolled evaluation, persistent VKB chord selection, and strict MIDI/VKB source separation
- Start at Measure, Restart Measure, Restart Piece, completion statistics, read-only score reuse, and exit to the library
- Ordinary narrow Piece Practice remains responsive document flow; explicit Mobile Play preserves the same blocking session and input owner
- Feature-owned durable IndexedDB run snapshots/checkpoints, paused recovery and completed-report reopening
- Provisional Targeted Practice repairs original measures through ordinary Piece Practice runs; navigation/comparison links remain in-tab only
- No BPM, hold-duration, metronome or continuous timing grading

### Acoustic Piece Practice — 2.9.0 provisional

Choose Input → Microphone, Violin/Ocarina, and Pitch tolerance (±15, ±25 default, ±40 or custom integer 1–49 cents). Focus/range eligibility must succeed before Start Practice; Start Listening separately requests permission. Both instruments use the same detector. Give a brief quiet baseline after starting or resetting. A sustained note cannot satisfy repeated targets; after rejected intonation, re-articulate. A weak bow restart may require a gap. Acceptance does not assert "in tune."

The shared monophonic code lives in `src/lib/audio/monophonic`; onset, eligibility, grading, controls and the exclusive input owner belong to Piece Practice. Background/interruption stops capture and pauses timing; explicit Start is required on return or recovery. Reports preserve scalar acoustic evidence separately from physical MIDI. V2 records retain source/instrument/tolerance; V1 remains readable as keyboard. Score schema, database structure, MIDI/VKB rules and other practice domains are unchanged. Read the [physical QA procedure](./TESTING.md#acoustic-piece-practice-290) before making reliability claims.

### Violin preflight and acoustic analysis — 2.9.1 provisional

Violin microphone runs first check G3/D4/A4/E5, using the same capture owner while practice timing/grading are paused. Start Listening, bow steadily, then Retry, Skip or Continue. Green stable readings advance after 900 ms; the final summary requires explicit Enter Piece Practice and a fresh quiet/re-articulation boundary. Recovered unfinished violin runs require fresh preflight or Skip; no prior calibration is recovered. There is no mid-run recalibration UI.

Pure calibration and presentation live under `features/instrument-learning`; bounded scalar collection/export lives under `features/acoustic-analysis`. Analysis defaults On with a separate localStorage preference. Stop Listening to export JSON, or export from the current completed result. Export before leaving/reloading/restarting/Targeted Practice: calibration and trace are transient. Limits stop analysis visibly while practice continues. No raw audio, uploads, new IndexedDB store or V3 migration exists. Ocarina analysis is available but ocarina calibration/profile and all instrument diagrams remain future work. See ARCHITECTURE for exact policy and TESTING for physical QA.

## Melody

- Seeded monophonic one/two-measure 4/4 exercises with Web Audio count-in and continuous MIDI/VKB capture
- Two-quarter-beat preparatory display lead-in before authored and scored material
- Independent Pitch, Movement, and attack-Timing results with a read-only Pitch-result staff
- Timed diagnostic sessions with interruption-safe Session Review and targeted repair retries
- Immutable original diagnostic evidence, separate accumulated retry evidence, and original-versus-latest comparison
- Interval Trouble analytics separated into Sight Read and Repair datasets
- Explicit Mobile Play preserves the generated exercise, AudioContext, clock, recorder, source lock, keyboard, and results
- No duration/hold grading, richer meters, rests, chords, or persisted analytics in Phase 1

## Practice Sessions

- `src/features/practice-session/` owns browser-local preset types, validation, immutable library operations, the controlled builder, runtime reducer, summary, and hosted Mobile Play shell
- Presets contain ordered stable exercise entries and feature-owned configuration snapshots for Flashcards, Sequences, Ear Training, and Melody
- The library envelope is schema v2; stored v1 libraries migrate in memory with an empty curriculum list and are not rewritten until explicit Save
- Lightweight curriculum records preserve title/instructions, weekdays, rest/day notes, estimated duration, and references to ordinary presets without copying exercise data or adding scheduling state
- `src/features/practice-session/import/` owns the independently versioned reduced Weekly Practice contract, collecting validator, canonical translator, tested examples, JSON Schema, and pure Copy-for-AI specification generator
- The same folder owns pure Weekly Practice import preparation/application and preview derivation; the builder dialog only collects input and presents those results. Import changes working state, selects the first imported practice preset, and requires the existing Save action to persist.
- `createWeeklyPracticeLlmSpecification()` is the one clipboard payload for the AI generation guide. React explains the copy/paste workflow but does not duplicate contract fields or allowed values; clipboard failure exposes the same generated text for manual copying, and no student data is sent by Prelude.
- When extending an importable exercise, update feature-owned constants first, then the reduced variant, translator, schema/specification inputs, examples, and canonical compatibility tests together
- Explicit Save persists the complete preset library; active runs, progress, evidence, and summaries remain memory-only
- One keyed exercise engine mounts at a time while the stable Practice Session host preserves Mobile Play across transitions
- Comprehensive authored-order reports include never-entered work, prescribed/Bonus evidence and browser-native printing; no persisted report history

## Chromatic Tuner

- Implemented standalone foreground microphone Start/Stop, monophonic detection, note/octave/Hz/cents and stabilization/uncertainty
- Interruption handling, bounded cleanup and exclusion during active Practice Session runs
- Shared monophonic implementation with Acoustic Piece Practice; independently owned capture and tuner presentation, no recording/upload or global microphone bus
- Desktop synthetic browser evidence and one owner-observed successful real violin test; broader Chromebook/Android and violin/ocarina/sung-voice QA remains pending
- Strong harmonics can still cause confident octave mistakes

## Quality

- Vitest test runner
- React Testing Library
- Pure music-theory tests
- Stateful hook tests
- Web MIDI integration tests
- Flashcard session integration tests
- Automated tests for flashcards, sequences, music theory, MIDI behavior, and theory-aware spelling
- Focused Mobile Play lifecycle and cross-mode preservation tests

---

# Current Development Focus

Current version is **2.9.1**. [ROADMAP.md](./ROADMAP.md) is authoritative: acoustic practice → calibration/analysis → instrument visualizers → later Intonation Search/Practice Coach → Improv. Microphone Staff Builder authoring remains later. QOL/PWA, Flow and Studies continue at appropriate rates. Physical QA and confirmed regression fixes proceed alongside these priorities.

Staff Builder owns its canonical v4 score, authoring/correction, validation, library/drafts, notation and playback projection. Historical storage-key names are not schema declarations. Piece Practice owns blocking runs and durable evidence separately from scores; Targeted Practice is repair inside that engine. Practice Sessions own reusable prescriptions, import and native-engine orchestration; their runtime/report evidence remains transient. Sequences own scale execution and any future hand configuration. No universal engine replaces these domains.

Run `pnpm verify` and report exact executed counts for the current handoff. Automated results do not establish physical MIDI/microphone, printing, accessibility or installed-PWA support; use [TESTING.md](./TESTING.md) for evidence categories and outstanding checks. Git, release and deployment remain owner-controlled.

PWA Update + What's New is implemented in `src/features/app-update`, with one platform registration/controller in `src/lib/pwa/register-service-worker.ts` bootstrapped by `main.tsx`. Worker callbacks report updates; only a user-confirmed request reloads its own tab. Keep curated records in increasing sequence order with immutable published IDs/sequences, independent of commits and package bumps. First use shows newest only; acknowledgment is browser-local and must not move backward. There is no global recovery/save coordinator. Review the first legacy transition, two-tab caching caveat and production-build QA in [RELEASING.md](./RELEASING.md).

---

# Intended Architecture and Reuse

Existing `PracticeTarget` and `SequenceTarget` models remain appropriate to their domains. Staff Builder owns score measures/events; Free Play owns live notation context; Melody owns timed performance. Sharing musical facts and helpers does not require one Lesson → Measures → Events hierarchy for all practice.

Guided Studies are intended orchestration, not an implemented engine. They own the teaching journey and consume explicit native launch/completion/return contracts while rendering, timing, input, grading, persistence, playback and evidence remain with existing features. A Practice Session organizes what to practice; a Study teaches why. Study View remains score presentation. D Minor is the likely first vertical slice; its objective/audience and exact prerequisites are deferred until planning that slice.

The tuner remains feature-local. Conceptual `AudioSource → MonophonicPitchAnalyzer → observation → consumer` and a separate future polyphonic path describe responsibilities, not global services. Extract on demonstrated reuse. Pitch cannot reveal actual violin fingering; ocarina mapping needs a defined profile/chart; voice means sung pitch. Each acoustic consumer needs its own evidence and acceptance/rearming/timing semantics. See [ARCHITECTURE.md](./ARCHITECTURE.md) for implemented boundaries.

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
- Keep documentation synchronized with the implementation.
- Keep components modular.
- Document architectural decisions.
- Prefer simple solutions before introducing abstractions.
- Build features that can be expanded rather than rewritten.
- Test musical behavior at the lowest useful layer.

Every new feature should fit naturally into the long-term vision of the application.

---

# Documentation

Project documentation consists of:

- ONBOARDING.md — Project overview and current status
- ROADMAP.md — Authoritative rolling priorities, continuing threads and deferred decisions
- ARCHITECTURE.md — Technical design and project structure
- DECISIONS.md — Record of important architectural decisions
- VISION.md — Long-term goals and design philosophy
- README.md — Public project overview
- TESTING.md — Testing philosophy and coverage

New contributors should read these documents before beginning
development.


### Staff Builder AI Authoring Guide

The compact **?** beside **Copy Score for AI** opens the AI Authoring Guide. **Copy Score for AI** copies the current canonical v4 score, including unsaved edits. The guide dialog's **Copy for AI** copies a self-contained authoring contract for creating new importable scores in a fresh AI conversation. Save returned raw JSON as a `.prelude.json` file and use **Import Piece** in Piece Library.

The deterministic guide draws from Staff Builder's shared capabilities and explains all portable fields, measure-context inheritance, notes/chords/rests, rhythm, pitch spelling, upward arpeggiation, ties, and study annotations. It distinguishes structural import acceptance from musical validation and practice readiness. Clefs are display context only: staff identity, pitch, MIDI, and grading remain unchanged.

The accessible dialog supports keyboard focus containment, Escape/Close, and focus restoration. Clipboard failure provides the exact guide in a selected read-only textarea for manual copying. Opening or copying the guide does not edit or save a score and performs no network requests.


### MIDI Diagnostic musical inspection

**Musical Events** is the default view of Raw event capture. **Raw MIDI / All Messages** retains the original message table. Both use the same unchanged 1,000-message raw retention limit; filtering does not alter capture or **Copy Capture**. This is a short hardware diagnostic, not an Idea Capture recorder.

The musical view pairs ordinary note attacks and both release encodings by input ID, continuity segment, channel, and MIDI note. Same-note overlaps use FIFO with a visible ambiguity warning; MIDI provides no note-instance identity. Attack-to-key-release duration is derived from precise raw timestamps, never quantized or extended by sustain. Missing releases are described as not observed, not as proof that a key remains held. Pause/resume and input reconnection start new continuity segments without manufacturing releases. Invalid/backward times preserve pairing evidence but have no inferred duration. Unexpected-length/invalid note payloads remain visible as diagnostic events rather than confidently paired notes.

Ordinary Timing Clock (F8) and Active Sensing (FE) rows are hidden only from the musical view and summarized with counts observed throughout the captured session, including evicted messages and excluding paused traffic. Unexpected variants, controllers, pitch bend, pressure, program changes, system/transport messages, and decoder anomalies remain visible. CC64 displays Sustain Down for values >=64 and Up below 64, retaining every original value and repeated message. SysEx permission behavior is unchanged.

**Copy Report** produces a compact plain-text interpretation for manual sharing. Note counts/pairs/durations describe retained evidence only. When raw messages have been dropped, both Musical Events and the report prominently warn that evidence is partial and missing endpoints may have been evicted. **Copy Capture** remains the complete export of retained raw messages and bytes. Clipboard failures provide a selected read-only snapshot of exactly the attempted text; new MIDI does not change that snapshot, while retry copies current evidence. No score, grading, persistence, AI service, or network integration is involved.
