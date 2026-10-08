# Prelude: MIDI Mentor

**Prelude is a browser-based, notation-first musicianship trainer with MIDI/virtual-keyboard practice, provisional acoustic Piece Practice, and a standalone microphone tuner.**

It displays notes using standard music notation, listens to a connected MIDI keyboard, and provides immediate feedback as the player practices.

The project began as a personal tool for improving note recognition and is being developed into a broader platform for learning how music works—not merely which keys to press.

## Live Demo

[Open Prelude: MIDI Mentor](https://nickbuzzerio.com/prelude/)

No account or installation is required.

A physical MIDI keyboard provides the full experience, but the on-screen keyboard can also be used.

---

## Features

### Violin preflight and acoustic analysis (2.9.1, provisional)

Microphone Piece Practice for violin now starts with a G3 → D4 → A4 → E5 open-string check. Start Listening explicitly, bow each open string steadily, and review detected note/Hz and signed cents against A440 equal-tempered targets. A stable result within ±5 cents advances after a brief acknowledgment; near-target (through ±15 cents) and larger offsets offer Retry or explicit continuation. Any string can be skipped. The summary identifies strings still needing tuning. Enter Piece Practice explicitly, leave a quiet gap, and re-articulate; calibration cannot grade targets or run the practice timer.

Analysis data defaults On for microphone practice and remembers only that preference. It collects bounded local scalar evidence, never audio, and never uploads anything. Stop Listening, then choose **Export Acoustic Analysis**, or export from the current result. The self-describing version-1 JSON includes retained pitch observations, calibration, target visits, attacks, existing grading evidence, coverage and conservative summaries. Export before leaving/reloading/restarting or entering another run: calibration/trace are not part of V2 recovery. Ocarina retains its existing microphone practice and can collect analysis; ocarina calibration and all instrument diagrams remain future work.

The trace uses actual observations in 100 ms bins, a four-second diagnostic ring and bounded high-resolution windows. Collection stops visibly at the first duration (60 minutes), event (10,000), or conservative memory allowance (roughly 16 MiB) limit while practice continues. Long sessions may reach that allowance before 60 minutes. Tuning and detector thresholds remain provisional pending physical QA; a stable harmonic can still be the wrong octave. Concert pitch and existing practice acceptance/mistake semantics remain unchanged.

### Flashcard Practice

- Treble, bass, and mixed-clef practice
- Single-note flashcards
- Major, minor, diminished, and augmented triad flashcards
- Root position, first inversion, and second inversion
- Configurable natural-note and accidental-note practice
- Standard staff notation rendered with VexFlow

### Sequence Practice

- Ascending and descending melodic intervals
- Major, natural minor, harmonic minor, and melodic minor scales
- Major and minor pentatonic scales
- Major, minor, diminished, and augmented arpeggios
- Dominant seventh, major seventh, and minor seventh arpeggios
- Curated Roman-numeral chord progressions in supported major and minor keys
- Root-position chord progressions with progression and current-chord labels
- Physical MIDI block and rolled-chord entry
- Persistent virtual-keyboard chord selection with toggle-to-deselect input
- Focus Staff support within Sequence practice
- Step-by-step sequence validation
- Musically correct note spelling for intervals, scales, arpeggios, and chord progressions
- Current temporal measure view with `Measure n of m` and global step progress
- Optional presentation-only Show Whole Sequence view with readable horizontal scrolling

### Free Play

- Ungraded live notation from physical MIDI and the virtual keyboard
- Persistent grand staff with automatic treble- and bass-staff placement
- No Key or 12 supported major and minor key contexts
- Key signatures on both staves
- Key-aware diatonic and enharmonic spelling
- Automatic, Prefer sharps, and Prefer flats chromatic spelling
- Immediate respelling when notation settings change while notes are held
- Focus Staff support
- Neutral held-key highlighting for ungraded practice

### Ear Training

- Melodic interval identification from minor second through octave
- Configurable ascending and descending prompts
- Explicit Play Prompt and stable Replay Prompt controls
- Prompt-oriented feedback, streaks, accuracy, and response-time statistics
- Focus Staff exclusion and a dedicated Mobile Play answer layout

### Staff Builder

- Multi-measure authoring with treble, bass, and grand-staff MIDI or virtual-keyboard capture
- Direct correction of rhythm, rests, spelling, ties, key, time, and staff routing
- Automatic same-staff polyphony and authored upward rolled/arpeggiated chords
- Deterministic event, measure, position, and piece playback
- Local project persistence, draft recovery, structural validation, and validated Save
- Study View with score annotations and multi-system presentation
- Per-piece `.prelude.json` download and schema-validated import for local backup and recovery
- Full-piece, treble-range, and bass-range duplication without changing the source piece
- Responsive desktop, Chromebook, and mobile interaction

### Blocking Piece Practice

- Launch structurally valid saved Staff Builder pieces directly from the local library
- Practice a transient projection of the authored score; durable run records retain the practiced snapshot separately from the library
- Practice one score position at a time; incorrect attempts remain blocked for retry
- Grade same-onset polyphony through one normal pitch-set check plus independent authored rolled-chord checks
- Evaluate upward rolls expressively with a tempo-relative window while retaining ordinary block-chord collection
- Support physical MIDI and persistent virtual-keyboard selection without merging their attempts
- Choose provisional Microphone input for violin or ocarina on eligible monophonic ranges, after Staff Focus
- Set pitch tolerance to ±15/25/40 cents or a custom integer 1–49; start listening explicitly and re-articulate repeated notes
- Respect authored rests, pitch-specific ties, independent grand-staff rhythm, and automatic same-staff polyphony
- Practice an inclusive start/end excerpt—or continue through the end—while retaining authored measure numbering
- Review attempt-local mistake counts by measure, then replay the same selected range with Practice Again
- Restart the current measure or selected practice range and return to the Staff Builder library
- Reuse authored notation without creating a copied Sequence score
- Resume browser-local runs from committed IndexedDB checkpoints and reopen completed reports
- Use provisional Targeted Practice for evidence-led single-measure repair and in-tab original/latest count comparison

Blocking Piece Practice grades pitch attacks and progression only. It does not grade BPM, note-hold duration, rhythmic timing, or continuous performance; those remain separate possible future Accuracy-mode work.

Completed Piece Practice results offer Copy Report alongside print/PDF. Include MIDI attack strength defaults off and controls report presentation only. Physical Note On velocities (1-127), attack sequence, and individual active-time offsets are retained separately for each attack, including repeated pitches and rolled chords, as target-associated evidence in browser-local practice runs. Enabling the option includes exact velocities and a count/range; virtual input has no fabricated physical attack evidence. This does not grade dynamics, roll direction or spacing, infer hands/balance, or change pitch/timing grading, and no raw MIDI recording is stored. Failed clipboard access exposes a selected read-only report for manual copying.


Microphone mode uses the same detector for violin and ocarina; those choices describe the run, not instrument-specific intelligence. A sustained pitch satisfies only one repeated target. A rejected intonation attempt needs fresh articulation; weak bow restarts may need a brief quiet gap. Accepted within tolerance does not mean the Tuner's ±5-cent "in tune." Chords, rolls, overlapping distinct assessed pitches and pitches outside 120–2300 Hz are refused before permission. Microphone runs suppress feedback tones and the interactive piano, store scalar acoustic evidence separately from MIDI, and recover paused with the microphone off. New run records use V2; existing V1 records remain readable as keyboard runs. No audio is recorded or uploaded. Physical reliability remains provisional; see the [owner acoustic QA procedure](docs/TESTING.md#acoustic-piece-practice-290).

### Real-Time Input and Feedback

- Physical MIDI keyboard support
- Interactive on-screen piano
- Immediate correct and incorrect feedback
- MIDI connection status and diagnostics
- Reachable raw MIDI diagnostic with browser timestamps, source input, channels, velocities, releases, controllers, pressure, pitch bend, system messages, raw bytes, and a bounded copyable capture
- One user-initiated MIDI connection remains active while switching Prelude modes
- Simultaneous MIDI note tracking
- Rolled chord support
- Grace-based transitions between sequence notes
- Sample-based piano playback

### Melody Mode

- Continuous, non-blocking one- or two-measure sight-reading in treble or bass
- C/G/F major and A/D natural minor at 50, 60, 70, or 80 BPM
- Physical MIDI and momentary on-screen-keyboard input
- Count-in/metronome timing and a two-quarter-beat preparatory display lead-in
- Independent Pitch, Movement, and attack-Timing scores
- Pitch-result staff: green correct, dashed light blue missed, red wrong pitch; timing is scored separately
- Seeded Retry Same and Try Another exercises
- Timed diagnostic sessions with Session Review and targeted repair retries
- Original Sight Read evidence preserved separately from latest and accumulated Repair evidence
- Interval Trouble analytics reported independently for Sight Read and Repair attempts
- Explicit Mobile Play that preserves setup, count-in, performance, and results state
- Basic offline VKB workflow after the installed/loaded PWA has cached its assets

Melody is monophonic 4/4 without rests, chords, two-hand material, hold-duration grading, latency calibration, or server-side/persisted analytics. Timed diagnostic and repair evidence lasts only for the current in-memory session.

### Practice Sessions

- Build reusable named presets from Flashcards, Sequences, Ear Training, and timed Melody exercises
- Configure an ordered practice prescription once, then start and advance without reopening each mode's settings
- Use native completion targets, including Scale Repertoire traversal and Melody-owned timed practice
- Continue with Bonus practice, Skip for Today, End Session, and comprehensive authored-order reports including never-entered exercises
- Print configured reports / Save PDF and import Weekly Practice prescriptions through validated paste/upload previews
- Save presets explicitly in the current browser with no account or cloud dependency
- Keep Mobile Play active across exercise transitions on tablet and Chromebook

### Chromatic Tuner

- Explicit microphone Start/Stop with local monophonic pitch detection
- Note/octave, frequency and cents with stabilization and honest uncertainty
- Interruption handling, bounded resource cleanup and capture exclusion during active Practice Session runs
- A4=440 Hz / equal temperament, estimated range 120–2300 Hz; no recording/upload or practice grading

Desktop synthetic browser validation exists, plus one owner-observed successful real violin test. Broader Chromebook/Android and violin/ocarina/sung-voice QA remains pending. Strong harmonics can still produce confident octave mistakes; instrument diagrams and acoustic practice integration are future work.

### Practice Statistics

- Accuracy
- Current streak
- Response time
- Session progress
- Separate statistics for flashcard and sequence practice

### Cross-Platform Experience

- Responsive desktop, tablet, and mobile layouts
- Explicit Mobile Play in Flashcards, Sequences, Free Play, Ear Training, Melody, and active Piece Practice
- Best-effort fullscreen and landscape orientation requests with a usable fallback when browser APIs refuse or are unavailable
- Chromebook MIDI support
- Installable Progressive Web App
- Offline application shell
- Update Ready with Reload/Later, confirmed per-tab reload and curated What's New

---

## Why Prelude?

Many piano-learning applications use falling notes, highlighted keys, or memorized finger patterns.

Those tools can help someone reproduce a song, but they do not always develop skills that transfer to unfamiliar sheet music.

Prelude takes a notation-first approach:

```text
Standard Notation
        +
Real-Time MIDI Input
        +
Immediate Feedback
        =
Transferable Musicianship
```

The goal is to connect three ideas:

1. What a note looks like on the staff
2. Where that note exists on the keyboard
3. What that note sounds and feels like when played

---

## How It Works

Prelude currently provides nine complementary top-level modes/tools:

```text
Flashcards
    └── Identify isolated notes and triads

Sequences
    └── Play ordered intervals, scales, arpeggios, and chord progressions

Free Play
    └── View live notation while practicing without grading

Ear Training
    └── Identify ascending and descending melodic intervals by sound

Melody
    └── Perform continuous one- or two-measure sight-reading exercises

Staff Builder
    |-- Transcribe and edit practice material directly on a score

Practice Sessions
    |-- Build and run reusable ordered practice prescriptions

MIDI Diagnostic
    |-- Inspect raw and interpreted hardware input without grading

Chromatic Tuner
    |-- Observe microphone pitch, frequency and cents
```

Flashcards and Sequences generate musical targets, render them using standard notation, validate MIDI or virtual-piano input, and provide immediate feedback.

Free Play removes the target and grading layers. Physical MIDI and virtual-piano notes share the same live held-note state and key-aware spelling pipeline before appearing on a persistent grand staff. Players can use No Key or one of the supported major and minor keys, choose a chromatic spelling preference, and change notation settings without clearing or replaying held notes.

Staff Builder is a separate learning-focused score editor. It combines beginner-oriented capture, direct score correction, sequential Lyric Cue authoring, measure insertion/deletion, validation, deterministic playback, printable Study View, annotations, duplication, and local projects while keeping score authoring separate from future Guided Studies. Study View is score presentation, not the teaching journey. Structurally valid saved pieces can launch Piece Practice, which reads a transient projection of that authoritative score and advances only after all checks at the current score position are complete. Piece Practice is launched from Staff Builder rather than exposed as a separate top-level mode.

Practice Sessions compose the existing Flashcard, Sequence, Ear Training, and Melody engines into reusable local presets. A Ready preset starts from its current configuration, advances directly between exercises, and keeps one hosted Mobile Play presentation active across the playlist without merging the engines' grading or input state.

Shared MIDI, notation, keyboard, audio, interval-domain, and musical-event playback systems keep the experience consistent while each mode retains its own state machine.

---

## Technology Stack

### Application

- React
- TypeScript
- Vite
- Tailwind CSS

### Music

- Web MIDI API
- VexFlow
- Sample-based piano playback

### Progressive Web App

- vite-plugin-pwa
- Workbox

### Deployment

- DigitalOcean
- Nginx
- GitHub Actions
- Self-hosted deployment runner

---

## Getting Started

### Requirements

- Node.js
- pnpm
- A browser with Web MIDI support for physical keyboard input

Google Chrome and other Chromium-based browsers generally provide the strongest Web MIDI support.

### Installation

```bash
git clone https://github.com/nickbuzzerio/prelude-midi-mentor.git
cd prelude-midi-mentor
pnpm install
```

### Start the Development Server

```bash
pnpm dev
```

Open the local URL shown in the terminal.

### Production Build

```bash
pnpm build
```

### Preview the Production Build

```bash
pnpm preview
```

### Lint the Project

```bash
pnpm lint
```

---

### Run the Test Suite

```bash
pnpm test
```

Prelude uses **Vitest** and **React Testing Library** for automated testing.

Prelude's automated suite covers:

- music-theory utilities and notation-aware spelling
- flashcard, interval, scale, arpeggio, triad, and chord-progression generation
- deterministic chord construction and curated progression realization
- answer and sequence validation
- flashcard and sequence statistics
- stateful practice hooks
- Web MIDI integration
- focused session orchestration
- shared Mobile Play browser lifecycle, Focus Staff coordination, state preservation, and mode-specific presentation
- Ear Training target generation, prompt scheduling, grading, and session statistics
- Staff Builder score invariants, capture, correction, validation, persistence, playback, interaction geometry, radial controls, and responsive presentation
- Blocking Piece Practice projection, ties/polyphony, blocking progression, MIDI/VKB input separation, read-only presentation, validation-gated launch, exit, and source/storage immutability
- Staff Builder schema migration, annotations, Study View, duplication, and rolled-chord authoring
- Melody timed diagnostics, Session Review, repairs, interval analytics, and preparatory lead-in

Mobile Play preserves each mode's feature-owned session and input contract: Flashcards and Sequences retain graded toggle input, Free Play alone adds momentary multitouch press/release input, Melody retains its continuous recorder/clock/source lock, and Piece Practice retains blocking progression and pending chord input. Mobile Play and Focus Staff are mutually exclusive where both are available. Fullscreen and landscape lock are enhancements rather than requirements; if fullscreen exits externally, the Mobile Play layout remains active until the user explicitly exits it.

Run the complete release verification workflow with:

```bash
pnpm verify
```

See [`TESTING.md`](./docs/TESTING.md) for the complete testing philosophy and coverage.

---

## Using a MIDI Keyboard

1. Connect the MIDI keyboard to the computer.
2. Open Prelude in a supported browser.
3. Grant MIDI access when prompted.
4. Confirm that the device appears in the MIDI status area.
5. Begin a flashcard session and play the displayed note.

Some MIDI interfaces label their cables from the interface's perspective:

```text
Interface MIDI OUT → Keyboard MIDI IN
Interface MIDI IN  → Keyboard MIDI OUT
```

When a device is not detected, check the cable direction and open **MIDI Diagnostic** from Prelude's mode navigation. Connect MIDI there to inspect every browser-received message from every connected input. Clear starts a fresh timestamp origin, Pause/Resume controls capture without disconnecting, and Copy Capture produces compact diagnostic text suitable for sharing. The newest 1,000 events remain in memory; the viewer reports when older rows were dropped and does not save or grade the capture.

Physical MIDI input depends on browser Web MIDI support and user permission; Chromium-based desktop browsers provide the most reliable current path. The virtual keyboard remains available where physical MIDI is unavailable, but MIDI, touch, audio-autoplay, fullscreen, and orientation behavior can vary by browser and device and should be verified before relying on a particular setup.

---

## Project Structure

```text
src/
├── assets/
│   └── audio/
│
├── components/
│   ├── audio/
│   ├── midi/
│   └── notation/
│
├── data/
│
├── features/
│   ├── ear-training/
│   ├── flashcards/
│   ├── freeplay/
│   ├── melody/
│   ├── piece-practice/
│   ├── practice-session/
│   ├── sequences/
│   ├── staff-builder/
│   └── tuner/
│
├── hooks/
│
├── lib/
│   ├── audio/
│   ├── music/
│   │   └── generators/
│   ├── practice/
│   └── pwa/
│
├── types/
│
├── App.tsx
├── main.tsx
└── index.css
```

- **components/** — React UI components organized by feature and presentation.
- **data/** — Static musical data used by the application.
- **features/** — Feature-specific state, orchestration, and hooks.
- **hooks/** — Cross-feature reusable React hooks.
- **lib/** — Reusable audio, music, practice, MIDI, and platform logic that is independent of React.
- **types/** — Shared TypeScript models used throughout the application.

Current feature domains under `features/` include `ear-training`, `flashcards`, `freeplay`, `melody`, `practice-session`, `sequences`, `staff-builder`, `tuner`, and the Sequence-adjacent `piece-practice` workflow. Piece Practice is launched from Staff Builder rather than exposed as a permanent top-level mode.

For a more detailed technical explanation, see
[`ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Current Status

Current package/application version is **2.9.1**, derived by the UI from `package.json`. No new release or tag is implied.

The nine top-level modes/tools above are implemented. Staff Builder also launches blocking Piece Practice with durable browser-local runs and provisional Targeted Practice. Practice Sessions provide prescriptions, comprehensive reports/printing and Weekly Practice import; their runtime evidence and Melody diagnostics remain memory-only. Device/instrument QA remains separate from implementation.

Staff Builder projects/drafts use local storage; Piece Practice keeps practiced snapshots/checkpoints in IndexedDB. There is no account or cloud synchronization. Back up important pieces as `.prelude.json`; importing a piece does not restore practice evidence. Clearing site data or losing the browser/profile/device can remove local work.

The PWA caches its shell and piano samples for a basic offline VKB workflow after a successful online load/install. Physical MIDI, microphone permissions, installed-PWA updates and offline behavior need representative browser/device QA.

Update Ready offers Reload/Later without automatically reloading this tab. Reload always warns about active practice, reports and unsaved/in-memory work. What's New shows bundled curated updates newest first, with browser-local acknowledgment; first use shows only the newest entry. This is not automatic recovery. Legacy 2.8.7 tabs may need to close/reopen during the first transition; see [RELEASING.md](./docs/RELEASING.md).

See [ROADMAP.md](./docs/ROADMAP.md) for the authoritative rolling direction.

---

## Rolling Direction

Instrument learning now precedes Improv: Acoustic Piece Practice → violin calibration/acoustic analysis → instrument learning visualizers → later Intonation Search/Practice Coach → Improv. Flow Sight-Reading has a foundation in Melody; sustained reading beyond short trials remains a major future milestone. Guided Studies will teach through explanation, demonstration, experiment, repetition, comparison and reflection while composing native modes.

Reusable violin first-position guidance is a future stage, first integrated with microphone Piece Practice. Ocarina calibration/diagrams require a defined profile/chart; voice means sung pitch. Microphone Staff Builder authoring remains later. Acoustic participation in practice is conditional on evidence and activity-specific semantics, not automatic MIDI substitution.

PWA Update + What's New is implemented; small QOL work and physical QA continue alongside musical milestones. Broader creative tools extend Improv rather than a competing Composer mode; Prelude remains focused on learning rather than DAW production. Full priorities and deferred choices live only in [ROADMAP.md](./docs/ROADMAP.md).

---

## Architectural Direction

Prelude uses separate practice models for isolated and ordered exercises.

`PracticeTarget` represents isolated musical concepts such as individual notes and triads.

`SequenceTarget` represents ordered musical material such as intervals, scales, arpeggios, and chord progressions.

Free Play bypasses target generation and grading. It preserves held MIDI pitches, applies Free Play-owned key and chromatic-spelling context, and supplies explicitly spelled notes to the shared grand-staff renderer.

Staff Builder owns an application-level score model independent of VexFlow. Capture Notes and Rhythm Correction are separate workflows over that score; VexFlow remains decorative while React-owned controls use public renderer geometry for direct interaction. Deterministic score playback reuses the shared musical-event player.

These modes share lower-level systems for MIDI input, virtual-piano interaction, music notation, audio playback, and musical note models while keeping their session behavior independent.

Future Guided Studies compose native activities through explicit launch/completion/return contracts. The tuner remains feature-local until another real consumer needs reusable boundaries; conceptual monophonic and future polyphonic paths do not constitute an implemented universal input system.

---

## Documentation

- [`ONBOARDING.md`](./docs/ONBOARDING.md) — Project orientation and development context
- [`VISION.md`](./docs/VISION.md) — Product purpose and learning philosophy
- [`ROADMAP.md`](./docs/ROADMAP.md) — Authoritative rolling roadmap
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Current structure and technical direction
- [`DECISIONS.md`](./docs/DECISIONS.md) — Important product and architectural decisions
- [`TESTING.md`](./docs/TESTING.md) — Testing philosophy and coverage
- [`DEVLOG.md`](./docs/DEVLOG.md) — Implementation/release history and Unreleased work
- [`RELEASING.md`](./docs/RELEASING.md) — Versioning, validation, tagging, and deployment process

---

## Product Principles

Prelude is guided by several principles:

- Learning before novelty
- Standard notation before imitation
- Understanding before speed
- Progression before complexity
- Reuse before duplication
- Browser-first accessibility
- Simple, coherent milestones

Every new feature should strengthen the student's understanding of music.

---

## License

This project is available under the [MIT License](./LICENSE).
