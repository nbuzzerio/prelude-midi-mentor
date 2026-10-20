# Prelude: MIDI Mentor — Rolling Roadmap

## Practice Rolodex Checkpoint C - pending owner review

Implemented against committed Checkpoint B `812b2472709a86c3d9d77110ffc9f2f53a9969b5`, keeping version 2.9.21. Today's Piano Lesson may supplement its unchanged authored fundamentals with one frozen, explicitly Piano-eligible A1 passage. Repertoire defaults off; preferences are independent, selection is deterministic, and incompatible/empty/unavailable collections do not block fundamentals. A1, V2 and Rolodex retain separate acknowledgements and Retry. Current-lesson screen/print feedback includes distinct repertoire evidence without a persisted lesson archive or mastery claim.

Checkpoint D (mastery, retention and historical coaching) is not implemented or authorized. Physical MIDI-piano timing/comfort acceptance remains an owner task; A1 thresholds remain provisional. No version, release, deployment or Git action is part of C.


**Practice Rolodex Checkpoint B — committed at `812b247`:** starts from committed A1 `b621843`, retains version 2.9.21, and adds manual saved passages, immutable full-source snapshots, explicit instrument eligibility, owner-controlled organization, separate acknowledged IndexedDB storage, versioned backup/import and Piano Practice Now through the unchanged A1 engine. Optional saved pitch-first recommendations remain explicit enrollment. Source edits/deletion never replace frozen music. Violin/Ocarina entries can be organized but have no executable Rolodex acoustic profile. Application storage ceilings are not browser quota guarantees. A1 physical-piano acceptance remains pending. Checkpoint C is separately authorized and described above; D (automatic mastery/retention) remains unauthorized.

> Authoritative product direction, instrument-learning priority updated by the owner October 7, 2026, with the six-phase Improv capture direction subsequently approved. A1's committed baseline is **2.9.21**, HEAD `9b08d467`; A1 working changes retain that version by explicit owner instruction. Earlier pending-checkpoint descriptions below are historical. Implementation, physical validation, deployment, and owner-controlled tagging/releasing are separate facts.

Prelude develops through eight continuing threads. This is a rolling roadmap, not a rigid sequence of phases or a delivery-date commitment. Major musical milestones, permanent product threads, small QOL work, conditional integrations, and physical QA can progress at different rates.

**Continuous-tempo Piece Practice A1** is implemented against committed **2.9.21**, HEAD `9b08d467`, with no package or What's New change. Owner review and real MIDI-piano acceptance remain separate from automated/browser validation. Saved Staff Builder pieces can launch a distinct MIDI-only, fixed-tempo passage: one to four complete measures, constant 3/4, 4/4 or 6/8, 40–120 quarter BPM, untimed Ready, meter-correct count-in, uninterrupted grand-staff following, onset/pitch results, acknowledged local attempts and exact frozen-range Replay. Unsupported incoming ties/rolled chords/notation are rejected; internal ties, rests, ordinary chords and simultaneous staves are supported. Pitch-first stays the default and retains its existing semantics. **Rolodex was excluded from A1; separately authorized Checkpoint B is described above.** No collection, automatic difficult-passage enrollment, lesson injection, retention/mastery model, duration/hand/fingering grade or acoustic continuous engine is included.

Pending **2.9.21 checkpoint 1** adds browser-local filename high-water marks and best-effort piece/report print titles. Counters share sanitized name/extension identities, retain manual edits, count successful native closure or ordinary download initiation, preserve higher numbers and stop automatic suggestions at 999. Storage problems leave exports usable; no disk inspection or guaranteed cross-tab uniqueness is claimed. All application-controlled print paths suggest `_001` through a temporary document title; actual PDF naming/saving stays browser-owned and PDF counters are not persisted. Checkpoint 1 has passed owner review and remains pending/uncommitted.

**Pending 2.9.21 checkpoint 2** has passed owner review and adds a violin-only, locally remembered ±1–30-cent calibration readiness slider with the unchanged ±10-cent default. Only stopped-state acceptance settings change; new v4 attempts record their effective tolerance while fixed v1/v2/v3 evidence, detector/stability gates, fixed tuning-quality bands and Piece Practice grading retain their meaning. Scalar schema 1 uses additive metadata without durable migrations. Physical violin/device QA remains separate; ocarina calibration remains unimplemented.

**Pending 2.9.21 checkpoint 3** adds a transport-synchronized playhead to saved Improv review using the existing indexed performance staff. Play/Stop, 12/6-second windows, 80% scrolling and 512-note rendering bounds remain. RAF moves geometry; archived queries remain at 10 Hz. Capture pause compression is reused once, and Stop/failure/completion retain the appropriate terminal position. Raw evidence, original Take 1, exports and live capture remain unchanged. This final checkpoint and combined release validation await owner review; no commits, releases or deployment are implied. Replay Pause/Resume, transcription, accuracy grading and Guided Improvisation remain outside scope.

Committed **2.9.20** implemented the separately approved Preferred Export Folder workflow. Settings → Exports remembers an opaque directory handle in independent browser-local IndexedDB and exposes explicit selection, access renewal and forgetting. Supported secure browsers can use native Save As with the filename preview and preferred starting folder; normal downloading stays available and no fallback is automatic. Saved requires successful stream closure. The owner explicitly accepts that native replacement confirmation can truncate an existing target before Prelude writes, so failures/abort cannot promise restoration; the interface and documentation disclose that risk. All six existing exports retain their original Blob bytes, schemas, recording ownership and evidence. Settings does not remount active musical hosts. PWA/vendor/lazy boundaries and browser-controlled Print / Save as PDF remain intact. Automatic suffix counters were excluded from that historical checkpoint and are now covered by the pending 2.9.21 checkpoint above.

Committed **2.9.19** introduced app-controlled score/MIDI/JSON/microphone filenames as `sanitized_name_001.extension`. That historical checkpoint allowed manual Name/Number edits, started at 001 each time, reserved 000 and accepted 001-999 without an automatic counter. Unicode spelling, immutable exported bytes, native audio containers and actual take/segment identities remain intact. Staff Builder retains `.prelude.json`; clipboard and report content remain separate. Normal downloads are requests, not confirmed saves, and temporary audio still requires explicit discard. Committed 2.9.20 added optional preferred folders; pending 2.9.21 adds counters and print-title suggestions above.

Committed **2.9.18** is an internal bundle optimization: one statically loaded VexFlow vendor chunk preserves eager notation, embedded fonts, feature ownership and existing lazy Improv/Study View boundaries. Historical main/vendor sizes are **975,880 / 1,119,962 bytes**, with **1,121,272 / 977,190 bytes** of per-file headroom and all application chunks in the unchanged PWA precache strategy. No startup speed claim or new What's New notice is made. Subsequent additions require actual production artifact checks.

## Implemented baseline

The following systems exist today. Pending physical QA does not make their implementation a future commitment:

| System | Implemented capability and boundary |
| --- | --- |
| Flashcards | Single notes and major/minor/diminished/augmented triads, triad inversions, clefs, natural/accidental filters, MIDI/VKB input, feedback and statistics. Natural-note-only selection already exists. |
| Sequences | Ordered melodic intervals, major/minor/pentatonic scales, arpeggios including sevenths, curated major/minor triad progressions, theory-aware spelling, temporal measure presentation, and ordered/shuffled Scale Repertoire. |
| Improv | Physical-book first-take sight-reading and free improvisation, selected physical MIDI capture, named local histories, approximate replay and downloads. Optional temporary room audio is committed in 2.9.14; committed 2.9.16 adds rolling performance staff/review; committed 2.9.17 adds same-take coordinated Pause/Resume with musical-time compression and preserved raw continuity evidence. No accuracy grading or virtual-keyboard capture. |
| Free Play | Ungraded live MIDI/VKB grand-staff notation, key signatures, key-aware spelling, and held-key presentation. No automatic key/chord analysis or phrase history. |
| Ear Training | Ascending/descending melodic-interval identification, explicit replay, statistics, and pedal-to-Play-Prompt. Other aural tasks remain future work. |
| Melody | Seeded monophonic one/two-measure 4/4 reading, count-in/metronome, continuous capture, nonblocking performance, alignment, separate Pitch/Movement/Timing results, timed review and repair. Evidence is memory-only; sustained Flow remains future work. |
| Staff Builder | Application-owned score authoring, notes/chords/rests/rhythm/ties/context/annotations, capture and correction, derived polyphony, playback, local library/drafts, validated Save, score import/export, duplication, Lyric Cues, display clefs, and printable Study View. Committed 2.9.15 adds direct library Study View and a transient editing lock. Study View is score presentation, not Guided Studies. |
| Piece Practice | Default blocking pitch-attack practice, excerpts, Staff Focus, ordinary/rolled checks, diagnostics, reports and existing IndexedDB recovery. A1 adds a separate physical-MIDI continuous-tempo owner for one-to-four-measure saved passages, fixed musical time, pitch/onset assessment, bounded acknowledged attempts and frozen-range Replay. Physical piano acceptance is pending. |
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

Stage 1A/1B/1D is implemented provisionally from 2.9.1: violin G3/D4/A4/E5 preflight (now short-pluck calibration policy v3) plus transient bounded scalar JSON export. Local performance recording is implemented for violin/ocarina in 2.9.4 and piano MIDI in committed 2.9.5. Stage 2 violin first-position guidance is committed in 2.9.6 through presentation-only instrument pitch context; committed 2.9.7 keeps playing feedback and notation high. Committed 2.9.8 adds the [Standard 12-hole Alto C provisional fingering profile](./OCARINA_FINGERING.md), limited to thirteen supplied natural concert pitches, with independent expected/live guidance. Physical threshold/device and diagram QA remain pending. The suspected Huazzzyi ZO-1's manufacturer chart and subhole layout are still unverified; manufacturer-specific/chromatic additions and ocarina calibration remain deferred. Intonation Search/Practice Coach requires a separate approved learning-semantics plan; current mistake semantics are unchanged. Microphone Staff Builder authoring remains behind the instrument-learning stages. The numbered continuing threads below are not a strict delivery order.

## 1. Improv / Creative Exploration

**Status:** PHASES 1-7 AND PAUSE/RESUME COMMITTED THROUGH 2.9.17. Usable MIDI workspace; room-audio hardware QA remains pending. Permanent creative thread.

**Purpose:** Help players invent, explore, compare and develop musical ideas. Free Play observes and helps understand what is played; Piece Practice helps learn existing music; Guided Studies teach concepts; Improv supports invention and experimentation.

**Approved direction:** First-attempt sight-reading from physical books and free improvisation, sharing capture infrastructure. Intentional pauses are a normal convenience within one take and do not invalidate first-take identity. Physical scores need not be entered into Staff Builder. Without a reference score, review is descriptive and never invents note/rhythm accuracy grades.

| Phase | Scope and current status |
| --- | --- |
| 1. Raw MIDI Capture Foundation | Committed in 2.9.9: copied raw bytes, browser/receipt timing, delivery order, source metadata/availability and optional raw-source selection through the existing owner. Current normalized consumers remain unchanged. |
| 2. Performance Journal | Committed in 2.9.10: React-independent one-take controller, immutable unquantized evidence, explicit boundaries, source/clock continuity, interruption, bounded prefix retention and take-local watermark reads. Memory-only journal; no browser lifecycle listeners or UI mounted. |
| 3. Persistent Local Take Library | Committed in 2.9.11: separate versioned IndexedDB library, named pieces/improvisation sessions, atomic first-take/number allocation, immutable chunks and committed watermarks, explicit confirmed deletion/tombstones, silence checkpoints, bounded failed-save backlog and lease-fenced incomplete recovery. The engine has no UI; Phase 5 supplies the library screen. Browser-local retention is not guaranteed permanent. |
| 4. Playback and Exports | Committed in 2.9.12: separate bounded receipt-timing projection and descriptive metrics; versioned collection JSON backup/atomic fresh-history restore preserving original provenance/numbers/tombstones; type-0 MIDI file projection; explicit velocity-sensitive sampled piano replay with channel-aware FIFO releases and conventional sustain. Phase 4 engines now have Phase 5 workspace integration; physical audio/MIDI-file consumer QA remains pending. |
| 5. Improv Workspace | Committed in 2.9.13: physical-input selection, playing-first live grand staff/timer, explicit take/save states, interruption and departure protection, named numbered histories, confirmed deletion/recovery, approximate replay, MIDI download and full collection JSON backup/restore. No score or grading required. Owner reports completing five initial physical-piano workflow checks; this is not room-audio fidelity evidence. |
| 6. Optional Room Audio Recording | Committed in 2.9.14: explicit opt-in/default microphone preparation, native temporary audio recording alongside MIDI, independent finalization, local preview/download, one-result retention/discard and departure protection, conservative interruption and bounded cleanup. No permanent audio storage or JSON inclusion. Approximate browser alignment; physical microphone QA remains pending. |

Committed **2.9.16** adds a bounded rolling grand staff for accepted MIDI and immutable saved-take review. A blue elapsed-time playhead, unquantized attacks and key-down trails retain recent phrases through release/silence; 12-second desktop/6-second narrow windows scroll at 80%. Notes outside written C2-C6 use labeled octave displacement with actual pitch names. Live detail is bounded to 4,096 retained intervals/512 rendered notes; complete accepted evidence stays in the existing journal/store. Saved review supports keyboard-accessible time-window navigation and preserves original Take 1. This is performance visualization, not rhythmically validated sheet music. Replay remains independent. Transcription, old-piece return, analysis and score generation remain deferred; physical piano/room-acoustic QA is separate.

Committed **2.9.17** implements bounded coordinated Pause/Resume for both activities. The musical timer/staff freezes, native optional audio pauses, and Resume keeps the same take/number after durable control authorization and safety revalidation. Raw paused MIDI remains version-2 JSON continuity evidence, while review, replay, metrics and MIDI files exclude intentional breaks/context-only notes. Record/backup versions extend without an IndexedDB migration and preserve version-1 takes. Stop while paused/transitioning closes the take without inventing Resume. Independent microphone failure continues healthy MIDI with a visible audio warning; unsafe coordination ends the take conservatively. Paused time/messages remain subject to existing resource limits. Audio stays temporary, excluded from JSON/storage and approximately timed. No app-wide filename/folder convention is included. Hardware, other-browser and assistive-technology QA remain separate.

Phase 6 was limited to temporary room audio; broader Flow Mode and composition analysis require separate implementation approval. Selected-device loss, owner loss or background interruption ends a take; return requires an explicit new take, never silent resume. Start registration allocates Take 1 even when empty/interrupted; canceling before Start does not allocate. Allocation commits serialize across tabs; failed initial registration cannot reserve a durable number until retry commits. Deleting the first take never promotes another take or reuses a number. Full CC64 values remain raw evidence; replay approximates sustain at CC64 ≥ 64 without realistic half-pedal acoustics. JSON restore creates a distinct collection, never merges into or overwrites the original first attempt. Key/scale context can aid display; it never corrects, transposes or discards captured notes. Harmony coaching, composition analysis and broader Flow remain later work.

**Dependencies:** Existing theory, spelling, notation, input and playback where their semantics fit. Microphone support is not a prerequisite.

**Later direction:** Chord/progression context, motif development, idea capture and eventual support for composing material for MACEDON. The former Composer Sandbox belongs to this longer-term direction rather than a competing major product.

**Non-goals:** A DAW, broad production tooling or a renamed Free Play experience.

## 2. Continuous / Flow Sight-Reading

**Status:** A1 AUTHORED-PIECE CONTINUOUS PRACTICE IMPLEMENTED; OWNER PHYSICAL ACCEPTANCE PENDING. SUSTAINED GENERATED FLOW REMAINS FUTURE WORK.

**Purpose:** Support reading ahead, maintaining pulse, continuing through mistakes and sustained reading beyond short trials, with review after a passage/session rather than constant stops.

**Next authorized boundary:** Stop after Practice Rolodex C implementation, validation and review export. D requires separate authorization. Longer generated reading and an uninterrupted generated stream remain deferred alternatives; A1 does not redefine Melody's existing timed Reading Flow.

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

**Status:** TUNER MVP COMPLETE; VIOLIN FIRST-POSITION GUIDE COMMITTED IN 2.9.6; PROVISIONAL STANDARD OCARINA GUIDE COMMITTED IN 2.9.8; permanent thread.

**Purpose:** Connect a detected or target pitch to useful instrument guidance while preserving measurement uncertainty.

**Likely next milestone:** Physical QA of violin preflight/analysis, the first-position guide and the provisional ocarina guide; verify the owner's actual ocarina booklet and physical subhole layout before manufacturer-specific additions. The standalone tuner remains independently owned; no separate instrument tuner apps are required.

**Conceptual architecture, not implemented global services:**

```text
AudioSource → MonophonicPitchAnalyzer → normalized pitch observation → consumer
AudioSource → future PolyphonicAnalyzer → chord / multi-note observations
```

Potential monophonic consumers include Tuner, instrument visualization, acoustic Free Play, Studies, scales and other eligible activities. Acoustic Piece Practice is now a real consumer of the shared monophonic implementation, with independent capture ownership; preserve room for a separate future polyphonic path.

**Violin:** 2.9.6 shows a recommended string/fingering, selectable open/fourth-finger alternatives, optional score-spelled stickers and independent expected/live possible positions. The schematic models offsets 0–7 per string using proportional vibrating length. Prelude measures pitch; it does not know which physical string/finger produced it. Higher positions, bow tracking and vibrato/duration assessment are deferred. See [the verified mapping and limits](./VIOLIN_FINGERBOARD.md).

**Ocarina:** Pending 2.9.8 implements the owner-supplied common **Standard 12-hole Alto C — provisional profile**, limited to thirteen natural concert pitches A4–F6. Manufacturer chart, model and physical subholes remain unverified; there is no universal ocarina hole map. Unsupported chromatic notes show unavailable guidance. Manufacturer-specific/alternate/cross fingerings require separate verified evidence; calibration remains deferred.

**Voice:** Sung-pitch detection with note, octave, frequency/cents and stability; no speech recognition or fingering diagram.

**Shared visualization direction:** A detected pitch can show possible instrument locations; a target pitch can show how to produce it. Reuse pure instrument mapping and presentation separately from capture, first in Piece Practice and later in other approved consumers. No diagram claims to observe actual string/finger use.

**Dependencies/non-goals:** Physical support evidence and honest range/tuning labels. Worker/AudioWorklet processing is conditional on measured device problems. No universal microphone bus, automatic grading in other practice domains, polyphonic guitar/piano recognition or claim to infer actual fingering.

## 5. Acoustic Practice Integration

**Status:** PROVISIONAL ACOUSTIC PIECE PRACTICE IMPLEMENTED IN 2.9.0; broader support claims and later integrations remain evidence-gated.

**Purpose:** Make reliable microphone observations useful within the semantics of a specific practice activity.

**Current bounded consumer:** Owner-approved monophonic Piece Practice offers violin/ocarina metadata, explicit Start, deterministic fresh articulations, configurable cents tolerance, range/focus eligibility, separate acoustic reports and V2 paused recovery. Same-note reattack thresholds are provisional; both instruments use the same detector. No physical reliability claim follows from automated tests.

**Likely next milestone:** Physical repeated-passage, violin preflight/analysis, both instrument guides and lifecycle QA on desktop, Chromebook and Android, including the owner's He's a Pirate (easy), followed by separately approved manufacturer-verified ocarina profile work. Other consumers such as ungraded acoustic Free Play/live staff or stable single-note Flashcards still require their own acceptance decisions.

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

When the relevant thread becomes active, choose the first Flow increment and the first D Minor Study objective/audience. The owner has approved the provisional standard ocarina profile for 2.9.8; exact manufacturer verification and chromatic additions remain future decisions.

Bounded scalar JSON export is now implemented; broader adaptive coaching, analytics dashboards, community/teacher sharing, cloud accounts/synchronization, desktop packaging, large instrument libraries and other advanced exports remain exploratory. [IDEAS.md](./IDEAS.md) holds noncommittal ideas. Future feature plans still require owner approval, exact scope, native ownership, musical decisions and proportionate validation under AGENTS.md.

## Staff Builder quality-of-life (committed 2.9.15; historical validation)

Implemented for owner review: saved-piece entries open the existing full-sheet Study View directly from a parsed saved snapshot without editor/draft/save/practice side effects. Session-only Lock Editing fences score and pending-pitch mutations, including physical MIDI, virtual keys, pedal commit, notation/rhythm/context/measure/annotation/tie commands and Undo/Redo. It preserves pending edits/history, starts each newly opened editor unlocked, and leaves other modes and MIDI connection available. Existing library-return confirmation and draft recovery remain authoritative.

Scope ends at these two improvements. Improv rolling notation, Pause/Resume, Returning to an Old Piece and musical analysis remain separate work. No schema, grading, recorder, microphone or tuner change. Physical MIDI timing/pedal QA and assistive-technology/browser-zoom validation remain pending; local automated and simulated browser evidence is recorded in TESTING.md.

## Practice Sessions 2.0 checkpoints (foundation pending review)

1. **Weekly program foundation implemented for review:** independent schema-2 reusable pool, strict import, tested AI/example contract, explicit browser-local definition save, immutable revisions and saved-definition preview. The existing schema-1 daily prescription system stays intact. Working package remains 2.9.21; release version reconciliation is separate from this checkpoint.
2. **Next dependent checkpoint:** flexible daily pool selection and repeated execution, preserving stable exercise identity separately from attempt identity. Rotations remain recommendations; missed days impose no mandatory work.
3. **Then:** persisted attempts with exact program revisions/native snapshots, coverage separately from genuine engine measurements and meaningful comparisons across comparable attempts. Weekly history/grades are not implemented today.
4. **Later:** independently approved, ungraded Guided Improvisation reusing existing capture/replay safeguards. It is not a prerequisite for weekly practice.

Explicit “Import as separate program”, deletion/pruning and program-definition export/backup remain owner decisions for a later checkpoint. The foundation rejects conflicts rather than cloning or clearing data implicitly. [The schema-2 contract](WEEKLY_PROGRAM_V2.md) documents limits and compatibility.

## Practice Sessions 2.0 — Checkpoint 2 pending review

Flexible daily subset selection/order/editing, advisory rotations, native execution, fresh repeats, deliberate selection skips and basic durable attempt history are implemented for owner review. The definition foundation remains separate and intact; v1 imports and daily presets do not migrate. Current/week-date selection shows durable attempts, completed/incomplete work, skips and optional frequency/coverage goals. Missing days remain neutral.

Checkpoint 3 can add defensible comparisons using exact revision/configuration/policy snapshots and native prescribed-boundary summaries. It must distinguish MIDI/virtual/simulation and unknown provenance, and keep coverage separate from quality. Stored summaries are not full performance journals and cannot support invented retroactive metrics. Guided Improvisation remains later and independent. Definition cloning, deletion/pruning/history export/backup and retention management remain owner decisions; no silent deletion or cloud sync exists. Version remains working 2.9.21 pending separate owner reconciliation; staged What's New is unchanged.
