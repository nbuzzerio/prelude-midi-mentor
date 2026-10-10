# Prelude: MIDI Mentor — ARCHITECTURE

> This document describes the current architecture of Prelude and the responsibilities of its major systems. It focuses on how the application is organized today rather than every possible future direction.

## Advisory ocarina fingering (pending 2.9.8)

`instrument-learning/ocarina-fingering.ts` owns twelve immutable logical hole identities and thirteen owner-supplied natural concert-pitch entries in the **Standard 12-hole Alto C — provisional profile**. It derives instructions from covered/open states and offers no invented chromatic mappings. `components/ocarina-fingering.tsx` owns only schematic FRONT/BACK geometry, accessible states, an expected diagram and separate compact live suggestion. Coordinates are independent of logical IDs; manufacturer chart/subhole layout remain unverified. See [OCARINA_FINGERING.md](./OCARINA_FINGERING.md).

The existing session view builds `InstrumentPitchContext` for the configured violin or ocarina only during microphone practice. Expected spelling remains authored; live labels use target/key context, with the same stable/fresh listening predicate. The panel reads no grading history, calibration state, recording controller or stream. The shared `piece-practice-instrument-stage` keeps the prior 1100px companion breakpoint and stacked mobile hierarchy. A 320px body-minimum override applies only while the ocarina guide is present, avoiding classic-scrollbar overflow. Expected guidance is never physical fingering evidence or duration acceptance; capture, calibration policy v3, onset/tolerance/timing, MIDI/VKB, recording, scalar JSON/report/PDF and Run V2/IndexedDB contracts are unchanged.

## Piece Practice presentation cleanup (2.9.7, committed)

The session view uses the existing stateless acoustic-controls component in playing and secondary presentations. Playing renders authoritative measure progress, 64px pitch labels, unchanged live provenance/cents/Hz and essential listening buttons; secondary renders the same recording controls, capture status, Practice Details and analysis/export after the workspace. Preflight retains the combined presentation. No hook/controller/collector moves into a disclosure. Keyboard recording controls also follow the workspace. A shared recording-label helper supports a compact top notice without adding another recording-state announcer or owner; full controls retain the existing announcement and elapsed timer.

The header, acknowledgment reservation and panel gaps are compacted. Expected/Actual precede notation in the left workspace column; the violin companion spans that playing area on the right, bringing the diagram high on laptop screens. Narrow layouts stack that column and the guide. The violin guide brings its enlarged proportional diagram ahead of detailed text/options and caps its height for laptop viewing. String/sticker/alternate controls remain available through a native disclosure. The first-position fractions are unchanged; only linear scale and viewport cropping change. Capture, grading, calibration, recording, MIDI, persistence and export contracts are unchanged.

## Advisory violin fingerboard (2.9.6)

`instrument-pitch-context.ts` supplies immutable expected pitch, live provenance and score-aware labels. Its live selector extracts the existing pitch-panel predicate unchanged: capture listening, stable/fresh reading, nonnegative age through 120 ms. It adds no retained-pitch state. `PiecePracticeSessionView` derives this context from existing targets, current measure spelling and the acoustic owner's snapshot during practice, after violin preflight where applicable. Last graded attempts and confirmed calibration remain separate.

`violin-first-position.ts` contains the owner-supplied 0–7 semitone beginner profile, deterministic open-string-first recommendations, explicit selected-string limitations and proportional string geometry. `ViolinFingerboard` owns only transient string/sticker display choices. Continuous strings have distinct expected/live shapes and textual equivalents, alternatives and honest unavailable states. Live geometry uses current frequency, never a graded attempt, and conservatively suppresses possible target-relative harmonics without changing pitch panels or grading. See [mapping, formula and limitations](./VIOLIN_FINGERBOARD.md).

The existing stage stacks by default and adds a right-hand companion column at 1100 CSS pixels from committed 2.9.7; large playing pitch panels precede notation within its left column. Capture, calibration, recording, analysis/export, grading, MIDI, persistence and reports retain their existing owners and contracts. The provisional ocarina component accepts the same context without introducing a detector.

## Optional Piece Practice performance recording (2.9.4)

### Piano companion recording extension (2.9.5)

`piece-practice-recording-capture.ts` is a feature-local recording-only microphone track owner. Explicit opt-in requests audio-only getUserMedia, with no AudioContext, analyzer, pitch stabilizer or grading observations. It delivers the same ready/ending lease interface as acoustic capture, signals ending synchronously before releasing its own tracks, and never waits for native finalization. Denied/late permission grants, a 30-second startup watchdog, track mute/end, hidden/frozen pages and pagehide release or cancel capture; late grants stop their tracks without publishing a stream. Errors never change MIDI practice state.

`use-piece-practice-keyboard-recording.ts` gives each run one adapter and the existing recording controller in the same effect lifetime. Strict Mode replay constructs fresh owners; stable UI actions consult current refs, and late native events cannot populate a replacement run. The keyboard/MIDI input owner stays mounted across run changes, preserving MIDI connection and input ownership. Recording defaults Off on new/recovered runs. Restart Measure stays continuous; clock pause, interruption and completion finalize/release capture. Clock resume alone never requests permission: the musician explicitly resumes recording. Opt-out finalizes; a later opt-in makes an independent segment.

Both input owners use the existing recording controls and `use-piece-practice-recording-guard.ts`, extracted from the acoustic owner without changing navigation policy. Run replacement, Practice Again, focused Targeted Practice entry/return and App navigation check temporary audio before mutation. Playback is unavailable during capture; a feature-local helper pauses existing recording players before either owner starts capture. Piano segments use piano filenames, room-microphone source and a null analysisSessionId; monotonic offsets are relative to that run's recording-controller lifetime, without invented acoustic analysis or sample-accurate MIDI synchronization. Violin/ocarina analysis IDs and timing retain their existing meaning. No scalar, report/PDF, Run V2 or IndexedDB schema changes.

The feature-local recording controller borrows the stream from shared microphone capture through optional ready/ending callbacks. Capture alone owns and stops tracks. A default-Off opt-in starts native MediaRecorder only in eligible violin or ocarina practice, excluding violin preflight. A capture stop requests recorder finalization before track disposal; final chunks arrive asynchronously. Independently playable segments survive Stop Listening and completion in memory until run departure. Restart Measure remains within the current recording when capture continues; resumed capture starts a new segment. Recording errors and limits leave grading active.

The controller requests roughly 64 kbps and one-second chunks, stops at 20 minutes of cumulative recorded time, and requests stop near 14 MiB of encoded data. The 16 MiB budget is soft: delayed/final chunks may exceed it and are retained with an explicit notice. Browser memory use can exceed encoded bytes. Native WebM, MP4 or Ogg output is named by actual MIME; no MP3 conversion is supplied. Playback is available after listening stops. Run replacement, Piece Practice exit and App mode navigation guard temporary audio before owner cleanup; beforeunload is best effort. Recovered runs have no recorded audio or opt-in. The final note may be truncated by existing pitch/attack completion, with no duration grading. Audio is separate from scalar JSON, reports, Run V2 and IndexedDB.

## Piece Practice feedback presentation (2.9.3)

The session component observes newly appended completed target timings at its existing shared state-update boundary. A private transient acknowledgment carries written-pitch snapshot names, target ID, evidence sequence and a monotonically increasing presentation identity. Its 1.2-second timer is canceled and invalidated on replacement, pause, restart, exit and unmount; it does not postpone grading or input. Recovered evidence is not replayed as newly accepted. Presentation denotes pitch/attack acceptance only, never sustained duration. Current-target notation and piano key highlights remain independent of prior success.

Progress derives from the existing session progress selector; remaining measures are practiced-range count minus completed measures, including the unfinished current measure. Native disclosures affect display only. Shared keyboard/microphone result actions remain outside collapsed evidence; printed and copied reports continue using unchanged evidence selectors and formatters. The acoustic owner/collector is not mounted inside a disclosure. Capture, detector, calibration, tolerance, MIDI, timing, report and persistence contracts were unchanged in 2.9.3. [The recording handoff](./PIECE_PRACTICE_RECORDING_HANDOFF.md) describes the subsequent 2.9.4 feature boundary.

## Instrument learning Stage 1A/1B/1D (2.9.2, provisional)

`features/instrument-learning` owns React-independent calibration contracts, raw log-frequency stability, harmonic ambiguity checks and violin preflight presentation. `features/acoustic-analysis` owns a bounded scalar collector, explicit local On/Off preference and canonical JSON export. Piece Practice's existing acoustic hook owns both transient instances and the sole microphone controller. Shared detector, stabilizer and capture remain unchanged; no global microphone service or additional capture owner exists.

Violin runs (including paused recovery) enter optional preflight before grading/time. G3/D4/A4/E5 use A440 equal temperament. The default beginner policy v3 is designed for short ringing notes: a 50 ms acoustic attack guard, four usable raw estimates spaced at least 25 ms apart, and at least 90 ms of qualifying coverage. Coverage sums adjacent same-candidate observation intervals no longer than 100 ms, excluding quiet/inter-candidate gaps. The robust median uses estimates within 20 cents of the candidate center, P90-P10 spread at most 25 cents, MAD at most 12 cents, and at least 75% agreement among the last eight eligible estimates. Compatible short candidates may combine within three seconds, bounded to 24 observations. Two compatible readings displaced more than 20 cents replace the old candidate rather than mixing a substantial tuning adjustment. Quiet, a callback gap, or a 6 dB level rise starts an acoustic candidate; this is not proof of a physical pluck. Every accepted sample passes the unchanged raw analyzer gates and fundamental/harmonic checks (expected region within 100 cents); repeated ambiguity clears the candidate. No octave folding occurs.

Beginner bands are ideal/excellent within 5 cents, green/ready within 10 cents, yellow/adjust tuning through 25 cents, red/significantly off beyond 25 cents. A complete valid green median commits immediately; the 1.2-second acknowledgment is presentation only. Stop/interruption preserves committed choices and pauses progression. The next string starts with fresh evidence and waits for an observed quiet boundary or new level rise to avoid using the previous ringing tail. The original precise v1 collector remains available through an internal policy argument, retaining its 200 ms settling, 800 ms/20-sample window, spread/drift and 5/15-cent bands; no advanced settings UI is added.

Live calibration display reads fresh usable raw detector estimates independently of the smoothed tracker and calibration collector. A bounded watchdog publishes numbers around 5 Hz; activity and blocker messages have readable holds. Rejected observations retain explicitly historical last-heard values, and last stable assessments are separate. Deviation colors describe estimated tuning, independently of certification. Reserved rows and 50 px notes avoid layout movement; there is no Retry button and plucking is the preferred instruction, with bowing also supported.

The final summary offers Enter Piece Practice. A prominent Skip Calibration and Start Practice bypasses all remaining references, retaining completed choices and marking the rest skipped, with no selected baseline implied. Both entry paths reset onset history/cutoff and require the existing quiet/re-articulation boundary; calibration cannot grade the first target. Existing concert-pitch grading, tolerance presets, mistake evidence and MIDI/VKB ownership remain unchanged. Baseline-relative interpretation is a pure conditional helper requiring a supplied assumed string/provenance; baselines do not change grading targets. No mid-run recalibration UI exists.

Analysis defaults On. Only `prelude-acoustic-analysis-enabled-v1` is stored in localStorage. Calibration and analysis remain in the current acoustic owner through completion, and are lost on owner replacement, navigation or reload; export before Restart Piece/Practice Again/Targeted Practice. V2 checkpoints and IndexedDB version 1 remain unchanged. Ocarina has analysis collection and a separate provisional fingering presentation, with no calibration workflow.

The collector projects allowlisted scalar envelopes into actual-timestamp 100 ms bins, splitting phase/reference/target-visit/pause/capture boundaries. It keeps a ≤4-second/160-observation ring and merges triggered windows (1 second before, 2 after). Reserved high-resolution intervals total at most 60 seconds, with 10 seconds withheld from diagnostic triggers for calibration. Selected calibration raw evidence shares that budget; omitted windows retain summaries with explicit retained sample counts. Duration is capped at 60 minutes, discrete events/attempts at 10,000, and conservative row/event accounting at roughly 16 MiB; that accounting is not a browser heap measurement. Limits preserve collected evidence and stop collection, not practice. No frame writes, JSON serialization or trace arrays flow through React state. The display watchdog runs every 100 ms; calibration presentation publishes at most every 200 ms. Export is explicit and disabled while capture is active.

JSON format `prelude-acoustic-analysis`, schema 1, derives appVersion from package.json. Policy metadata identifies beginner v3 (10-cent acceptance) and includes preserved beginner v2 (20-cent acceptance) and precise v1 definitions. Existing attempts retain their recorded policy version, disposition and tuning classification; they are not reinterpreted. Definitions explain clocks, A440, cents sign, NSDF periodicity, dBFS, retained/smoothed pitch, attack hypotheses, downsampling and missing coverage. Target visits distinguish repeats; session-namespaced capture segments distinguish controller generations. Practice evidence is copied unchanged. Summaries describe confirmed graded attempts only, leaving acquisition/post-acquisition attribution unknown. No raw audio, device identifiers/names, full user agent, unrelated score text or network transmission exists. Effective sample rate/processing remain unknown; capture was not extended merely to obtain optional metadata.

## Acoustic Piece Practice (2.9.0 foundation, provisional)

`src/lib/audio/monophonic` shares implementation, not active capture ownership. Extraction preserves the Tuner's 2048-sample/~30 Hz loop, 120–2300 Hz range, -55 dBFS/0.90 gates, three-observation/80 ms acquisition, 120 ms octave dwell, >100 ms gap reset, 120 ms freshness, 400 ms uncertain retention and decay rules. Capture optionally publishes a frozen scalar envelope: raw observation, stabilized snapshot, monotonic observation time, audio clock and capture generation. No waveform history crosses this boundary. Tuner note spelling and ±5-cent display semantics remain feature-owned.

Piece Practice's pure onset detector receives no target or expected pitch. After initial/history-losing reset it requires at least two advancing quiet observations spanning 50 ms. A raw-frequency candidate needs three observations spanning 80 ms (120 ms for an octave change), stability and a fresh reliable snapshot. Continuous same-pitch sound stays consumed across targets and measure transitions. Qualified quiet rearms; a same-pitch reattack without quiet requires a ≥6 dB local dip plus periodicity loss, recovery within 250 ms, and stable reacquisition. These thresholds are provisional. Uncertainty, clipping, decay, elapsed time and missing/stalled evidence do not manufacture articulation. Candidate tracking uses raw nearest-semitone identity rather than the Tuner's retained label.

An `AcousticAttack` carries source, capture generation, monotonic sequence, onset/confirmation times, fresh frequency, nearest semitone and articulation reason. The hook checks current capture generation and reset cutoff. The dedicated session transition checks target, transient input epoch and consumed attack cursor, then grades the fresh frequency against the authored equal-tempered A440 center. Tolerances are ±15, ±25 default, ±40, or a custom integer 1–49 cents. Unrounded cents determine acceptance; only floating-point boundary error is tolerated. No octave folding occurs. A rejected attack is consumed and records one mistake, even when the player subsequently slides the same sustained note into tolerance.

Eligibility evaluates the focused projection and selected range before permission, including every restart boundary and assessed tie-merged sounding spans. Duplicate unisons, adjacent half-open spans and ordinary tied continuations are allowed; distinct chords, nonempty rolls, overlapping distinct pitches and out-of-range expectations are refused with measure-specific guidance. No acoustic duration or rest grading is introduced. Targetless measures retain explicit Next Measure. Restart Measure and Skip invalidate pending input and require quiet; Restart Piece, Practice Again and focused runs create new owners and require Start Listening.

Exactly one input owner mounts: the existing MIDI/VKB hook or the acoustic hook. The acoustic branch never fabricates MIDI, velocity or release evidence and suppresses success/error tones and the interactive keyboard. The App's existing hosted-session exclusion passes through Staff Builder. Capture stops on completion, exit, background, freeze/pagehide and interruption. Recovery remains paused; foreground return never automatically starts capture. Unavailable capture pauses active timing. The first confirmed attempt arms first-target timing; accepted confirmation ends response timing without speculative backdating or fixed latency compensation. Observation confirmation delay is not measured hardware latency.

V2 stores source configuration and scalar acoustic evidence separately from physical MIDI evidence, with authored spelling, expected/nearest pitch, frequency, signed cents, tolerance, result/reason, articulation, active time and confirmation delay. Screen/copy/print use that evidence; diagnostic counts use the single linked mistake record. V1 keyboard provenance is never retroactively inferred as acoustic. Violin/ocarina labels currently share one detector. Violin preflight and transient analysis are described above; ocarina calibration/manufacturer verification, polyphony and broader device reliability remain future work; see TESTING.md.

## Standalone Chromatic Tuner (Phase 2)

The tuner is an implemented foreground-only App mode with explicit microphone Start/Stop. Tuner presentation and its lifecycle adapter remain under `src/features/tuner`. In 2.9.0, numeric pitch math, direct MPM/NSDF analysis, stabilization and hardened browser capture moved to `src/lib/audio/monophonic`; tuner compatibility adapters preserve existing behavior. Tuner and Piece Practice each instantiate and own an independent capture controller. Production code never imports the ignored `.dev` spike. Its implementation retained version 2.8.6 by owner instruction and changed no dependency, MIDI contract, scoring or persisted practice data. The later [rolling roadmap](./ROADMAP.md) captures instrument-aware evolution separately.

The pipeline is `getUserMedia → owned AudioContext → AnalyserNode → MPM/NSDF → stabilization → display`, using 2048-sample frames sampled about 30 times per second. The source connects only to the analyser, never to speakers. Preferred mono/raw audio constraints are requests; browsers may apply their own processing. Samples and the bounded level history exist only in memory; there is no recording, upload, or microphone device selector.

Pure observations contain frequency (or rejection), signal level, NSDF periodicity and reason. Periodicity is not a probability of correct note identity. Pitch snapshots separately express acquisition, freshness and a briefly retained uncertain pitch. New pitches require at least three observations over 80 ms; octave changes require 120 ms. Poor quality and a level fall of at least 3 dB within the acquisition window remove reliability. Candidate-level decay is also gated. Reliable readings expire after 120 ms and retained pitches clear after 400 ms; missing or frozen audio clocks cannot extend freshness. New evidence after uncertainty requires reacquisition. These provisional gates reduce flicker and decay-related substitutions; they do not solve harmonic/octave ambiguity.

All twelve pitch classes use A4=440 Hz and equal temperament, with the existing no-key chromatic spelling and scientific octave numbering. The initial estimated range is 120–2300 Hz; it is neither an instrument profile nor full audible-range support. The display retains the stabilized semitone identity when calculating actual cents, including near midpoint hysteresis. A ±5-cent display band indicates in-tune only while the reading is stable.

`PracticeSessionBuilder` reports only whether its run status is active via an optional `onActiveRunChange` callback. App passes the inverse to the tuner. Hidden, target-complete and Bonus runs still block capture; summary releases the guard. This does not pause, cancel, reconfigure, or change grading in the hosted engine. The tuner never registers a MIDI consumer. Foreground eligibility is checked before and after asynchronous startup and during sampling. Unmount, hidden document, pagehide/freeze, track interruption or context suspension invalidate startup generations, stop tracks, disconnect nodes, cancel timers and close the owned context. Returning requires explicit Start; late streams are immediately stopped. Mobile presentation uses the ordinary responsive App rather than fullscreen/orientation acquisition.

Desktop synthetic evidence supports main-thread processing provisionally. One successful real violin test is owner-observed limited physical evidence; broader Chromebook/Android and violin/ocarina/sung-voice QA remains pending. Strong harmonics can still cause confident octave mistakes. Other applications and playback tails can contaminate detection. There is no global playback mute or universal input engine. Worker/AudioWorklet capture and additional practice integrations remain separately scoped future work.

The audit correction retains unresolved AudioContext closure in a shared implementation retirement registry across controller unmounts. Tracks, graph connections and session timers are released immediately. Explicit Start/Stop makes one cleanup attempt per retired context, deduplicates an outstanding close promise, and removes ownership only after the context reports closed. Start refuses to allocate another context or request microphone access while retired audio remains open; a later explicit Start can retry once the document is active again. There are no automatic retry timers or status updates from old closure completions. Stop cancels Prelude's pending startup; the browser permission prompt may remain visible. Track mute/end listeners attach immediately after stream ownership, before awaiting activation. Context state listeners distinguish normal initial suspension from interruption or suspension after running.

## Melody

Melody owns a transient seeded authored exercise and projects it through a pure adapter into a read-only Staff Builder display score. Expected attacks feed a feature-local Web Audio clock, continuous MIDI/VKB recorder, timing-led dynamic-programming alignment, and independent Pitch, Movement, and Timing scoring. Web Audio time is authoritative; React/RAF samples it only for presentation.

The display projection prepends a two-quarter-beat preparatory measure used by notation, count guide, and clock scheduling. That lead-in is presentation/timing support: it is not part of the authored exercise and contributes no scored or diagnostic evidence. Results reuse the exact display score. A pure adapter maps expected event IDs to generic `correct`, `missed`, or `wrong-pitch` highlights; these encode Pitch only.

Timed practice stores each completed original attempt as immutable diagnostic evidence under stable trial identity. Session Review derives summaries and review order without rewriting those originals. Repair attempts append to a separate retry history, allowing the UI to compare the original Sight Read with the latest Repair while retaining every retry. Interval analytics aggregate transitions from original results into the Sight Read dataset and retry results into the Repair dataset; neither dataset is persisted beyond the in-memory session.

App-level MidiProvider ownership remains separate from Melody attempt/source locking. Shared piano WAVs are PWA-precached; metronome clicks are oscillator-generated. No Melody exercise, attempt, result, or analytics is persisted.

Melody calls `useMobilePlay` once inside the mounted `MelodySession`. Entering or exiting the focused presentation may occur during setup, audio startup, count-in, performance, results, or Session Review without replacing the generated exercise, AudioContext, performance clock, recorder, first-input-source lock, MIDI consumer, PianoKeyboard, score/count guide, result, or diagnostic history. The existing visibility-interruption policy still cancels an active starting, count-in, or performing attempt when the document becomes hidden; completed timed trials remain available for review. Duration and hold grading are not part of Melody.

---

# Overview

Prelude is a browser-based musicianship application for learning piano through standard notation and real-time input.

The current application provides nine top-level modes/tools: Flashcards, Sequences, Free Play, Ear Training, Melody, Staff Builder, Practice Sessions, MIDI Diagnostic and Chromatic Tuner. Piece Practice launches from Staff Builder; Targeted Practice sits inside its completed results. Current package/application version is 2.9.3, not a release/tag assertion. Together they support:

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
- Practice Session prescriptions, comprehensive reporting/printing and Weekly Practice import
- Score authoring and blocking Piece Practice with durable browser-local run evidence
- Independent raw/musical MIDI diagnostics and standalone microphone tuning

Prelude is currently a frontend-only application built with React and Vite. Ear Training owns melodic interval identification without reusing notation-first practice state machines. Staff Builder owns a separate score-editing domain while reusing shared MIDI, audio, and music primitives.

---

# Design Goals

The architecture follows a few simple principles:

- Keep music logic separate from React UI.
- Keep reusable logic separate from feature-specific state.
- Prefer small focused modules over large components.
- Share authoritative musical data across rendering, playback and validation within its owning domain; preserve distinct feature models and state machines.
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
├── FreeplaySession — live held-note state and ungraded notation
├── EarTrainingSession — aural target, playback and interval-name grading
├── MelodySession — generated score, audio clock, capture and native results
├── StaffBuilderSession — score authoring, local library and playback
│   └── PiecePracticeSession — blocking runs, durable evidence and Targeted Practice
├── PracticeSessionBuilder — prescriptions/import, one hosted native engine and report
├── MidiDiagnostic — independent in-memory Web MIDI inspection
└── TunerSession — feature-local microphone capture, analysis and display

Shared Systems
├── Music Rendering
├── MIDI Input
├── Virtual Piano
├── Audio
└── Feature-specific statistical helpers
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
- a mode-local sustain-pedal shortcut for the existing Play Prompt command
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

`src/main.tsx` registers once before React mounts and passes the platform-owned controller into App. Registration uses `prompt`; generated worker scope, `/prelude/index.html` fallback and piano WAV precaching are unchanged. App mounts `features/app-update` notices alongside existing content without replacing practice owners or the persistently mounted Practice Session host.

The controller exposes immutable snapshots/subscription, discovery, explicit Reload and disposal. Plugin `onNeedRefresh`/`onNeedReload`, native worker state changes and controller changes report availability only; they never navigate. Every Reload request obtains browser confirmation warning about active practice, reports, pending notes and unsaved/in-memory work. A waiting worker activates through the existing plugin function, with state observation and a 30-second failure bound; an already-activated update can reload directly. Only that confirmed request calls `location.reload`, once. No callback retains permission, so cancelled navigation cannot trigger automatic retry. Later collapses to a reachable indicator and remains deferred for duplicate notifications or activation of the same worker.

Registration supplies the initial discovery check. Online/foreground events check at most once per minute; an hourly timer exists only while visible and online. Concurrent checks are deduplicated and failures do not interrupt the app. Disposal removes Prelude-owned listeners/timers and cancels pending activation; React subscriptions clean up independently. This boot-owned controller is not a global dirty-state, save or recovery framework.

`app-updates.ts` owns bundled curated product records with stable ID, increasing sequence, title, date, optional version and change bullets. Records are unrelated to runtime Git history. `prelude-app-updates-last-seen-v1` stores validated ID/sequence in localStorage. Known history selects all newer records newest first; missing/malformed/unknown/pruned history selects only newest. A well-formed future sequence suppresses older notes. Acknowledgment re-reads storage and preserves the same acknowledged record or a newer-sequence marker. Storage failure still permits current-visit dismissal without claiming durability. What's New is a startup snapshot, not a modal opened by a worker event during practice. Got it, Close and Escape acknowledge; opening/backdrop clicks do not. The native modal supplies background inertness, with heading focus, contained keyboard navigation and focus restoration.

Worker activation is shared across tabs; reload permission is local to each tab. Other tabs retain their pages and can choose Reload after external activation. This does not retain every superseded cached asset indefinitely. Legacy 2.8.7 pages still have auto-update callbacks and cannot acquire new protection remotely: the first prompt worker may wait for old clients to close, and legacy clients may still reload if it activates. First-transition and two-build installed/device checks are documented in TESTING/RELEASING and remain separate from deterministic validation.

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

`EarTrainingSession` composes the feature's settings, target, prompt, attempt, shared MIDI-consumer, and Mobile Play hooks, then renders the normal or Mobile Play presentation. `useEarTrainingTarget` owns stable target generation and locking. `useEarTrainingPrompt` owns prompt playback state, playback cancellation, and response timing. `useEarTrainingAttempt` owns grading, feedback, statistics, and delayed advancement. The session maps a normalized sustain-pedal down edge to the same guarded Play Prompt command as the button; pedal-up only rearms the shared MIDI edge detector, and playing, feedback, completion, unmount, and inactive-engine states cannot bypass the command's existing availability rules. Answers remain disabled until successful prompt completion, replays preserve target notes and response timing, and a correct answer advances without autoplaying the next target.

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

Staff Builder is a feature-owned, learning-focused score editor. It creates local practice material without turning Prelude into a professional notation editor or merging score authoring with future Guided Studies. Study View is score presentation, not a Guided Study.

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

These boundaries live inside `src/features/staff-builder`; they do not turn Flashcards, Sequences, Free Play, Ear Training, or future Guided Studies into one state machine.

## Application-Owned Score Model

Staff Builder score data is independent of VexFlow. The canonical model is `StaffBuilderScoreV4`; `StaffBuilderScore` aliases that current form. Measures contain authoritative note/chord/rest events with staff, onset, and rhythm. Notes retain explicitly spelled pitches, ties are explicit pitch-endpoint relationships, and effective key/time context is resolved from initial settings and measure overrides. A valid tie joins same-staff pitches with the same MIDI number when the source's absolute sounding end exactly equals the later destination onset. Written enharmonic spelling is independent, so a tie does not respell either endpoint. Every pitch endpoint, including each member of a chord, may independently carry at most one incoming and at most one outgoing edge; having one direction never suppresses authoring the other, allowing middle nodes in long chains. Branching and cycles are invalid. A note event may carry `arpeggiation?: "up"` only when it contains at least two pitches. Tempo and variable measure capacities remain score-domain facts.

When a selected authored pitch has supported enharmonic alternatives, Rhythm Correction exposes an always-visible, per-pitch Enharmonic Spelling control. It delegates to the existing pitch-ID respelling mutation and stores the chosen letter, accidental, and octave without changing MIDI identity. Explicit spelling survives key changes and ordinary score persistence; newly captured notes continue using key-aware initial spelling. Piece Practice grades MIDI identity while presenting the authored spelling, and ties may retain different written spellings at equal-MIDI endpoints. No spelling preference or schema field is involved.

The persistence schema validates stored data at the browser-storage boundary. Supported score schemas v1/v2/v3 normalize into canonical v4. Legacy v1 receives empty annotations; v1/v2 have no authored arpeggiation; v3/v4 preserve optional upward arpeggiation. Legacy display clefs default to upper Treble/lower Bass. Supported library and draft envelopes likewise return canonical v4 scores. The local-storage keys retain historical `-v1` names for compatibility. Those key names are not schema declarations and must not be casually renamed when the score schema changes.

The same schema boundary validates imported `.prelude.json` files, which contain one authoritative score rather than a library envelope, draft, history, or practice state. On an imported top-level score-ID collision, the library creates a new score ID and timestamp without rewriting score-local measure, event, pitch, tie, or annotation identities. Full-piece duplication creates fresh score-local identities throughout the copy; treble- and bass-range copies also filter material to the requested range and remove invalid cross-copy relationships. No duplication operation mutates the source. Renderer geometry and transient UI state are never persisted as musical score data.

Same-staff rhythmic voices are deterministic derived state, not persisted score identity. Validation partitions authoritative half-open event intervals into the minimum non-overlapping voice count while checking completeness through staff-wide union coverage. The notation projection renders those voices with invisible, noninteractive gap tickables; playback, ties, editing, persistence, and practice continue to address authoritative event and pitch IDs rather than voice numbers.

## Capture Notes, Rhythm Correction, and Lyric Cues

Capture Notes, Rhythm Correction, and Lyric Cues are separate workflows over one score. Lyric Cues shares Capture's cursor and step duration, resolves treble note/chord events at the exact onset, and uses the existing annotation and score-history boundaries. Blank commits remove an existing cue or advance without authoring; ambiguous same-onset events require the existing selection or an explicit choice.

Measure deletion is an immutable score-domain mutation. It retains at least one measure, removes ties and annotations whose endpoints or anchors were deleted, preserves all surviving identities, and is recorded by ordinary score history.

Study View printing uses browser-native printing over a print-only multi-system wrapper. Pure one-based range parsing selects original score measure indices, disconnected runs begin new systems, and the full score remains available to tie projection so selected boundaries retain partial ties. Print CSS keeps systems intact and excludes interactive annotation markers and editor chrome while retaining lyric cues.

Capture Notes is optimized for first-week transcription: MIDI or virtual-keyboard pitches are previewed, routed to grand/treble/bass input, and committed at a rhythmic cursor. Newly captured notes retain the beginner default of final quarter-note duration. Step Duration controls cursor advancement and the exact duration of an intentionally inserted rest.

Rhythm Correction selects authoritative events and supports duration changes, note/rest conversion, staff reassignment, spelling, ties, and deletion. It retains detailed explicit controls as a fallback even when the same operation is available directly from the score.

Selecting a note/chord exposes an ordinary Ties group without opening detailed Rhythm Correction controls. A single note's pitch is selected initially; chords retain individual pitch checkboxes. Tie In/Tie Out use the existing adjacent same-pitch, same-staff candidates within or across measures. Unavailable actions remain visible with compatibility guidance. The separate collapsed Split across a barline tool changes overflowing duration and creates/reuses continuation notation; ordinary ties connect already-authored events without changing rhythm. This presentation change leaves schema v4, tie validation, sounding spans and Piece Practice continuation semantics unchanged.

History is score history, not a universal command log. Rhythm and context mutations record reversible score snapshots. Capture score mutations intentionally clear stale Rhythm history when replaying it would conflict with the newly captured score.

## Rendering and Direct Score Interaction

VexFlow renders decorative notation. Its SVG remains hidden from assistive technology and is not queried for editor behavior. The Staff Builder renderer instead returns public render-only geometry for rendered and authoritative events, rhythmic timeline positions, and notation controls covering the clefs, grand-staff region, key signature, and time signature. Playback-follow geometry is derived from the public rhythmic-position geometry rather than a separate renderer-owned playback-anchor family.

Editor measures and multi-system Study View use one deterministic, range-aware vertical geometry policy. The policy derives diatonic stave position from each authored written letter and octave, reserves only the additional top or bottom space needed for noteheads, ledger lines, stems, accidentals, and ties, then shifts staves and expands the SVG coordinate space together. Ordinary-range notation retains its compact baseline height. Piece Practice receives the same behavior through its shared `StaffBuilderScoreView`; score data and schema remain unchanged.

Piece Practice reconstructs its read-only display score with authored tie endpoints retained across hidden measures. The shared single-measure notation projection renders complete ties when both endpoints are visible and standard VexFlow partial ties when only an incoming or outgoing endpoint is visible; a middle chain pitch renders both segments independently. These boundary ties are notation-only presentation derived from authored relationships. They do not change grading targets, practice boundary reattacks, or sounding-span semantics.

Lyric Cue is an optional schema-v3 annotation attached to one authored treble note event. It renders as small plain text in a dedicated lane above the treble staff in the editor, Study View, and Piece Practice. The lane reserves vertical space only on measures or systems containing visible cues and composes with range-aware note geometry. Existing annotation persistence, history, import/export, recovery, and duplication own the data; Piece Practice carries lyric-cue annotation data through projection, and `createPiecePracticeDisplayScore` reconstructs detached annotation arrays, objects, and nested anchors for its read-only display score without changing lyric meaning or rendering. Lyric cues have no grading, playback, timing, tie, or sounding-span meaning and do not implement vocal engraving, syllable, melisma, hyphenation, or verse semantics.

Automatic beams are derived engraving output in the shared Staff Builder notation layer. Each derived render voice partitions authored eighth-, dotted-eighth-, and sixteenth-note runs by absolute meter group (quarter-note beats in simple meters and dotted-quarter beats in 6/8), real rests, non-beamable durations, and genuine rhythmic gaps before delegating drawing to VexFlow. GhostNote spacers remain in the VexFlow Voice for alignment but are excluded from beam input, so leading layout space does not suppress a valid run. Beams never enter score data, and editor, Study View, and Piece Practice inherit the same rendering behavior without a schema change.

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

The playback projection derives one half-open sounding span for each attack-origin pitch and follows contiguous outgoing tie segments through the chain. Playback attacks only the origin, sustains through the final endpoint, preserves cycle guards, and clips the span to measure/from-position scopes. The playback scheduler exposes its authoritative time origin. Staff Builder samples that clock to display the current measure and a sliding score highlight. Visualization does not schedule audio, and playback-follow measure display is ephemeral: it does not move the Capture cursor or Rhythm selection.

## Persistence, Validation, and Save

Staff Builder remains frontend-only. Draft autosave continuously preserves work and editor position in local browser storage. Validated Save has a distinct product meaning: the score has passed structural validation and is ready for later playback or use. Guided correction mode provides learner-facing fixes such as exact overflow durations and atomic gap filling without conflating validation with input collection.

Staff Builder also owns a browser-local `sustainPedalLocksInput` authoring preference, stored separately from scores, drafts, and piece files. When enabled in Capture Notes, the existing active MIDI consumer maps a normalized CC64 pedal-down edge to the same `editor.lockAndContinue` action as the Lock button: valid pending input commits and advances, empty input advances, and invalid pending input does nothing. Pedal-up, repeated down values while held, and enabling the preference while already down do not trigger authoring. This workflow preference does not add pedal data to the score and does not change the score schema.

Saved library pieces can be downloaded individually as human-readable `.prelude.json` score files and imported later. Import requires schema validity but intentionally permits structurally incomplete musical content so it can be repaired through the normal editor; existing structural validation continues to control Piece Practice eligibility.

The browser-local library envelope is schema v4. It stores authored score objects separately from a piece-ID-keyed `lastPracticedAt` metadata map. Older library envelopes migrate with an empty map rather than fabricated usage evidence. A successful Staff Builder session projection into Piece Practice records the timestamp once; opening, studying, editing, printing, downloading, and sorting do not. The metadata is library-local, so score-file export/import excludes it and a duplicate starts without inherited practice history. Piece Library ordering is derived without mutating storage: Recently Played is the default, with practiced pieces newest first and never-played pieces following in Recently Updated/title/ID order; Recently Updated and human-friendly Alphabetical are also available.

## Responsive Presentation

Responsive score scaling, compact controls, and the mobile virtual-keyboard bottom sheet are presentations over the same authoritative editor state. Exactly one virtual-keyboard presentation is active at a time. Safe-area and viewport handling belong to the presentation layer; they do not create a mobile-specific score or Capture state machine.

## Blocking Piece Practice

Blocking Piece Practice is a Sequence-adjacent feature with its own domain under `src/features/piece-practice`; it does not use `SequenceTarget` or Sequence session state. Its launch path is:

```text
saved StaffBuilderScoreV4
  -> Staff Builder structural validation
  -> transient Piece Practice projection
  -> blocking session state
  -> stable MIDI/VKB input owner
  -> read-only StaffBuilderScoreView
```

Staff Builder remains the sole persisted score authority. A launch projects a stable in-memory snapshot containing source measure/event/pitch identity, staff, onset, duration, written spelling, rests, and ties. The session-owned launch boundary records only the library-local `lastPracticedAt` usage timestamp; the Piece Practice projection and session do not write musical content or attempt history back to the library or convert anything into Sequence storage. Exiting unmounts the session and returns to the existing Staff Builder library; a later launch reads the latest saved score.

The active Staff Builder editor exposes `Practice Piece` through that same session-owned projection and `PiecePracticeSession` launch boundary. Editor launch readiness requires no structural issues or pending capture, healthy persistence, and exact authored-score equivalence with the session's last successfully validated saved snapshot. Opening a structurally valid persisted library piece establishes that exact library object as the baseline; restoring a recovery draft and creating a new piece do not. A successful validated library write replaces the baseline, while a failed save leaves it unchanged. Draft autosave and `activeSavedPieceId` alone do not establish readiness. The comparison includes all practiced notation and annotations while excluding timestamps and editor-only state, so an edit disables launch and an exact Undo can restore it. Practice Piece never saves or clears editor state.

Targets describe score positions grouped by measure and onset across both staves. Sustained pitches are not repeated at later attacks, incoming tied pitches are retained as source metadata but excluded from ordinary full-run attacks, and simultaneous duplicate sounding pitches require one physical MIDI pitch while retaining all source identities. Pure score-domain sounding spans identify every attack origin and the final end reached through its tie chain. A tied or otherwise sustained pitch is an allowed held pitch at every later target onset strictly inside that span. Rests and continuation-only tie positions remain visible source events but create no answer target.

Each score-position target owns a set of checks. All non-arpeggiated attacked pitches at that onset form at most one aggregated normal check. Every authored upward arpeggiated chord forms its own independent rolled check, even when normal notes or another roll share the onset. A rolled check with no required attacks, created by a fully tied continuation beside another attack, is already satisfied in session state. Projection IDs/counts remain unchanged for V1 checkpoint compatibility. Recovery resolves legacy empty checks without reattacking tied pitches; a formerly blocked run whose real checks already completed advances at its saved active time and writes a new completed revision through the existing save acknowledgement. Nonempty partially tied rolls retain their required pitches. The target advances only after all checks complete; an incorrect attempt leaves the unresolved checks available for retry. Completed measures advance in domain state, while measures without attacks require explicit acknowledgement because Piece Practice has no continuous timing engine. A transient session range retains an original start index and an optional inclusive original end index; a null end continues through the piece. Progression stops after the effective end without slicing the full-piece projection, so score IDs, measure numbering, effective context, lyrics, partial boundary ties, and incoming-boundary reattack semantics remain authoritative. Practice Again retains the range while resetting attempt evidence.

The session records one per-measure count through the same pure transition helper that increments the aggregate incorrect-attempt count for failed normal attempts, rejected rolled pitches, and expired rolled checks. Completion derives authored-order measure results from those counts; clean measures receive an explicit textual status. This evidence belongs to the practice run and is retained in browser-local IndexedDB run checkpoints. It never enters the Staff Builder score, score-file schema, mastery history, or a second grading system. Restart Measure retains accumulated mistakes, while Practice Again clears them.

Piece Practice also exposes a transient `Skip Target` escape hatch for an authored onset target. The pure session transition advances through the same target/measure completion path without grading, incrementing `completedTargetCount`, or changing the projected score; it increments only the run-local `skippedTargetCount`. The input owner clears chord collection, rolled-check progress, virtual selection, and feedback before publishing the transition. Boundary-only practice reattacks and targetless measures are not skippable, while a boundary reattack merged with an authored onset is skipped once as that authored target. Restart Measure retains the run-level skip count consistently with mistakes, and Restart Piece resets it.

One mounted Piece Practice input hook consumes the app-level MIDI provider and owns the shared 225 millisecond chord collector for ordinary physical block chords. Authored rolled checks instead collect unique required pitches in any attack order within a tempo-relative window equal to 1.5 quarter-note beats; direction and spacing are not graded. Physical attacks and persistent virtual-keyboard selections never merge. The input owner retains the grading source across ordinary-check completion and discards incomplete roll collection when a relevant attack changes source. Completed parallel checks and physical evidence remain intact. Already due roll timeouts are recorded before collection is reset; the new source starts its window with its first required pitch. Optional Staff Focus input does not change collection ownership. Held pitches are supplied separately from attacks; authored sounding spans and the existing same-onset rolled-check allowance remain independent reasons to allow them. Held pitches never satisfy required attacks. Starting at a measure, or restarting that measure, creates a practice-only boundary attack for any tie continuation inherited from before that measure. Advancing normally from the preceding measure creates no continuation attack. Restart Piece reapplies the same rule at that run's configured start measure. The projection and displayed authored tie remain unchanged. Responsive and explicit Mobile Play presentations reuse this one owner and never duplicate session state or keyboard instances.

Piece Practice additionally allows bounded physical release overlap from the immediately preceding entirely successful MIDI target. Its input-owned transition records the successor target ID, predecessor authored pitches, the subset still physically held at success, and the successor's first physical attack timestamp. `PIECE_PRACTICE_RELEASE_OVERLAP_GRACE_MS = 250` is an initial empirical policy, not articulation grading. The deadline starts at the current target's first physical attack, not predecessor completion, and never renews on retries, chord attacks, held snapshots, releases, or timer callbacks. Normal singles accept immediately and are never retrospectively revoked. A block attempt evaluates eligibility using its actual attack timestamps rather than callback delivery time; attacks inside the original grace remain eligible even if the collection callback arrives late, while attacks/retries outside it do not. Only the immediately preceding target can qualify, so an older held pitch becomes unexpected at the next observation unless independently authorized by the score. Newly attacked extra pitches always fail, including a predecessor pitch. Partial check success does not establish a predecessor; rolled-check completion can establish one once the entire target succeeds. Skip, input reset/restart, session/excerpt reset, pause/resume, and connection boundaries clear transition eligibility. Releasing a pitch removes its physical eligibility and cannot reauthorize it.

Physical MIDI held state remains a pitch-only Set shared across inputs and channels: repeated On/On/Off/Off messages produce two attacks but the first release removes that pitch entirely. The overlap policy does not distinguish note instances or add reference counts. CC64 is separate from the physical Set and never extends key-down state for grading. The shared adapter now optionally forwards real normalized release observations, preserving Note Off versus zero-velocity Note On encoding, conventional release velocity, and finite browser event timestamps. Attack callbacks optionally carry the same source timestamp; existing attack association, MIDI number, velocity, and active-session timestamp are retained. Piece Practice records releases as independent transient observations without pairing instances or inferring acoustic duration. Disconnect, teardown, and held-state clearing do not synthesize release evidence. Neither source timing, releases, nor velocity assesses articulation or dynamics.

One Piece Practice pitch-presentation resolver uses authored expected spelling first, identified predecessor spelling second, the effective measure key through the existing key-aware music helper third, and the existing canonical note helper when context is unavailable. Unrelated occurrences elsewhere in the score are never used to guess spelling. Live feedback, completed mistakes, Copy Report, and browser print/PDF use note name plus octave first. The results-owned `Show MIDI details` checkbox defaults off and adds exact numeric MIDI values to completed results and copied/printed reports; it is independent of `Include MIDI attack strength`. Both options change presentation only. Raw numeric grading/evidence stays intact, and score schemas and persisted authored data are unchanged.

Piece Practice assessment focus is a run-specific `both`/`upper`/`lower` value recorded in the session and its practice projection; the default is Both Staves. Upper and Lower refer to semantic `treble` and `bass` staff identity, regardless of display clef, register, hand, or musical role. Focused projection filters authored attacked pitches and checks before grading while retaining all source events, sounding spans, and notation context. Unassessed-only onsets create no target; leading measures with no assessed attacks keep the first-target response timer unarmed. The same semantic filter limits practice-only boundary reattacks. A simultaneous MIDI pitch on both staves needs only one physical attack for the focused occurrence; required pitches always win classification. Both Staves keeps strict grading. Focused input permits exact unassessed semantic-staff sounding spans at the current assessed target tick; other unexpected pitches are relevant at or above the lowest upper target pitch minus three semitones, or at or below the highest lower target pitch plus three semitones. Optional context stays observable as physical evidence but cannot arm timing, enter block/roll collection, or advance grading. Environmental held-state allowances and predecessor-release grace remain separate from new attacks. The score view renders both staves, ghosting only the unassessed semantic staff at readable opacity, while print notation stays full contrast and all reports name the run's assessment focus. Restarts preserve focus; changing it requires a new run. No Staff Builder score schema or persistence is changed.

Narrow or coarse-pointer detection remains Staff Builder editor presentation state; it no longer automatically places Piece Practice into a fixed Mobile Play layout. After `Start Practice`, the active Piece Practice session calls `useMobilePlay` once and exposes an explicit entry action. Ordinary narrow Piece Practice remains in normal document flow.

Entering or exiting Mobile Play preserves the current piece, configured range, measure, target, blocking attempt and per-measure mistake state, original session timing, pending physical chord collector, persistent virtual chord selection, MIDI owner, and PianoKeyboard. `Exit Mobile Play` leaves only the focused presentation; `Exit Piece Practice` retains its separate behavior of returning to Staff Builder. Restart Measure and Restart Piece retain their domain semantics, targetless measures still require explicit `Next Measure`, and the scrollable Piece Practice completion summary may remain in Mobile Play until explicit exit. Staff Builder editor responsive ownership is unchanged.

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

Audio responsibilities remain separate rather than sharing a universal audio bus.

**Interface feedback**

- success sounds
- incorrect sounds

**Instrument playback**

- piano samples
- virtual key playback
- chord playback

Melody additionally owns its performance/count-in/metronome clock. The tuner owns microphone capture and analysis without speaker monitoring. Shared musical-event playback is reused where appropriate; instrument sound libraries and microphone analysis are different capabilities.

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

`MidiProvider` remains mounted above top-level mode switching. It shares connection status, device identity, errors, and `connectMidi()` without requesting permission on page load. A token-safe active-consumer registration routes new note attacks, held-note snapshots and normalized CC64 sustain edges to the most recently registered feature consumer. Registration is token-safe, not a visibility-aware consumer stack; a hosted Practice Session may remain mounted while hidden. The tuner's active-run guard handles that capture exclusion without redesigning MIDI ownership. Ear Training intentionally consumes only the sustain edge for Play Prompt; note attacks remain ungraded. Switching through a feature with no MIDI consumer leaves the physical connection and held state alive without grading attacks.

Feature adapters retain all musical behavior. Flashcards, Sequences, and Piece Practice keep their own chord collectors and grading; Staff Builder keeps Capture semantics; Free Play consumes held-note snapshots. An already-held key is published as held environmental state after a mode switch but is never replayed as a new attack.

---

# Isolated / Ordered Practice Runtime Flow

This loop describes Flashcard/Sequence target progression. Free Play, Melody, Staff Builder, diagnostics and tuning retain their different native lifecycles.

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

## Intended Studies and Acoustic Boundaries (Conceptual)

Guided Studies are not implemented. They are intended to own explanation, demonstration, experiment, repetition, comparison and reflection, using explicit native launch/completion/return contracts. Feature domains retain rendering, timing, input, grading, persistence, notation, playback and evidence. Practice Sessions already compose four native engines; their prescriptions and curriculum metadata are not a Study engine. Staff Builder Study View is score presentation. No universal lesson model or mastery score is planned to replace native domains.

Continuous / Flow Sight-Reading has a foundation in Melody's clock, continuous capture, alignment, notation, scoring and nonblocking performance. Sustained reading beyond short trials remains future product work. Authored Piece Practice continuous performance is related but distinct; neither requires a universal grading engine.

The intended audio separation is conceptual:

```text
AudioSource → MonophonicPitchAnalyzer → normalized pitch observation → consumer
AudioSource → future PolyphonicAnalyzer → chord / multi-note observations
```

Tuner and Acoustic Piece Practice now reuse `src/lib/audio/monophonic` with independently owned controllers. The retirement registry tracks unfinished AudioContext closure across owners; it is not an active stream or event bus. There is no global AudioSource service, universal microphone bus or polyphonic analyzer. Thread/transport expansion depends on measured device problems. Future consumers may include instrument diagrams, acoustic Free Play, scales and Studies, but acoustic adapters must define acceptance, acquisition, freshness, repeated-pitch rearming, uncertainty, timing and octave handling per activity. Pitch coordinates are not MIDI attacks/releases.

Instrument mapping/presentation should accept a detected or target pitch independently of capture. Begin with bounded guidance in the existing tuner. Violin guidance uses standard G–D–A–E and first-position recommendations/alternates; it cannot identify the string/fingering actually used. Ocarina requires an identified profile/system/chart; voice means sung pitch. Polyphonic guitar/piano recognition must not be routed through monophonic assumptions.

See [ROADMAP.md](./ROADMAP.md) for priorities and deferred product choices; these paragraphs describe intended boundaries, not newly implemented services or contracts.

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

Sequence config retains settings for all four subtypes so switching subtypes preserves existing selections. Every selection group remains valid, including inactive groups. Progression compatibility preserves the existing rule that at least one selected key/template pair is compatible; incompatible cross-products are not newly forbidden. SequenceConfig version 2 adds scalePracticeMode and an ordered scaleRepertoire array. The default remains Intervals, with Random selected for scale practice and an empty repertoire. Version 1 Sequence configs are explicitly unsupported; the original config change preceded persisted presets. Current libraries store version-2 Sequence configs. The structural parser takes the feature's expected version, defaulting to version 1 for unchanged features.

Piece Practice owns diagnostic evidence in its session domain and persists it in browser-local practice runs. Chronological mistake evidence is the authoritative mistake truth; aggregate and authored-measure counts are derived from it. The same active-time clock records accumulated measure time and final-success target response time, pauses while the document is hidden, and freezes at completion. The first assessable target of each started or restarted practice range has an unarmed response timer until its first physical MIDI Note On or virtual-keyboard attempt, including a wrong attempt. Leading no-attack measures preserve that exception. Later targets start response timing on activation as before; skipping the unarmed first target records an explicit not-timed basis and consumes the exception. Hesitation is a non-rhythmic practice signal derived from tempo-relative opportunity windows with named forgiving thresholds. Skips remain independent problem signals. None of this evidence is written into the Staff Builder score schema; versioned practice-run checkpoints retain it separately in IndexedDB.

Practice diagnostic shorthand is a shared presentation vocabulary derived by feature-local selectors from that feature's authoritative evidence. `Pitch`, `Identification`, and `Hesitation` summarize concrete problem or diagnostic evidence; `Retried` and `Skipped` describe practice-process events. Melody additionally presents neutral numeric Pitch, Movement, and Timing metrics without thresholds. The shared chip model distinguishes Pitch problem evidence from the Melody Pitch metric through semantic kind, stable identity, and accessible text. It owns no grading, evidence contract, persistence, mastery, or cross-engine accuracy, and expanded views retain engine-native Missing, Extra, wrong-pitch, incorrect-attempt/guess, slow-response, and Sight Read/Repair language.

Staff Builder notation rendering publishes additive event and pitch geometry anchors. Piece Practice uses those anchors for red mistake and amber hesitation overlays while preserving the existing event-anchor contract used by Melody and editing interactions. Completed-attempt reports reuse Staff Builder score projection, fitted print layout, pagination, and browser printing; no PDF library or alternate notation renderer is used.

MelodyConfig composes existing MelodySettings with static Continuous Practice options. Conversion to MelodySettings excludes those timed options. Active deadlines, recordings, results, and diagnostic history remain session-owned. MelodySettingsControls renders controlled generation fields; optional MelodyPracticeOptions composes timed setup controls in the existing fieldset. Neither mounts an exercise engine. Existing Flashcard, Sequence, and Ear Training controls omit Reset Session when no reset callback is provided; standalone sessions continue supplying it.

These boundaries support configuration editors and Practice Session prescriptions without moving feature settings into the host. Standalone Flashcard/Sequence launches retain fixed starter targets; supplied configurations use the configured-launch boundary below. MIDI, audio, Mobile Play, grading, target regeneration, and reset ownership are unchanged.


### Configured launch and native completion

FlashcardSession, SequenceSession, and EarTrainingSession accept optional `initialConfig` and `onPracticeUnitCompleted?: () => void` props. The config is consumed at mount: it initializes the settings and the first target, not a live controlled configuration. Equivalent or changed initial props do not overwrite edits or restart the current target. A host must remount (for example, with a new React key) to launch another prescription, including consecutive entries using the same engine.

For a configured Flashcard or Sequence launch, the target hook's lazy state initializer calls the existing generator with the initialized settings. No default target is presented and then replaced in an effect. Configured response timing starts at initialization; no-config launches retain the fixed starters and their existing zero initial timestamp. Ear Training already generates lazily from its settings; supplying initialConfig now reaches that path. Its settings effect compares settings identity so Strict Mode effect replay does not regenerate the initial prompt. Initializer checks in development Strict Mode may generate discarded candidates, but do not emit completion or present the standalone starter.

The optional notification has no payload: it means one native unit completed. Flashcards emits after successfully locking a correctly answered note or triad target. Sequences emits at the guarded final-step boundary for intervals, random scales, arpeggios, and progressions. A whole ascending-descending generated sequence is one unit. Ear Training emits after successfully locking an eventually correctly identified prompt, even if earlier guesses were wrong. Partial input, incorrect attempts, replay, target generation, settings changes, and Reset Session do not emit completion. No statistic or DOM value is polled.

Notifications run synchronously from the authoritative success handler, after scheduling existing transitions, and outside React state updaters/effects. Existing target locks prevent repeated input from notifying twice. Flashcard virtual triad selection uses a ref alongside display state so grading and host notification happen in the input handler, including rapid input and Strict Mode. Callback changes update handlers without regenerating targets. Unmount cleanup retains existing transition and MIDI ownership; the host remains responsible for its own run identity.

Ear Training still requires the explicit prompt-play action and never autoplays on configured launch or advancement. These engine contracts do not themselves own host presentation, persistence, or progress targets; Practice Session composes them at its own boundary. Melody has a distinct timed-target contract described below.


### Scale Repertoire

Scale practice supports Random, Repertoire - In Order, and Repertoire - Shuffle within the existing Sequence feature. Random retains its existing forms, directions, starting-note categories, and clef range. Repertoire hides the random-only filters, keeps clef selection, and exposes the catalog plus an explicitly ordered selection with Move Up, Move Down, and Remove controls. Catalog grouping does not constrain the user's traversal order.

`src/features/sequences/scale-repertoire.ts` owns catalog identity, realization, and finite traversal. Catalog IDs retain written tonic and form (for example `c-sharp-melodic-minor`), without using or expanding MusicKeyId. The 28 visible entries comprise C/D/E/F/G/A/B major and each relative natural, harmonic, and melodic minor. G-sharp harmonic and melodic minor remain visible but disabled with an accessible, visible double-accidental explanation. G-sharp natural minor is selectable. Config parsing rejects disabled entries, unknown identities, and duplicates rather than respelling or dropping them.

Every repertoire scale is one octave ascending and descending, with the top tonic once: exactly 15 single-note steps, one completed scale, no repetition multiplier. Realization calls the same scale-pattern function used by Random and supplies an explicit root letter. Classical melodic minor raises sixth/seventh ascending and uses natural minor descending; harmonic minor raises the seventh in both directions. Register is the lowest eligible written tonic in the existing clef range (C4 for treble C major); mixed clef retains existing clef selection. All 26 selectable entries are tested in both clefs without double accidentals.

SequenceConfig's scaleRepertoire is an ordered array of catalog IDs, detached at parser and runtime conversion boundaries. Empty selection is valid setup data, not a playable traversal: the session shows a selection prompt, hides notation/keyboard, and blocks grading. It never falls back to Random. Selecting the first scale starts the configured repertoire through the existing settings-change lifecycle.

A traversal holds one ordered permutation and a completed-entry count. Only the guarded musical success boundary advances it; retry or target regeneration does not. In Order uses the selected order. Shuffle uses one Fisher-Yates permutation without replacement. Completing the last scale emits `onScaleRepertoireCompleted?: () => void` once, in addition to that scale's existing `onPracticeUnitCompleted` notification. Completion state is visible inside the existing Sequence card, preserving the notation/keyboard stage layout. After the normal completion delay, continued standalone play starts another cycle (a new shuffle for Shuffle). Practice Session uses the explicit traversal callback as its authoritative completion boundary.

Reset Session creates a new traversal, resets statistics as before, and starts its first entry. Selection/order/mode/clef changes restart traversal and preserve statistics, matching existing settings behavior. None emits completion. Supplied repertoire initialConfig generates its first repertoire target in the lazy initializer; no interval or Random target is shown first. Changing initialConfig after mount still does not restart the engine. MIDI, validation, notation, feedback, and keyboard input use the existing Sequence engine; Practice Session stores the config snapshot and composes its completion signals without changing those behaviors.


### Melody configured launch and timed target completion

`MelodySession` accepts `initialConfig?: MelodyConfig`. The existing version-1 parser validates a detached mount snapshot; generation settings and continuous-practice options initialize from that snapshot. The first phrase is generated in the lazy initializer from those settings, without a default phrase replacement effect. Prop changes do not override edits or restart the mounted engine. Without a config, standalone defaults are unchanged. Start remains explicit; configured launch does not create audio or start a deadline.

`onPracticeTargetReached?: () => void` reports timed achievement, not a phrase count. Melody retains its existing clock and deadline authority: the deadline begins at the first successful count-in, and expiration during count-in/performance waits for the phrase's normal evaluation. Expiration on results settles directly into existing Review. Both paths latch achievement, retain final original result/history, and deliver the notification in an effect after that state commits. The notified run is marked before calling the host, allowing immediate continuation or parent replacement. No statistics are polled. Callback changes do not re-notify; run identity, disposed interval guards, and existing attempt cancellation protect reset/unmount boundaries.

The optional React ref exposes `MelodySessionHandle.continuePractice(): boolean`, a runtime action only. From settled, achieved Review it resumes continuous practice with a fresh phrase using current generation settings and the existing count-in/recorder/grader. Normal results and Try Another (including the existing pedal action) support further phrases without host intervention; the expired countdown is no longer displayed. It returns false before achievement, during an active attempt, or after unmount. Repeated calls before rerender cannot start multiple attempts. The original target remains achieved; continuation neither creates another deadline nor emits another target notification. If the existing interruption/review lifecycle returns to Review, the action can resume again with history retained. No continuation button is added to standalone Melody.

Continuation preserves all immutable original results and retry histories. Fresh generated phrases append original diagnostic trials through the existing diagnostic branch; Review retries still append Repair evidence to their original trial through the separate review-retry branch. Review filters and Sight Read/Repair analytics remain Melody-owned. Returning to Settings clears the run as before; New Timed Session starts a genuinely new history/deadline and permits one new target notification. Non-continuous Melody retains ordinary phrase results and has no timed-target completion contract.

MelodyConfig remains schemaVersion 1. MelodySettingsControls and MelodyPracticeOptions remain configuration-only editors; runtime actions and achievement are never serialized. MIDI/audio ownership remains with Melody. Practice Session stores only the configuration snapshot, delegates timed achievement and Bonus to Melody, and owns hosted Mobile Play presentation during a run.


### Practice Session preset library

`src/features/practice-session/` owns the saved prescription domain. The current version-2 library contains ordered presets, normalized weekly curriculum metadata, and an optional last-used preset identity; every preset remains schema version 1 and contains an ordered exercise array. Curriculum records store title/instructions once and associate unique weekdays with either rest-day notes or a referenced ordinary preset plus optional day notes and estimated duration. They contain no exercise copy, calendar date, recurrence, completion state, result evidence, or provider provenance. Preset IDs are unique within the library, exercise IDs are unique within their owning preset, and the pair `{ presetId, exerciseId }` is sufficient runtime identity. Creation and duplication use browser-native `crypto.randomUUID()` through injectable factories.

Exercise entries form a discriminated union for Flashcards, Sequences, Ear Training, and Melody. Each entry stores its feature-owned JSON-safe config snapshot without flattening settings. Targets preserve native semantics: correct answers, completed sequences, complete Scale Repertoire, correct identifications, or Melody's configured timed practice. Scale Repertoire has no numeric repetition, and Melody duration exists only in MelodyConfig. SequenceConfig remains version 2; the other feature configs and presets remain version 1; the library envelope is independently versioned at 2.

One persisted representation supports both drafts and runnable presets. `count: null` is the only incomplete numeric target state. Empty presets, empty Scale Repertoires, and non-continuous Melody entries are valid saved drafts; explicit runnable validation reports concise launch-readiness issues for them. Structural parsing separately rejects malformed entries, incompatible engine/config/target families, duplicate owning-scope IDs, and corrupt nested configs. It delegates feature validity to each feature parser and propagates nested unsupported versions without dropping exercises or presets.

The complete library remains stored under the historical `prelude-practice-session-library-v1` key for compatibility. A missing key loads an empty version-2 library without demo content. Stored version-1 libraries parse into version 2 in memory with an empty curriculum list; loading never writes the migrated representation. Malformed JSON, corrupt data, and future schemas remain untouched for explicit recovery. A stale `lastUsedPresetId` normalizes to `null` in memory, but original bytes remain unchanged until explicit Save. Deleting a referenced preset atomically removes its practice-day curriculum entries without fabricating rest days or deleting an otherwise empty curriculum.

Pure immutable functions create, rename, add, update, remove, reorder, duplicate, and delete prescription data. Domain mutations do not persist automatically; saving is an explicit storage operation. Runtime state remains separate from the persisted P4 domain: active progress, timers, evidence, history, analytics, and session recovery are never serialized with presets.

### Weekly Practice interchange contract foundation

`src/features/practice-session/import/` owns an independently versioned `prelude-weekly-practice` interchange contract. Its nine discriminated variants are user-facing concepts rather than internal engines: Note Recognition, Triads, Melodic Intervals, Random Scales, Scale Repertoire, Arpeggios, Chord Progressions, Ear Intervals, and Reading Flow. The reduced contract exposes only active meaningful settings. A pure translator starts from each feature's canonical default config, supplies the external selections, assigns internal schema versions, and then requires `parsePracticeExerciseEntry()`, `parsePracticeSessionPreset()`, and `validateRunnablePracticeSessionPreset()` to accept the result.

The collecting external validator rejects unknown fields, unsupported values, duplicate weekdays/selections, bounds violations, unavailable repertoire scales, and mixed major/minor chord-progression selections with stable source paths and day/exercise context. It never truncates or repairs input. The input boundary is capped at 256 KiB, seven unique days, 24 exercises per practice day, and 100 exercises total. Validation and translation are pure and have no library, storage, React, file, clipboard, or download access, preserving the all-or-nothing boundary for later integration.

Feature-owned enum constants feed the runtime validator, JSON Schema, examples, and pure Copy-for-AI specification generator. The JSON Schema declares Draft 2020-12 without inventing a public `$id`; Prelude's detailed runtime validator and final canonical parsers remain behavioral authorities. Minimal and realistic examples are typed and tested through translation.

The Weekly Practice importer separates input collection from pure preparation and application. Preparation invokes the same text validator for pasted and uploaded content, allocates fresh collision-safe identities once, derives a reduced-contract preview, and proposes normalized non-overwriting preset names. Application revalidates edited names and all identities against the current working library, parses the complete merged candidate, and returns either the entire appended library or no change. The builder assigns that result only to working state; local storage is untouched until the existing explicit Save action. Rest days remain curriculum metadata and produce no presets.

The adjacent Generate a plan with AI dialog copies the exact pure `createWeeklyPracticeLlmSpecification()` result rather than reconstructing contract details in React. That self-contained artifact combines selective student-context guidance, educational concept descriptions, authoritative limits, generated JSON Schema, and tested examples. Clipboard access is the only browser integration; Prelude makes no AI or network request, and a failed write reveals the same generated guide in a selectable read-only field. The generation and import dialogs share only a narrowly scoped Weekly Practice modal shell for focus containment, Escape handling, and responsive layout. Weekly runtime, scheduling, provenance, schema download, export, and report sharing with AI remain deferred.

P5 adds Practice Sessions to the existing local App mode navigation without a router or registry. Its builder remains mounted behind a native `hidden` wrapper while another mode is active, preserving unsaved in-tab work while removing its controls from focus order and the accessibility tree. Inactive builder mutation announcements are suppressed. In edit state it mounts configuration controls only; the same builder component replaces that editor subtree with the single active runtime or summary when a run begins.

`PracticeSessionBuilder` owns a working library, an optional last-saved baseline, selection state, and explicit whole-library Save. Ordinary missing or valid storage creates a clean saved baseline; corrupt or unsupported storage has no baseline and blocks editing. Confirmed Start Fresh authorizes an empty replacement while leaving the saved baseline absent, so Save is available even before a preset is added. Existing bytes remain untouched until that Save succeeds. Successful saves establish a new baseline; failures retain the working library and unsaved state.

The feature-local builder option table creates eight human-facing concepts from existing config defaults. Numeric exercises begin with `count: null`; Scale Repertoire uses its marker target; Reading Flow enables Melody Continuous Practice and keeps duration only in MelodyConfig. The exercise editor directly updates the working library with no Apply layer. It reuses the controlled Flashcard, Sequence, Ear Training, and Melody settings components without their session hooks or Reset actions. Sequence subtype/mode edits change config and target family atomically when crossing the Scale Repertoire boundary.

Preset readiness comes only from `validateRunnablePracticeSessionPreset()` and is presented as Ready or Needs setup. Presentation helpers summarize configuration and native targets without serializing raw configs. Preset switching and top-level mode switching do not prompt or discard working edits. Preset deletion and unreadable-storage replacement use small native confirmations; exercise removal remains confirmation-free.

### Practice Session runtime

P6 keeps edit, active-run, and summary lifecycle ownership in `PracticeSessionBuilder`. Start Practice is available only for the selected runnable preset and uses its current working-library value, including unsaved edits. Start creates a JSON-detached, read-only preset snapshot; subsequent builder state cannot change the run. Starting always updates the working library's last-used identity. That preference is written immediately only when the working library matched a valid saved baseline before Start; dirty and recovery-authorized libraries retain explicit whole-library Save semantics.

`practice-session-runtime.ts` contains a pure reducer. IDs, callback tokens, and timestamps are created by the React boundary and carried in events. Runtime records exist only for entered exercises and retain identity/order, timing, actual count where applicable, monotonic target achievement, Bonus use, and a neutral completed/skipped/not-reached disposition. Runs and records remain memory-only; reload recovery, event logs, evidence persistence, analytics, APIs, and databases are absent.

The runtime mounts exactly one keyed Flashcard, Sequence, Ear Training, or Melody engine through an explicit discriminated-union switch. Every callback carries its run ID, exercise token, and exercise ID; mismatches are ignored after Next, Skip, End, unmount, or a new run. Count callbacks remain uncapped after achievement. Scale Repertoire separately counts completed scales and treats `onScaleRepertoireCompleted` as authoritative. Melody treats `onPracticeTargetReached` as authoritative, owns its timer, and continues Bonus through its existing imperative handle without remounting.

The optional `practiceSessionMode` engine prop is presentation-only. It suppresses settings, reset, Focus Staff entry, and timed-session replacement actions while retaining parsing, generation, grading, input, audio, timers, callbacks, Melody Start/count-in, review/repair, and Ear Training prompt playback. Standalone behavior remains the default. The host presents target completion in an accessible modal overlay while retaining the mounted engine; Skip and End require no confirmation. The comprehensive summary joins entered records to the full authored prescription, including never-entered exercises. App retains its single persistent `MidiProvider`.

Practice Session Mobile Play has one stable browser and viewport owner. `PracticeSessionRuntime` holds one `useMobilePlay()` instance while its keyed child engines change, so fullscreen and landscape acquisition survive Next and Skip. Its `.mobile-play-mode` root is the only fixed viewport shell and contains both the compact playlist controls and a `minmax(0, 1fr)` engine region. End, Finish, final Skip, or runtime unmount releases browser state once through the hook's existing cleanup; explicit Exit releases it while retaining the current engine and restores focus to the stable host entry action.

Flashcards, Sequences, Ear Training, and Melody accept an optional read-only hosted practice presentation containing Mobile Play, Practice Session Focus, and virtual-keyboard visibility intent. `PracticeSessionRuntime` owns the latter two as independent, memory-only state for the active run; both survive exercise transitions without entering preset configuration or changing the keyed engine identity. Children arrange their embedded content and optional keyboard from that intent but never become fixed viewport, fullscreen, or orientation owners. Without the hosted input, standalone sessions retain their engine-owned Focus and Mobile Play lifecycle exactly as before; Free Play and Piece Practice are untouched.

Practice Session Focus compacts the stable host chrome and gives its existing engine region the remaining viewport without invoking child Focus shells or `useMobilePlay()`. Hiding a hosted virtual keyboard removes its grid allocation and accessibility-tree presence without changing physical MIDI registration or grading. Flashcard one-system notation keeps intrinsic, target-kind-specific bounds rather than stretching to fill unused height; Sequence notation retains its independent measure/whole-sequence sizing. Melody uses a bounded active-practice column in Focus/Mobile Play and deliberately scrolls replacement exercise notation into view in both standalone and hosted presentations. Target completion remains the P6 `completionPresentation === "target-complete"` reducer state; the host presents Next/Finish, Keep Playing, and End Session in an accessible modal overlay while the same child remains visible and mounted. The inert background and trapped focus change presentation only: frozen progress, Melody continuation-before-Bonus, uncapped Bonus, advancement, stale-callback rejection, and final summary semantics remain unchanged.

### Practice Session comprehensive reporting

Phase 3 keeps report interpretation inside each engine. Flashcards, Sequences, Ear Training, and Melody expose pure selectors over their transient result contracts; these selectors retain native terms and do not normalize unlike evidence into a universal accuracy, mastery, or score type. Each engine validates the target-boundary evidence as a prefix of the final evidence, reports the boundary as prescribed musical work, and derives Bonus from only the native evidence appended afterward. A missing or inconsistent boundary degrades to one unsplit recorded-evidence report rather than fabricating phase attribution. Melody reporting delegates to its existing timed-diagnostic summary, mastery, Interval Trouble, metric, and notation-detail semantics; appended trials and Repair retries remain distinct Melody evidence.

The host derives one transient report by joining entered runtime records to the complete immutable run snapshot. Exercises therefore remain in authored order even when they were skipped or never entered. The host owns only lifecycle presentation: neutral outcome wording, prescribed versus Bonus units and foreground-active time, total active time, and exercise ordering. Detailed engine diagnostics use native disclosure elements and the completed report remains normal responsive document flow with one page scrollbar. Reports are not persisted, uploaded or included in the preset schema; browser printing is implemented as described below.

Implemented Phase 4 reporting supplies a feature-owned printable projection of that already-derived report. Presentation-only options filter summary, exercise, timing, and diagnostic sections without mutating the run or evidence. Practice Session print layout uses semantic normal document flow and browser pagination; it does not use Staff Builder's notation system/page composer. Melody print diagnostics deliberately use existing compact metrics, Sight Read/Repair summary, and trial status without duplicating large notation trees.

`useBrowserPrint` is the small shared browser lifecycle used by Staff Builder, Piece Practice, and Practice Session. It waits one task after feature-owned print content mounts, invokes `window.print()`, completes on `afterprint`, falls back after one second, and removes timers/listeners on cleanup. Document composition and options remain feature-owned; there is no generalized report framework.

### Piece Practice durable runs

Piece Practice now treats structured run evidence as the source of truth. Completed results, Copy Report, and browser print/PDF are regenerated from the same session state and immutable Staff Builder score snapshot. PDF bytes and rendered notation are never stored. This persistence is feature-local; Practice Session runs remain memory-only.

`piece-practice-runs.ts` owns IndexedDB database `prelude-piece-practice` version 1 and the `piece-practice-runs` store keyed by UUID `runId`, with `status`, `updatedAt`, and `completedAt` indexes. New run records use schema version 2, independently of database version 1. V1 reads normalize in memory to keyboard configuration; a later checkpoint writes V2. The score schema and IndexedDB store/index structure are unchanged. V2 validates input configuration and acoustic evidence, rejects invalid settings/source mixtures, and strips transient capture generation and consumed-event guards from checkpoints. A record keeps immutable canonical score V4 data, source ID/update metadata, start/end measure and Staff Focus, a normalized authoritative session checkpoint, evidence arrays, lifecycle status, wall-clock dates, and monotonically increasing revision. The score snapshot is parsed through Staff Builder's canonical parser and projected again on recovery; the current Piece Library is never substituted for a changed or deleted source.

The React session boundary checkpoints each authoritative domain-state transition. A write coordinator permits one backend operation in flight and replaces queued same-run active checkpoints with the newest revision; terminal saves and cross-run lifecycle operations remain ordered, as do explicit list and discard operations. The IndexedDB write transaction refuses to replace an existing higher revision. The initial active write is queued immediately on successful Start. The crash guarantee is the last **committed** IndexedDB checkpoint; an event still queued when the page closes may be lost. Monotonic clock origins are omitted from storage. A checkpoint captures accumulated active time at the transition and clears incomplete rolled-check assembly; completed checks and evidence remain. Recovery rebases the clock to the new page, starts paused, preserves the first-target armed/unarmed state and run Staff Focus, and creates no release evidence. MIDI held notes, virtual selection, chord collector, overlap grace, and pending roll timers belong to the input hook and start empty.

Run completion queues a final checkpoint with completed status and a wall-clock completion timestamp. The session tracks the latest requested, committed, and failed revisions; its completed report remains usable while the final save is pending, and browser unload protection ends only after the current completed revision commits. A failed final save keeps the report in memory, warns that recovery is unsafe, and requires explicit acknowledgement before intentional Exit. A completed run opened from IndexedDB starts already acknowledged as durable. Intentional Exit ends an unfinished run after confirmation; Restart Piece ends the old run and creates a new UUID; Restart Measure stays within the run and appends active-time restart evidence. After a fresh run is committed, other valid active records are terminalized as ended-incomplete without deleting evidence. Entry parses first, then surfaces the newest valid active run, any older valid active runs, and the latest valid completed report; invalid records remain in a collapsed Discard section and never hide valid runs. Completed evidence survives report viewing and print. Older V1 checkpoints without restart evidence hydrate with an empty collection. Copy and PDF count restarts from the same collection, and a restart-only measure is a problem-scope process signal. Normal retention keeps the newest eight valid terminal runs plus active runs. A failed write evicts one oldest valid terminal run and retries once; repeated failure leaves practice usable in memory with a visible recovery warning.

### Targeted Practice — PROVISIONAL completed-run workflow

`piece-practice-targeted-practice.ts` derives transient recommendations from existing completed-run measure diagnostics. The provisional `PIECE_PRACTICE_TARGETED_PRACTICE_PRIORITY` sorts descending lexicographic mistake, skipped-target, deliberate-restart and hesitation counts, then original measure index. Only completed measures within the practiced range with an existing problem signal are eligible. Elapsed time, physical velocity/releases and inferred retry counts do not contribute. The UI exposes counts and the provisional ordering rather than an ability or difficulty score.

`PiecePracticeTargetedPractice` provides an optional completed-results section with on-demand read-only score notation and single-measure actions. `PiecePracticeSession` retains the original immutable run, session state and save acknowledgement in a private transient navigation context, then creates an ordinary V2 run for the selected inclusive original measure range. It supplies the original run's score snapshot, assessment focus and input configuration. Keyboard runs keep their mounted MIDI/VKB input and Mobile Play owners. Microphone runs receive a new keyed acoustic owner with listening off. Comparisons require matching input mode, instrument and tolerance as well as range/focus. Existing ties, boundary reattacks, rolled checks, first-target timing, grading and completion remain authoritative. Launch/return wait for pending completed saves or require the existing explicit failed-save acknowledgement. Returning from unfinished practice uses the existing end-run confirmation; cancelling leaves pending input intact.

The latest completed focused state per measure is retained only for this visit. The pure comparison guard requires completed evidence for the same measure identity, assessment focus and exact focused range; the caller owns the common score snapshot. Presentation compares native counts separately and explains that passage starts and repetition exposure differ. A skipped completion never establishes mastery. Unfinished returns retain any previous completed comparison; ordinary Practice Again clears the navigation/comparison context. Original reports and authored scores are never rewritten.

Each transient focused comparison also retains its own run ID, completed revision and save acknowledgement. Only successful persistence of that run at or beyond that revision acknowledges the comparison. Pending or failed focused results carry an explicit unsaved notice, including after an acknowledged return to a durably saved original report or an unfinished repetition. The original report's saved status does not establish focused-result durability. Late save callbacks cannot acknowledge a different attempt's comparison; current-run save status and unload protection retain their existing run/revision guards.

There is no new persistence contract. Original and focused runs use the same database, checkpoints, retention and report/recovery paths. Reload recovers an active focused attempt paused as ordinary Piece Practice; its transient connection to the original report is not restored. Existing retention may eventually evict either terminal record. No cross-run history analysis, timing-normalization metric, new grading, service or dependency is introduced.

### Raw MIDI diagnostic

`src/components/midi/midi-diagnostic.tsx` is a permanent ordinary App mode with an intentionally independent Web MIDI access lifecycle. It observes all connected inputs, attributes each event to an input ID/name snapshot, handles hotplug and disconnect, and removes its listeners when the mode unmounts. It neither registers as an `AppMidiConsumer` nor changes `useMidi`, `MidiProvider`, or any feature input contract. A previously connected provider may independently receive the same physical event, but only the diagnostic owns diagnostic rows.

The adjacent pure `midi-diagnostic-message.ts` decoder is diagnostic-local rather than a production telemetry framework. It preserves every raw byte, decodes safely present channel/system fields, identifies truncated and unexpected-extra lengths, and retains reserved or unknown messages. `midi-diagnostic-capture.ts` assigns browser-event-relative timing and monotonically increasing sequence numbers, keeps the newest 1,000 immutable rows, reports dropped rows, and produces deterministic plain-text/TSV clipboard evidence. Capture and clipboard fallback remain in memory; SysEx access, persistence, analytics, grading, Piece Practice alignment, and report integration are absent.
