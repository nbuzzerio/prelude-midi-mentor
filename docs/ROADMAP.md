# Prelude: MIDI Mentor — Rolling Roadmap

> Authoritative product direction, instrument-learning priority updated by the owner October 7, 2026. Current pending package/application version: **2.9.6**; 2.9.5 is committed. Implementation, physical validation, deployment, and owner-controlled tagging/releasing are separate facts.

Prelude develops through eight continuing threads. This is a rolling roadmap, not a rigid sequence of phases or a delivery-date commitment. Major musical milestones, permanent product threads, small QOL work, conditional integrations, and physical QA can progress at different rates.

## Implemented baseline

The following systems exist today. Pending physical QA does not make their implementation a future commitment:

| System | Implemented capability and boundary |
| --- | --- |
| Flashcards | Single notes and major/minor/diminished/augmented triads, triad inversions, clefs, natural/accidental filters, MIDI/VKB input, feedback and statistics. Natural-note-only selection already exists. |
| Sequences | Ordered melodic intervals, major/minor/pentatonic scales, arpeggios including sevenths, curated major/minor triad progressions, theory-aware spelling, temporal measure presentation, and ordered/shuffled Scale Repertoire. |
| Free Play | Ungraded live MIDI/VKB grand-staff notation, key signatures, key-aware spelling, and held-key presentation. No automatic key/chord analysis or phrase history. |
| Ear Training | Ascending/descending melodic-interval identification, explicit replay, statistics, and pedal-to-Play-Prompt. Other aural tasks remain future work. |
| Melody | Seeded monophonic one/two-measure 4/4 reading, count-in/metronome, continuous capture, nonblocking performance, alignment, separate Pitch/Movement/Timing results, timed review and repair. Evidence is memory-only; sustained Flow remains future work. |
| Staff Builder | Application-owned score authoring, notes/chords/rests/rhythm/ties/context/annotations, capture and correction, derived polyphony, playback, local library/drafts, validated Save, score import/export, duplication, Lyric Cues, display clefs, and printable Study View. Study View is score presentation, not Guided Studies. |
| Piece Practice | Blocking pitch-attack practice from authoritative Staff Builder scores, excerpts, Staff Focus, ordinary/rolled checks, diagnostics, copy/print reports, and durable browser-local IndexedDB run snapshots/checkpoints with paused recovery and bounded retention. Continuous performance grading is not implemented. |
| Targeted Practice | Provisional evidence-led repair inside Piece Practice: transparent measure recommendations, original-snapshot single-measure runs, and in-tab original/latest count comparison. Ordinary runs persist; navigation/comparison links do not. No adaptive coaching or mastery score. |
| Practice Sessions | Reusable browser-local prescriptions across Flashcards, Sequences, Ear Training and timed Melody; native targets, Scale Repertoire, Bonus/Skip/End, stable hosted Mobile Play, comprehensive authored-order reports including never-entered work, and browser printing. Runtime evidence remains memory-only. |
| Weekly Practice import | Reduced nine-concept interchange, curriculum metadata, validation/translation/schema/examples, paste/upload preview and atomic import into the unsaved library, plus a Copy-for-AI guide. No weekly scheduler, cloud AI service, or report history. |
| MIDI Diagnostic | Independent bounded in-memory hardware inspection, raw messages, musical-event interpretation, and copyable diagnostics. No grading or idea recorder. |
| Chromatic Tuner | Explicit microphone Start/Stop, browser capture, monophonic detection, note/octave/Hz/cents, stabilization/uncertainty, interruption handling, bounded cleanup and active-Practice-Session capture exclusion. Desktop synthetic browser validation exists. |
| Platform | Responsive presentation, coordinated Mobile Play, sampled piano and feedback audio, installed-PWA/offline-shell support and production build/deployment foundations. Device-specific behavior still needs physical QA. |

The tuner uses A4=440 Hz, equal temperament and a 120–2300 Hz estimate range. One successful real violin test is **owner-observed limited physical evidence**. Broader Chromebook/Android and violin/ocarina/sung-voice QA remains pending. Strong harmonics can still cause confident octave mistakes; stable periodicity does not establish correct pitch identity.

### Historical milestone context

The early Flashcard foundation/stabilization, Sequence introduction and expanded practice platform are implemented. Staff Builder supplied the score foundation; subsequent milestones added Piece Practice, Melody and coordinated mobile workflows, Practice Sessions, comprehensive reporting/printing, Weekly Practice import, durable Piece Practice runs, Targeted Practice and the tuner. Release-era detail remains in [DEVLOG.md](./DEVLOG.md); those records are not a second active roadmap.

The former numbered Harmony, Musicianship, Guided Lessons, Lesson Builder, Playback and Composer phases are superseded by the continuing threads below. Existing piano playback, playback controls, natural-note filters and Melody's metronome are not future implementation tasks. Further harmony, rhythm, editing, playback or teaching capabilities require a concrete product need and a bounded plan.

## Near-term instrument-learning sequence

Owner-observed violin use now prioritizes: **2.9.0 Acoustic Piece Practice → Instrument Calibration / Acoustic Analysis → Instrument Learning Visualizers → later Intonation Search / Practice Coach → Improv**.

Stage 1A/1B/1D is implemented provisionally from 2.9.1: violin G3/D4/A4/E5 preflight (now short-pluck calibration policy v3) plus transient bounded scalar JSON export. Local performance recording is implemented for violin/ocarina in 2.9.4 and piano MIDI in committed 2.9.5. Stage 2 violin first-position guidance is implemented in pending 2.9.6 through presentation-only instrument pitch context. Physical threshold/device and diagram QA remain pending. Ocarina calibration and diagrams require an identified profile and verified manufacturer chart; the suspected Huazzzyi ZO-1 12-hole Alto C is not yet verified. Intonation Search/Practice Coach requires a separate approved learning-semantics plan; current mistake semantics are unchanged. Microphone Staff Builder authoring remains behind the instrument-learning stages. The numbered continuing threads below are not a strict delivery order.

## 1. Improv / Creative Exploration

**Status:** FOLLOWS THE INSTRUMENT-LEARNING SEQUENCE; permanent creative thread.

**Purpose:** Help players invent, explore, compare and develop musical ideas. Free Play observes and helps understand what is played; Piece Practice helps learn existing music; Guided Studies teach concepts; Improv supports invention and experimentation.

**Likely next milestone:** A bounded MIDI/VKB experience with key/scale context, constrained exploration, helpful musical guidance and obvious value beyond ordinary Free Play.

**Dependencies:** Existing theory, spelling, notation, input and playback where their semantics fit. Microphone support is not a prerequisite.

**Later direction:** Chord/progression context, motif development, idea capture and eventual support for composing material for MACEDON. The former Composer Sandbox belongs to this longer-term direction rather than a competing major product.

**Non-goals:** A DAW, broad production tooling or a renamed Free Play experience.

## 2. Continuous / Flow Sight-Reading

**Status:** FOUNDATION EXISTS; MAJOR FUTURE PRACTICE MILESTONE.

**Purpose:** Support reading ahead, maintaining pulse, continuing through mistakes and sustained reading beyond short trials, with review after a passage/session rather than constant stops.

**Likely next milestone:** Define and deliver the first sustained-reading increment. Longer generated reading, an uninterrupted generated stream and authored-piece continuous practice remain deferred alternatives for owner choice when this thread becomes active.

**Dependencies:** Melody already supplies a musical clock, continuous MIDI/VKB capture, timing alignment, notation, scoring foundations and nonblocking performance. Practice Sessions' existing Reading Flow label refers to timed Melody practice, not completion of this broader milestone.

**Boundaries:** Reuse mature primitives without inventing continuous capture again or adding a universal grading engine. Authored Piece Practice continuous performance is related but remains distinct from its existing blocking engine. Acoustic timing is independently evidence-gated.

## 3. Guided Studies

**Status:** MAJOR PERMANENT PRODUCT PILLAR; first vertical slice follows sufficient maturity of the selected activity contracts.

**Purpose:** Teach why musical material behaves as it does through:

```text
explanation → demonstration → experiment → repetition → comparison → reflection
```

Studies own the teaching journey. Native feature domains continue owning rendering, notation, playback, timing, input, grading, persistence and practice evidence. A Practice Session organizes what to practice; a Guided Study adds why, comparison, context and reflection. Staff Builder Study View remains score presentation.

**Likely next milestone:** A useful, bounded **D Minor Study**. Its first learning objective and audience remain deferred owner decisions, not assumed scope.

**Concept bank, not first-slice checklist:** D natural minor, harmonic minor and melodic minor; relationship to F major; key signature/note recognition; scale performance; intervals; D minor arpeggio; diatonic chords; common progressions; ear recognition; singing/playing target pitches; improvisation; musical character; listening context; and an eventual applied excerpt or short study.

**Prerequisites for the chosen slice:** Reviewed musical explanations/demonstrations; exact material selection; explicit native launch/completion/return contracts; reliable interruption and focus behavior; and accessible teaching content. Distinguish activity completion from concept understanding. D-minor forms and F major already fit Scale Repertoire, but arbitrary note collections, exact arpeggio roots or tonal aural prompts are not guaranteed by current random configuration. Close only required gaps in their owning feature.

**Reuse:** Flashcards, Sequences, Ear Training, Free Play, Improv, Melody/Flow, notation/playback, Piece Practice and its Targeted Practice repair. Microphone input and instrument diagrams join only when supported. Current Ear Training identifies interval names; sung answers would be a new activity.

**Music safeguards:** Classical melodic minor raises sixth/seventh ascending and uses natural minor descending. Preserve theory-aware spelling, distinguish natural-minor harmony from explicit alterations, and explore musical character through context rather than universal emotional labels. Double accidentals remain unsupported.

**Non-goals:** Duplicate practice engines, universal mastery scores, a full course/teacher-authoring platform or every concept in the bank before the first slice. Neither full Flow nor acoustic integration is a universal prerequisite.

## 4. Microphone Instruments / Instrument-Aware Tuner

**Status:** TUNER MVP COMPLETE; VIOLIN FIRST-POSITION GUIDE IMPLEMENTED IN PENDING 2.9.6; permanent thread.

**Purpose:** Connect a detected or target pitch to useful instrument guidance while preserving measurement uncertainty.

**Likely next milestone:** Physical QA of violin preflight/analysis and the first-position guide, then a separately bounded ocarina diagram using the owner's verified manufacturer chart. The standalone tuner remains independently owned; no separate instrument tuner apps are required.

**Conceptual architecture, not implemented global services:**

```text
AudioSource → MonophonicPitchAnalyzer → normalized pitch observation → consumer
AudioSource → future PolyphonicAnalyzer → chord / multi-note observations
```

Potential monophonic consumers include Tuner, instrument visualization, acoustic Free Play, Studies, scales and other eligible activities. Acoustic Piece Practice is now a real consumer of the shared monophonic implementation, with independent capture ownership; preserve room for a separate future polyphonic path.

**Violin:** Pending 2.9.6 shows a recommended string/fingering, selectable open/fourth-finger alternatives, optional score-spelled stickers and independent expected/live possible positions. The schematic models offsets 0–7 per string using proportional vibrating length. Prelude measures pitch; it does not know which physical string/finger produced it. Higher positions, bow tracking and vibrato/duration assessment are deferred. See [the verified mapping and limits](./VIOLIN_FINGERBOARD.md).

**Ocarina:** Standard fingering visualization requires a specifically identified instrument/profile, tuning/system and authoritative chart. The exact profile remains deferred; there is no universal ocarina hole map. Alternate/cross fingerings can follow later.

**Voice:** Sung-pitch detection with note, octave, frequency/cents and stability; no speech recognition or fingering diagram.

**Shared visualization direction:** A detected pitch can show possible instrument locations; a target pitch can show how to produce it. Reuse pure instrument mapping and presentation separately from capture, first in Piece Practice and later in other approved consumers. No diagram claims to observe actual string/finger use.

**Dependencies/non-goals:** Physical support evidence and honest range/tuning labels. Worker/AudioWorklet processing is conditional on measured device problems. No universal microphone bus, automatic grading in other practice domains, polyphonic guitar/piano recognition or claim to infer actual fingering.

## 5. Acoustic Practice Integration

**Status:** PROVISIONAL ACOUSTIC PIECE PRACTICE IMPLEMENTED IN 2.9.0; broader support claims and later integrations remain evidence-gated.

**Purpose:** Make reliable microphone observations useful within the semantics of a specific practice activity.

**Current bounded consumer:** Owner-approved monophonic Piece Practice offers violin/ocarina metadata, explicit Start, deterministic fresh articulations, configurable cents tolerance, range/focus eligibility, separate acoustic reports and V2 paused recovery. Same-note reattack thresholds are provisional; both instruments use the same detector. No physical reliability claim follows from automated tests.

**Likely next milestone:** Physical repeated-passage, violin preflight/analysis, violin visualizer and lifecycle QA on desktop, Chromebook and Android, including the owner's He's a Pirate (easy), followed by separately approved verified ocarina profile work. Other consumers such as ungraded acoustic Free Play/live staff or stable single-note Flashcards still require their own acceptance decisions.

**Possible later integrations:** Violin scales and intonation practice, selected Sequences, Guided Studies and broader Piece Practice experiences.

**Dependencies:** Each consumer defines accepted observations, acquisition, freshness, repeated-pitch rearming, uncertainty, timing semantics, source attribution and octave ambiguity handling. Validate actual targets/passages, including range, simultaneous notes, ties and repeated attacks. Physical evidence gates reliability claims; this specific provisional Piece Practice grading slice is owner-approved while that QA continues.

**Non-goals:** Converting every frequency frame into MIDI NoteOn/NoteOff, inventing attack/release/velocity facts, coercing ambiguous estimates toward the expected answer, or applying identical gates to every mode. Continuous attack timing needs additional proof beyond stable-note recognition.

## 6. Core Practice & Authoring

**Status:** SUBSTANTIAL BASELINE COMPLETE; ROLLING TARGETED DEVELOPMENT.

**Purpose:** Improve established systems for demonstrated musical and user needs while preserving their ownership.

**Likely next milestone:** Address concrete findings from piano/tablet use and review the provisional Targeted Practice experience. Retain Sequence-owned right-hand, left-hand and hands-together scale support as a separately planned enhancement with explicit hands-together grading.

**Ownership:** Staff Builder owns score authoring; Piece Practice owns runs/evidence; Practice Sessions own reusable prescriptions/orchestration; Targeted Practice remains repair inside Piece Practice; Sequences own ordered/scale execution. Upper/Lower Staff Focus does not claim to infer a player's hand.

**Dependencies/boundaries:** Reuse existing helpers and native semantics. Broader evidence persistence/analytics are scoped by feature: Piece Practice runs already persist, while Melody and Practice Session runtime evidence remain transient. This is not a generic backlog lane or a new adaptive-coaching engine.

**Conditional extensions:** Deeper harmony/ear training, dedicated rhythm work, editor operations such as measure copy/paste, richer Melody material, playback timbres or interchange only when a concrete need warrants them. Existing triads/inversions, seventh arpeggios, score editing/playback and metronome foundations must not be relisted as missing. Instrument playback produces sound; instrument microphone support analyzes sound.

## 7. Product QOL / PWA / Accessibility

**Status:** SMALL CONTINUING LANE; near-term work can fit between major musical milestones.

**Purpose:** Improve reliability and access through justified navigation/mobile polish, accessibility and maintenance.

**Implemented milestone:** **PWA Update + What's New MVP** uses prompt registration, a nonblocking Reload/Later notice and explicit confirmed per-tab reload. Startup What's New collates known missed curated entries newest first and shows only newest for missing/unknown history. Browser-local acknowledgment preserves newer markers; several commits can form one product entry. No backend/account or runtime Git history is required. Installed-PWA/device evidence remains pending.

**Dependencies:** The MVP prevents automatic reload and always warns before feature-triggered Reload; it does not recover transient reports or unsaved/in-memory work after consent. Worker activation is shared but page reload permission is per tab. Legacy 2.8.7 clients cannot be protected retroactively; first-transition, two-tab cached-asset and installed/device QA remain release checks. Keep broader recovery infrastructure outside this lane unless separately justified.

**Non-goals:** Silent replacement of an active experience, one entry per Git commit, universal recovery infrastructure, or displacement of major musical milestones. Diagrams/meters need text equivalents, usable focus/zoom behavior and controlled announcements.

## 8. Physical QA / Supported-Device Evidence

**Status:** ONGOING CROSS-CUTTING LANE.

**Purpose:** Establish supported behavior from actual devices/instruments, alongside regression fixes.

**Likely next milestone:** Chromebook/Android microphone and installed-PWA testing; broader violin open-string/first-position, actual ocarina and sung-voice checks where appropriate. Keep existing piano/tablet, Targeted Practice, mobile-layout, accessibility, audio and persistence/recovery QA visible.

**Evidence categories:** Deterministic automated tests; synthetic browser evidence; owner-observed physical evidence; controlled device/instrument QA. The single successful violin observation does not establish range, octave reliability, device support or latency.

**Dependencies/boundaries:** Follow [TESTING.md](./TESTING.md), record tested conditions and failures, and gate only the claims/integrations those results support. Hardware unavailability does not automatically block unrelated musical development.

## Practical near-term direction

1. Instrument learning precedes Improv: calibration/analysis (violin Stage 1 implemented provisionally), then visualizers, then separately scoped Intonation Search/Practice Coach.
2. Small QOL work may fit between major milestones; PWA Update + What's New is implemented with installed/device QA pending.
3. Microphone Staff Builder authoring remains later than the instrument-learning stages; ocarina calibration requires an approved profile/chart.
4. Flow Sight-Reading remains a major practice milestone.
5. Guided Studies follows when the selected native activity contracts are mature enough for a useful first vertical slice.

This is a practical preference, not an immutable dependency chain. Physical QA and confirmed regression fixes continue alongside it. Detector research need not delay Improv/Flow, and Studies need only the capabilities selected for their first slice.

## Deferred owner decisions and exploratory boundary

When the relevant thread becomes active, choose the first Flow increment, the first D Minor Study objective/audience, and the exact ocarina profile/fingering system. No resolution is required during documentation consolidation.

Bounded scalar JSON export is now implemented; broader adaptive coaching, analytics dashboards, community/teacher sharing, cloud accounts/synchronization, desktop packaging, large instrument libraries and other advanced exports remain exploratory. [IDEAS.md](./IDEAS.md) holds noncommittal ideas. Future feature plans still require owner approval, exact scope, native ownership, musical decisions and proportionate validation under AGENTS.md.
