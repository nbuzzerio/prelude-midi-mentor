# Dev Log

A high-level release history and record of significant milestones. Unreleased records implementation and review work without asserting a release; dated/versioned sections retain their original history. Current package/application version is 2.9.1. Tagging, releasing and deployment verification remain owner-controlled; the older v2.7.0 candidate notes below are historical preparation.

## Unreleased

- Implemented owner-approved Stage 1A/1B/1D for patch 2.9.1: pure raw-frequency violin calibration, explicit G/D/A/E preflight isolated from practice timing/grading, immutable attempt revisions, and bounded scalar analysis with explicit version-1 JSON export. Analysis defaults On with a separate browser-local preference. Export includes actual-timestamp bins, diagnostic/calibration windows, target visits/capture segments, unchanged grading evidence and conservative summaries; it contains no audio or device identifiers. Limits/truncation preserve collected evidence without stopping practice. Existing detector/capture, V2/IndexedDB/Staff Builder schemas and mistake semantics are unchanged. No ocarina calibration, diagrams, mid-run recalibration UI, convergence scoring, dependency/lockfile change, tag or deployment. Roadmap now places instrument learning before Improv. Physical QA remains pending; see TESTING for owner procedure and synthetic size characterization.

- Implemented the owner-approved 2.9.0 Acoustic Piece Practice milestone: extracted the production monophonic core with tuner compatibility adapters; added target-independent deterministic acoustic attacks, repeated-note rearming, expected-center cents acceptance and pre-permission range/focus eligibility. Exclusive microphone ownership preserves MIDI/VKB behavior, suppresses feedback tones and pauses on capture interruption. V2 run records retain instrument/tolerance and separate scalar acoustic evidence, normalize V1 keyboard recovery and regenerate screen/copy/print reports. Added the October 6 What's New entry and deterministic extraction, onset, grading, eligibility, lifecycle, session, recovery and reporting coverage. A final review fixed completed-run reset creating an unnecessary save revision and preserved articulation continuity through explicit Next Measure. Physical violin/ocarina/device testing, including the owner's actual He's a Pirate (easy), remains pending; support and same-note thresholds are provisional. No raw audio, dependency/lockfile or Staff Builder schema change; no tag, release or deployment.

- Implemented PWA Update + What's New for patch 2.8.8: one prompt-mode boot registration, a narrow subscribed controller, visible/online discovery checks, Reload/Later and explicit per-tab confirmation/navigation. Worker callbacks and cross-tab activation never themselves reload new clients. Bundled curated ID/sequence records use defensive browser-local acknowledgment, newest-first missed updates and newest-only first use; the initial October 5 record describes only this feature. Added deterministic lifecycle, storage, modal/focus and App state-preservation coverage. Scope/fallback/piano precaching and all practice ownership/persistence remain unchanged. Legacy auto-updating 2.8.7 clients cannot gain protection remotely; first-rollout, two-build installed-PWA/device and cross-tab asset QA remain pending. No release/tag, backend, dependency or global recovery framework.

- Made existing Staff Builder tie authoring discoverable from selected notes/chords: visible Ties, initial single-pitch selection, per-pitch Tie In/Tie Out and unavailable guidance. Separated the existing barline split tool into its own disclosure. Same-measure/cross-measure compatibility, partial chord ties, chains, schema v4, playback and Piece Practice semantics are unchanged. Added focused control, 6/8 session/history/reopening and file round-trip regressions; manual browser/audio/MIDI QA remains pending. Advanced the package patch version to 2.8.7 under the approved policy; no tag or release asserted.

- Consolidated the owner-approved rolling roadmap and supporting documentation on October 5, 2026. Preserved implementation history, feature ownership, deferred decisions and pending physical QA; no feature, configuration or version change.
- Recorded one owner-observed successful real violin test of the implemented tuner as limited physical evidence. It is not controlled instrument/device validation; broader Chromebook/Android and violin/ocarina/sung-voice QA and harmonic/octave limitations remain outstanding.

- Added the owner-approved standalone Chromatic Tuner MVP with explicit microphone Start/Stop, main-thread AnalyserNode/MPM processing, sustained-pitch stabilization, note/octave/Hz/cents and an accessible responsive meter. Preserves uncertainty briefly, then clears stale readings; rejects weak/clipped signals and conservatively gates decay-related note changes. Handles permission races, interruption, foreground eligibility and cleanup, with a narrow active-run Practice Session notification. No MIDI, grading, practice integration, raw recording/upload, new dependencies or roadmap changes. Retained version 2.8.6 by owner instruction; Improv priority is preserved. Deterministic and desktop browser synthetic validation are separate from pending physical Chromebook/Android and violin/ocarina QA; octave ambiguity remains unresolved.

- Renamed the provisional Piece Practice "Improve" feature to "Targeted Practice" across UI, code, tests and active documentation, reserving "Improv" for a future improvisation mode. This terminology-only cleanup preserves behavior and version 2.8.6.

- Added the PROVISIONAL Targeted Practice MVP (formerly named "Improve") to completed Piece Practice runs: deterministic native-evidence recommendations, exact reasons, optional notation review, single-measure focused practice, guarded return to original results and original/latest completed count comparison. The provisional priority is mistakes, skips, deliberate restarts, then recorded hesitation, with original measure order breaking ties. Focused attempts retain the original score snapshot and Staff Focus and use existing grading, save acknowledgement and V1 recovery. Navigation/comparison links are in-memory only; no schema, database, dependency, MIDI or assessment changes. Kept version 2.8.6 by owner instruction; physical-device QA remains pending.

- Corrected tied-only rolled checks to require no new attack while preserving projected IDs/counts and V1 checkpoint validation. Recovery resolves legacy empty checks and durably saves runs previously blocked after their real checks completed. Isolated incomplete rolled collection by MIDI/virtual grading source while retaining completed parallel checks, physical evidence, Staff Focus optional input, and due timeouts. Kept version 2.8.6 by owner instruction.
- Corrected active score-highlight rectangles to enclose upper/lower ledger strokes, including displaced chord heads, using separate presentation bounds. Preserved editor hit-testing, touch targets, selections, notation geometry, and practice behavior. Kept version 2.8.6 by owner instruction.
- Tightened Piece Practice recovery selection, semantic Staff Focus guard classification, notation highlight layering, and durable Restart Measure reporting for the 2.8.6 cleanup.
- Added Phase 3 Piece Practice IndexedDB autosave and recovery with versioned score snapshots, ordered run revisions, paused clock rebase, focused-staff reconstruction, completed-report reopening, bounded retention, and failure warnings. Kept package version at 2.8.5 by owner instruction.
- Refined Phase 3 completion durability acknowledgement and unload protection, coalesced superseded active checkpoints without dropping terminal writes, and covered Staff Builder recovery entry directly.
- Corrected Piece Practice pitch grading for natural predecessor-key release overlap using an initial named 250 ms policy, immediate single-note acceptance, nonrenewing transition deadlines, and chord eligibility based on actual attacks rather than timer delivery.
- Added observational physical release evidence and optional browser source timestamps while preserving separate attack velocities, pitch-only held Set semantics, authored continuation/roll allowances, and CC64 independence.
- Made Piece Practice live feedback, completed results, Copy Report, and print/PDF note-name-first using existing authored/key-aware spelling. Added the default-off `Show MIDI details` option independently from velocity inclusion.
- Phase 3 retained package version 2.8.5 pending owner audit; the approved cleanup advances it to 2.8.6 without tagging or releasing.

- Added the permanent Phase 0 Raw MIDI Diagnostic mode with independent multi-input Web MIDI observation, length-tolerant decoding, browser-relative timestamps, a bounded 1,000-event history, pause/clear controls, and copyable diagnostic evidence without changing feature MIDI contracts or Piece Practice.
- Added accessible Practice Diagnostic Shorthand chips derived from engine-native evidence: Pitch, Identification, Hesitation, Retried, and Skipped, plus neutral numeric Melody Pitch/Movement/Timing metrics without new thresholds or grading semantics.
- Added compact Piece Library sorting by Recently Played, Recently Updated, or Alphabetical, backed by honest browser-local practice timestamps recorded only when a saved score successfully enters Piece Practice.
- Migrated Staff Builder library envelopes to schema v4 without fabricating history; score exports/imports and duplicates remain free of source practice recency.
- Added Ear Training’s mode-local sustain-pedal shortcut for the existing guarded Play Prompt action in standalone and hosted Practice Sessions.
- Corrected tablet Practice Session composition with intrinsic Note/Triad notation sizing, true hidden-keyboard space reclamation, bounded Melody Focus/Mobile Play layout, deliberate Melody replacement-score scrolling, and a stable target-complete decision overlay.
- Added the v2.8.0 Practice Session comprehensive completed report with authored-order outcomes, never-entered exercises, foreground-active time, prescribed/Bonus separation, engine-local diagnostics, and compact progressive disclosure.
- Reused Melody's existing diagnostic summary, mastery, interval, metric, and score-detail semantics rather than introducing a cross-engine score abstraction.
- Added configurable browser-native Practice Session report printing with accessible content options, ordinary browser pagination, compact Melody diagnostics, and reusable print lifecycle cleanup.
- Prepared v2.6.5 with sequential Staff Builder Lyric Cues authoring, browser-native Study View printing with measure ranges, and undoable measure deletion with safe tie and annotation cleanup.

---

## v2.6.0 — September 7, 2026

### Practice Sessions

- Added reusable named presets with ordered exercises, feature-owned configuration snapshots, explicit local Save, and Ready / Needs setup validation.
- Added direct configured launches across Flashcards, Sequences, Ear Training, and timed Melody practice, including Scale Repertoire in ordered or shuffled traversal.
- Added native completion targets, Practice Complete actions, Keep Playing / Bonus, Skip for Today, End Session, and an entered-only neutral summary.
- Added one-at-a-time exercise orchestration with immutable run snapshots while keeping active-run state and practice evidence memory-only.
- Added stable hosted Mobile Play continuity across prescribed exercise transitions while preserving standalone engine behavior.
- Expanded automated coverage across preset validation and persistence, builder recovery and editing, runtime transitions, stale-callback protection, engine contracts, and hosted Mobile Play lifecycle.

### Release Readiness

- Synchronized the visible application version and release documentation for v2.6.0 preparation.
- Kept Practice Session prescriptions browser-local with no accounts, cloud dependency, analytics, or persisted run history.

---

## v2.5.0 — September 3, 2026

### Piece Practice

- Added validation-gated practice projected directly from authoritative saved Staff Builder pieces.
- Added blocking score-position progression across both staves, rests, ties, same-onset polyphony, held-note allowances, start/restart controls, and MIDI/VKB source separation.
- Added independent normal and rolled checks at one onset, with expressive upward rolls evaluated in a tempo-relative 1.5-quarter-note-beat window.

### Staff Builder

- Added automatic derived same-staff polyphony, `.prelude.json` import/export, schema v3 migration/validation, and collision-safe import.
- Added score annotations, annotation layers, and multi-system Study View.
- Added full-piece, treble-range, and bass-range duplication.
- Added authored upward rolled/arpeggiated chords across editing, validation, notation, playback, persistence, and Piece Practice.

### Melody

- Added generated continuous one- and two-measure sight-reading with count-in/metronome, MIDI/VKB capture, alignment, and independent Pitch, Movement, and Timing results.
- Added continuous timed diagnostics, interruption-safe Session Review, targeted repair retries, immutable original evidence, and original-versus-latest comparison.
- Added interval analytics that keep Sight Read evidence separate from Repair evidence.
- Added a two-quarter-beat preparatory display lead-in and improved first-note alignment before authored and scored material.

### Mobile and Platform

- Coordinated explicit Mobile Play across supported modes while retaining one mounted session, MIDI owner, and virtual keyboard.
- Hardened Melody and Piece Practice mobile, focus, visibility, fullscreen/orientation, and offline-VKB behavior.

### Release Readiness

- Synchronized the visible application version with the canonical `package.json` version for v2.5.0 release preparation.
- Completed focused repository, documentation, automated-testing, PWA-configuration, and release-readiness cleanup.

---

## v0.1.0

### Project Foundation

- Project initialized.
- Migrated to a Vite + React + TypeScript architecture.
- Core documentation created.

### Flashcard MVP

- Built the initial responsive practice interface.
- Added bass, treble, and mixed clefs.
- Added randomized note generation.
- Added session statistics.
- Added a four-octave virtual piano.
- Added latest-answer highlighting.
- Added MIDI diagnostics.
- Replaced the original unsupported E-MU MIDI interface with a class-compliant USB MIDI interface.

### Musicianship Expansion

- Added accidentals.
- Added single-note and triad practice targets.
- Added major, minor, diminished, and augmented triads.
- Added root position, first inversion, and second inversion.
- Added simultaneous MIDI note detection with a grace period for rolled chords.
- Added virtual piano input alongside physical MIDI.
- Added sampled piano playback.
- Added configurable practice settings.
- Refactored the flashcard engine into feature hooks and reusable practice utilities.

### Current Focus

- v1.0 stabilization
- Automated testing
- Documentation refinement
- Initial public release

---

## v1.0.0

### Stable Flashcard Release

- Completed the generalized flashcard practice engine.
- Added single-note and triad practice.
- Added natural-note and accidental-note configuration.
- Added physical MIDI and virtual piano input.
- Added sampled piano playback and interface feedback.
- Added responsive PWA support and production deployment.
- Completed the initial automated testing and documentation baseline.

---

## v1.1.0

### Sequence Mode

- Added a dedicated melodic Sequence Mode.
- Added ascending and descending interval generation.
- Added configurable interval and note-category settings.
- Added ordered step validation and sequence retry behavior.
- Added MIDI-release-aware step and completion transitions.
- Added sequence completion statistics.
- Organized flashcard and sequence behavior into dedicated feature modules.

### Testing Expansion

- Added interval-generator tests.
- Added sequence validation and statistics tests.
- Added tests for all Sequence Mode hooks.
- Expanded the automated suite to 223 passing tests across 18 test files.

---

## v2.0.0

### Practice Platform

- Expanded Sequence Mode beyond melodic intervals with major and minor scales and arpeggio exercises.
- Added seventh-arpeggio practice and related Sequence settings improvements.
- Added the initial ungraded Free Play mode on an interactive grand staff.

---

## v2.1.0

### Chord Progressions

- Added playable chord progressions to Sequence Mode.
- Added curated Roman-numeral progression templates and deterministic triad realization.
- Added physical MIDI and persistent virtual-keyboard chord input with progression-focused practice controls.

---

## v2.2.0

### Key-Aware Free Play

- Added supported major and minor key contexts and visible key signatures to Free Play.
- Added key-aware diatonic spelling with Automatic, Prefer sharps, and Prefer flats chromatic controls.
- Added live respelling of held notes when notation settings change without clearing or replaying them.

---

## v2.3.0

### Melodic Interval Ear Training

- Released ascending and descending melodic interval identification.
- Added stable prompt/replay behavior, interval-name grading, session statistics, and mobile presentation.

---

## v2.4.0

### Staff Builder Foundation

- Added a learning-focused multi-measure score editor with MIDI and virtual-keyboard Capture Notes.
- Added direct score correction for rhythm, rests, ties, spelling, staff routing, key, and meter.
- Added score validation, guided corrections, score history, local project persistence, and distinct draft/validated saves.
- Added deterministic score playback and playback-follow visualization through the shared musical-event player.
- Added score-first notation controls, specialized radial controls, deterministic interaction geometry, and responsive mobile workflows.
- Released the Staff Builder foundation as the authoritative local score-authoring and project workflow.
# v2.7.0 candidate — historical preparation

These notes describe the earlier diagnostics candidate, not the current package checkpoint or a claim that v2.7.0 was tagged/released.

- Expanded Piece Practice completion into an attempt-local diagnostic report with chronological mistake evidence, accumulated measure time, slow-response evidence, expandable authored notation, problem filtering, and browser-print reporting.
- Added additive pitch anchors and red/amber diagnostic overlays while preserving Melody's event-highlight behavior.
- Excluded hidden-tab time from active practice timing and froze all attempt timing at completion.
