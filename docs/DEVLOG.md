# Dev Log

A high-level release history and record of significant milestones. Unreleased records implementation and review work without asserting a release; dated/versioned sections retain their original history. Current pending package/application version is 2.9.8; 2.9.7 is committed at e4af89d. Tagging, releasing and deployment verification remain owner-controlled; the older v2.7.0 candidate notes below are historical preparation.

## Unreleased

- Implemented the owner-approved bounded 2.9.8 ocarina fingering guide after rechecking clean committed 2.9.7. The immutable **Standard 12-hole Alto C — provisional profile** maps exactly thirteen supplied natural concert pitches and twelve logical holes, independent of SVG coordinates. FRONT finger/subhole and BACK thumb diagrams, text states, derived instructions and separate fresh live suggestions use the existing presentation context/companion layout. Unmapped pitches retain authored spelling with unavailable diagrams; no cross-fingerings or automatic transposition. The actual Huazzzyi chart/model/subhole layout remain unverified. Profile details/references start collapsed; recording/details/export stay below playing. A scoped 320px correction removes classic-scrollbar overflow. Model/component and mounted session regressions preserve grading, acknowledgment, single capture ownership, recording finalization/download, analysis and reports. Local headless Chrome passed 14 layout/keyboard/accessibility/native recording scenarios; six focused suites passed 189 tests and full `pnpm verify` passed 235 test files / 3,073 tests plus lint/type-check/build. Actual zoom, assistive technology, real devices/instrument and recording fidelity remain owner QA. No calibration, detector, timing, MIDI, Run V2/IndexedDB or export changes; no tag/release/deployment asserted.

- Added the owner-approved bounded Piece Practice layout cleanup for pending 2.9.7 after verifying 2.9.6 was committed and the worktree clean. Compact header/progress and large pitch feedback precede the central notation/violin workspace; essential listening buttons use the Expected panel, with recording/details/export below. Compact recording/temporary-audio notices remain near the playing area. The violin guide already used physical semitone geometry; this pass enlarges its first-position region and crops unused string length, preserving the same fractional transform for landmarks and markers. String/sticker/alternate options use a native disclosure. No grading, calibration, capture/recording ownership, MIDI, export or persistence changes. Physical device/zoom and audio fidelity QA remain separate.

- Completed the resumed violin-only first-position visualizer for pending 2.9.6, preserving the previously extracted pitch context and 2.9.5 recording integration. The supplied beginner profile covers all four open strings and offsets 0–7, with open/fourth-finger alternatives, explicit string assumptions, optional score-spelled stickers and proportional continuous-string geometry. Expected and live possible positions have separate shapes and text; stale, uncertain, absent, unsupported and conservatively flagged harmonic readings have no live marker. Desktop companion/mobile stacked presentation preserves large playing feedback and audio controls. No capture, calibration, grading, duration assessment, persistence, recording or evidence schema changes. Mapping references were supplied by the owner; no additional network research. Ocarina awaits a verified manufacturer chart. Physical instrument/device QA remains pending.

- Extended optional local performance recording to piano keyboard/MIDI Piece Practice for pending 2.9.5. Explicit default-Off opt-in acquires a recording-only room microphone adapter, without an AudioContext, pitch detector or grading input. It reuses the native recorder, independent segments, budgets, playback/download and audio-loss guards. MIDI ownership, note/pedal handling, calibration, grading, timing, scalar JSON, reports and Run V2 remain unchanged. Pause/interruption finalize and release tracks; resume requires an explicit recording action. Strict Mode owners share effect lifetimes, and late grants are released. Piano segments have room-microphone source and no fabricated analysis ID. Headphones/VKB limits and final-note cutoff are explicit. Physical piano/device fidelity QA remains required.

- Implemented optional local performance recording for violin and ocarina Piece Practice in 2.9.4. Default-Off native MediaRecorder borrows the sole capture stream, excludes violin preflight, keeps independent playable/downloadable segments in memory, and guards run replacement and mode departure. Recording status and temporary-audio warnings stay visible outside the collapsed segment list. Native format probing, asynchronous final chunks, a 20-minute duration stop and a soft 16 MiB budget leave ordinary practice operational on error. Existing final-note capture cutoff remains; audio may omit its tail. Grading, calibration, timing, scalar JSON, reports and Run V2 schemas remain unchanged. Real-device fidelity, background interruption, downloads and mobile-loss warning QA remain required.

- Implemented the owner-authorized focused Piece Practice UX cleanup for patch 2.9.3. Range-aware current/total/remaining measure progress sits beside large playing pitch fields. Live microphone signed cents/direction and detected frequency are distinct; historical grading evidence is labeled Last graded attempt and Detected frequency at graded attempt in collapsed Practice Details. One session-owned 1.2-second checkmark acknowledgment names the just-accepted target from existing completed pitch/attack evidence, survives advancement, replaces rapid/repeated-note acknowledgments and clears on pause/restart/exit/new run/unmount. It never asserts written-duration success or colors the next target green. Completion summary/statistics and Generate/Copy Report precede collapsed measure results, microphone attacks, Targeted Practice and per-measure details; returning to a recommendation restores visible focus. Analysis display defaults closed without affecting collection, preference or JSON export; transient-data/storage notices remain visible. Grading, calibration policy v3, MIDI semantics, timing, V2 persistence, reports and scalar schemas are unchanged. Recording is research only; see [the separate recording handoff](./PIECE_PRACTICE_RECORDING_HANDOFF.md). Physical instrument/device and assistive-technology QA remain required.

- Corrected beginner violin calibration acceptance for pending patch 2.9.2: policy v3 accepts a qualifying robust median within 10 cents inclusive. The ideal region is within 5 cents (Excellent / centered), greater than 5 through 10 is Ready for practice, greater than 10 through 25 is Adjust tuning, and beyond 25 is Significantly off. These regions describe approximate tuning independently of certification. The short-pluck collector, 50 ms guard/four usable observations, compatible repeated-pluck evidence, 1.2-second confirmation, bypass and fresh-onset practice boundary are unchanged. Practice Forgiving remains 40 cents; calibration never reads that selector or offsets grading targets. Exports preserve v2's original 20/40-cent policy definition and recorded attempts alongside v3 metadata, with no retrospective reclassification or JSON schema change. Boundary/UI/controller regressions cover the observed +5.50/-18.64/-19.49-cent cases and retuning; physical QA remains required.

- Implemented owner-approved beginner violin preparation for patch 2.9.2: Start Listening once, pluck/read/adjust/pluck again, with no Retry or mandatory bow hold. Default policy v2 uses a 50 ms acoustic attack guard, at least four usable raw observations spaced at least 25 ms apart, and at least 90 ms of observed within-candidate coverage (adjacent gaps at most 100 ms). A median of estimates within 20 cents of the candidate center must have P90-P10 spread at most 25 cents, median absolute deviation at most 12 cents, and agreement from at least 75% of the last eight eligible estimates. Compatible evidence can accumulate across plucks for at most three seconds and 24 retained observations; quiet/inter-candidate gaps do not count as qualifying coverage. Two compatible observations displaced more than 20 cents replace the old candidate rather than averaging a tuning adjustment. A 6 dB level rise, quiet boundary, or callback gap starts a new acoustic candidate, without claiming a particular physical technique. Repeated octave/harmonic ambiguity clears candidates; every usable sample must be in the expected fundamental region (within 100 cents) and pass unchanged analyzer eligibility. A4 remains 440 Hz. Beginner colors/acceptance are ready within 20 cents, worth adjusting through 40 cents, significantly off beyond 40 cents; these are provisional preparation defaults, independent of Piece Practice tolerance.
- A completed green beginner measurement commits immediately and remains confirmed through silence; the 1.2-second acknowledgment requires no further sound. Fresh next-string evidence additionally waits for an observed quiet boundary or a new level rise, excluding an unchanged ringing tail. Stop/interruption preserves committed strings and pauses the transition. Live raw estimates remain independent of calibration; historical readings retain their labels and deviation colors. Short rejected acoustic candidates retain an honest readable explanation after decay. The fixed calibration layout retains 50 px note displays and replaces sample-count instructions with beginner plucking guidance. **Skip Calibration and Start Practice** skips all remaining baselines while preserving accepted strings and the unchanged fresh quiet/onset grading boundary. The version-1 scalar JSON structure is retained, with policy v2 metadata and an additive precise-policy definition; no raw audio, persistence, detector, grading, MIDI/VKB or ocarina calibration changes. The old precise collector remains available through the internal policy API, without a new settings screen. Deterministic controller-to-React tests do not establish physical success: real G3/D4 pluck capture, weak decays, harmonic errors, tablet readability and first-target rearticulation still require owner QA.

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


### Live acoustic calibration and pitch presentation (owner review, version unchanged)

Violin preflight continuously reassesses fresh raw-frequency stability windows, including after yellow/red and green readings. Leaving the green band, uncertain/invalid input, stale evidence, or capture interruption cancels acknowledgment; the existing settling, window, stability, and tuning policies still apply. String choices commit only on acceptance, Skip String, or explicit Continue (Retry remains optional). Calibration never grades Piece Practice targets. Ocarina currently has microphone practice but no calibration profile; a future profile can use the continuous assessment flow.

Both microphone instruments show the current authored target and live detected pitch at 64 px, with 24 px frequency and expected-relative signed cents/direction. Cards stack below the medium breakpoint and sit side by side above it. Live feedback has no screen-reader live region; discrete grading evidence remains separate. Stopped, uncertain, absent, and stale readings are not shown as current pitches.


### Violin calibration dropout repair (owner review, version unchanged)

Physical testing exposed a reset loop: each unusable or reacquiring tracker frame discarded the raw stability window, raw excursions beyond 5 cents reset green, and the display watchdog erased frequency after 120 ms. Calibration now evaluates fresh, quality-gated raw observations independently of the shared tracker state. Settling remains 200 ms; valid windows require at least 20 samples across at least 800 ms, with unchanged spread, drift, A440, fundamental/harmonic checks, and 5/15-cent tuning bands. Sampling can span up to 1000 ms to accommodate omitted frames, with no usable-sample gap longer than 160 ms. Invalid and ambiguous samples are never included.

The acoustic owner accumulates 900 ms between successive qualifying green observations. Brief rejected observations pause accumulation; more than 160 ms without qualifying green cancels the candidate. Acceptance requires a fresh qualifying green observation, never held display data. Capture interruption cancels confirmation and resets sampling while retaining committed choices. A new string clears held feedback.

Preflight keeps the current string's last reliable note/Hz/cents visible and labels it Live, Last heard, or Uncertain. The last stable assessment remains visible while new evidence is collected. No schema, shared detector, practice grading, version, or ocarina calibration changes. Interrupted-sequence regressions cover these rules; successful physical bowing still needs owner validation.


### Immediate green acceptance and stable preflight presentation (owner review)

A valid completed green stability window now commits its baseline and supporting samples immediately. The former extra 900 ms of qualifying green microphone evidence prevented otherwise useful strokes from completing. Sampling, 200 ms settling, minimum 800 ms span/20 samples, existing bounded dropout handling, raw spread/drift and 5/15-cent A440 tuning bands remain unchanged.

Acceptance advances the committed session once and holds the accepted string's measurement on screen for 1200 ms; observations during that acknowledgment cannot answer the next string or revoke acceptance. The acknowledgment is presentation only. Stop/interruption pauses it with the committed choice intact and never restarts capture. An explicit Start Listening resumes the presentation; only after it completes are fresh next-string observations evaluated. Guarded callbacks prevent double advancement.

Preflight keeps fixed measurement rows, assessment/summary/guidance/confirmation areas and controls. Numeric presentation updates at most five times per second. Transient failed readings are held as Last heard; uncertainty requires 300 ms of sustained presentation evidence, with a 600 ms status hold/recovery policy. Last reliable and last stable readings remain available; held readings never constitute new acceptance evidence. Numeric fields have no live announcement region; committed acceptance is announced once. Physical violin behavior remains for owner validation.


### Calibration hierarchy polish (owner review, version unchanged)

Violin preflight now leads with detected and expected notes at 50 px, followed by frequency and signed deviation. Detected Hz includes the same flat/sharp/centered direction as the cents display. Persistent secondary status, guidance, stable evidence, and acknowledgment areas retain their reserved space. Green reads In tune (within 5 cents), yellow Fine-tuner range / small adjustment (through 15 cents), and red Needs larger retuning (beyond 15 cents); these provisional communication bands do not change measurement or acceptance policy. Retry is removed from the presentation because listening already evaluates subsequent measurements automatically; Skip String and explicit Continue remain. No acceptance-state, detector, practice display, or version changes.


### Responsive live violin preflight evidence (owner review, version unchanged)

Preflight previously suppressed usable raw frequencies outside the calibration fundamental region, treated tracker acquisition as display uncertainty, and offered no analyzer-based explanation when only historical Hz remained. Presentation now uses fresh usable raw detector estimates independently of tracker stabilization and calibration acceptance, preserves their actual octave, and labels retained values Last heard (including sustained uncertainty). The existing watchdog publishes numeric feedback at most five times per second; status explanations debounce for 300 ms and hold for 600 ms without delaying numeric updates.

Persistent guidance distinguishes detected signal, quiet input, clipped/aperiodic/low-periodicity/out-of-range/invalid estimates, stalled audio clocks, and missing analysis callbacks. After 1500 ms of observed audible input without acceptance, bounded scalar evidence and existing window statistics explain insufficient samples/coverage, pitch variation, harmonic ambiguity, absent analyzable pitch, or stable tuning outside green. Reasons hold for at least 1200 ms. These presentation statistics are never acceptance evidence; last stable assessments remain separate from live Hz. The 50 px notes, existing stability/tuning/harmonic policy, immediate green commitment and hands-free acknowledgment remain unchanged. Controller-to-React regressions cover an unstable several-second D4 stroke with visibly changing Hz/cents and no calibration or practice acceptance. Real microphone/instrument QA remains required.


### Independent tuning colors and qualifying calibration progress (owner review, version unchanged)

The inspected live path already used usable raw estimates without tracker stabilization or an 800 ms window. The shared analyzer emits null frequency for rejected aperiodic/low-periodicity frames, so ongoing signal can leave a historical Hz value unchanged. The reported -64.7-cent D4 estimate also lies outside the unchanged 50-cent fundamental region and cannot participate in certification. This does not establish why a real bowed D4 signal was rejected; shared detector investigation remains for owner review with physical evidence.

Pitch deviation is now colored independently of certification: green within 5 cents, yellow through 15 cents, red beyond 15 cents. Bands are labeled approximate estimated guidance; historical numbers explicitly say Last heard / not verified. Certification separately reads Collecting, Insufficient evidence, Uncertain, or Accepted, with skipped/continued warnings retained in the summary. Main calibration notes remain 50 px.

A read-only collector progress view exposes actual participating post-settling sample count and the timestamp span between the first and last participating samples, against 20 samples / 800 ms. It does not grow from sound or wall-clock time. Brief rejected frames preserve bounded candidate evidence; a usable-sample gap over 160 ms expires displayed progress to zero, and the existing collector resets on subsequent observations. Capture stop/new-string transitions clear current progress while committed choices and historical display evidence retain their existing behavior. Separate blockers report sample/span insufficiency, genuine spread or drift failures, fundamental/octave ambiguity, rejected/quiet input and absent callbacks. Recent blockers are held for readability; current numeric sample/span progress remains independent. Acceptance policy, immediate green commitment, acknowledgment, telemetry schema, grading, persistence and version are unchanged.

Deterministic integration coverage reproduces historical C-sharp4 at 282.89 Hz through sustained aperiodic input, then replaces it with a fresh green D4 estimate while certification is still collecting. Additional tests verify independent boundary colors, actual sample/span counts, gap expiry, spread versus drift, persistent layout, and absence of Piece Practice score/mistake/time changes. Real instrument and responsive browser QA remain required.
