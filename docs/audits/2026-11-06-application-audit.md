# Prelude application audit — 6 November 2026

Audited application version: **2.9.24**. Companion reports: [UX/UI audit and design proposals](2026-11-06-ux-ui-audit.md) and [prioritized implementation backlog](2026-11-06-prioritized-backlog.md). Updated with a second audit pass in the same review session.

This is an assessment and proposed backlog, not an implementation plan approved for execution. No application code, package metadata, tests, or Git history were changed. Recommendations involving shared types, persistence contracts, music behavior, or several modes require a separate scoped plan and owner approval.

## Assessment

Prelude has substantial musical functionality, strong domain separation, and unusually careful evidence handling in its newer practice and Improv features. Its most valuable next investment is reliability and usability consolidation. A rewrite or a unified practice state machine would put working behavior at unnecessary risk.

The highest-priority findings are concrete: an available arpeggio configuration can throw; failed persistence can erase previous history; two writers can overwrite completed practice evidence; and snapshot-based libraries can lose changes. Performance opportunities are also clear in the source, especially repeated score calculations, synchronous serialization, and eager loading. Their user-visible cost still needs device measurements.

### Recommended order

| Order | Work | Why first | Evidence |
| --- | --- | --- | --- |
| 1 | Prevent destructive save retries and conflicting run/library writes | Protect authored work and practice history | A2–A4; executed store probes and source traces |
| 2 | Make every selectable generator configuration safe | Prevent practice interruption | A1; deterministic execution |
| 3 | Validate imported sounding pitch against written pitch | Prevent misleading notation and grading | A5; deterministic execution; existing permissive contract needs an explicit decision |
| 4 | Handle unavailable storage and feature exceptions | Keep one failure from taking down the app | A6, A8 |
| 5 | Fix modal interaction, nonfunctional controls, and keyboard/mobile barriers | Make existing features usable and trustworthy | Companion UX report |
| 6 | Remove the measured Improv summary hotspot, then profile loading and storage | Improve responsiveness without weakening recovery or timing | E1–E10; distinguish measured synthetic costs from device experience |
| 7 | Simplify entry points, terminology, and ongoing maintenance | Reduce setup and support effort | Companion UX report; D1–D4 |

## Method, coverage, and limits

- Inspected the application shell, all ten top-level destinations, representative major component/hook paths, music generators and notation, MIDI/audio infrastructure, persistence/import/export, PWA/build configuration, CI, tests, and project documentation. The inventory contains 407 non-test TypeScript/TSX files and 323 test files under `src`; this is a broad risk-based review, not a line-by-line certification of every file.
- Three parallel read-only reviews covered architecture/performance, correctness/data integrity, and UX/accessibility. Findings were reconciled and several claims narrowed after a skeptical second pass.
- Executed small deterministic probes directly against repository TypeScript using Node's in-memory module hooks and existing test fixtures. These created no source/test files and did not access real browser libraries.
- Inspected selected existing desktop/mobile QA screenshots and their corresponding current source. Historical images provide visual context only; they do not prove the current build's layout.
- Fresh browser inspection was blocked: the browser access host was unavailable, and automatic approval review rejected opening Brave without stating a reason. No substitute browser automation was used to bypass that rejection.
- No physical MIDI keyboard, microphone, audible playback, assistive technology, installed PWA, actual browser storage failures, or mobile device was tested in this audit. No dependency-vulnerability service or external security scan was run.
- **Executed** means a current repository function/store path was run. **Source-confirmed** means the mechanism is visible in source. **Proposal** means expected benefit requires measurement or user testing. A green unit suite does not negate the executed findings below.

Priority: **P1** = address before substantial feature expansion because of loss, crash, or incorrect musical behavior; **P2** = important reliability/usability/scaling work; **P3** = targeted optimization or maintenance. These are project priorities, not formal security severity scores.

## Correctness and data integrity

### A1 — P1: B augmented arpeggios can crash generation

**Executed.** `src/lib/music/generators/sequences.ts:587` chooses a root without first filtering for supported theory spelling. `createTheoryPatternNotes` throws at `:283` when a valid spelling cannot be produced; `src/lib/music/note-utils.ts:149` provides only the natural B root letter for that pitch class.

Reproduction: generate a treble arpeggio with augmented quality, ascending direction, and natural roots. Deterministic random selections `[0, 0, 0.8]` select B4/MIDI 71 and produce **“No valid theory spelling exists for MIDI 71.”** B–D-sharp–F-double-sharp needs an unsupported double accidental. The same issue occurs for B2 in bass and for ascending, descending, and round-trip directions.

A bounded sweep executed **24,400 selections** across interval, scale, and arpeggio families, supported directions, both clefs, natural/accidental root categories, and 100 evenly spaced root selections. It produced **72 throws**, all in the six B-augmented groups. This is deterministic probe coverage, separate from Vitest counts, and does not certify every musical rule.

Recommendation: filter candidate roots through existing spelling constraints before selecting, as triad generation already does. Preserve correct augmented spelling; do not silently substitute an enharmonic pitch spelling or add double accidentals as an incidental fix. Define a recoverable outcome if a future configuration has no supported candidate.

Acceptance: deterministic coverage of every candidate root/quality/direction/clef/category combination; valid spelled intervals and range invariants; no selectable configuration throws. Current random “never throws” arpeggio coverage is limited to major arpeggios (`sequences.test.ts:779`).

### A2 — P1: A failed save can delete old history and still save nothing

**Executed with an in-memory backend.** `src/features/piece-practice/persistence/piece-practice-runs.ts:335` catches every `put` failure, deletes the oldest terminal record, and retries. The catch does not establish that quota caused the failure, and deletion is not atomic with successful replacement.

Probe: retain one parser-valid completed run; make both writes fail with non-quota `UnknownError`. Result: **two failed writes, one old run deleted, zero retained terminal runs, new run not saved**.

Recommendation: preserve existing history on generic/transient failures. If quota reclamation is desired, classify the error and specify an explicit retention policy with safe transactional behavior or user-controlled cleanup. A retry must not trade away previous evidence without a successful replacement.

Acceptance: non-quota failure retains all previous data; failed quota retry also retains required evidence; success/failure status accurately reflects what is durable. Existing tests at `piece-practice-runs.test.ts:502` expect cleanup, while the double-failure test at `:516` starts with empty history and misses this loss.

### A3 — P1: Competing pitch-first run writers can resurrect completed runs

**Executed using two real store instances and the repository's fake IndexedDB.** `piece-practice-runs.ts:425` accepts any higher integer revision and silently treats an equal revision as successful, without matching its content or owner.

Scenario: two tabs resume one run. A saves completed revision 2. B saves a different active revision 2: the promise resolves but B's record is not stored. B then saves active revision 3, which replaces A's completed result. All four input records in the probe passed the parser. This verifies store logic, not physical browser disk behavior.

Recommendation: add explicit run ownership/conflict handling and compare-and-swap semantics. Differing equal revisions must not be acknowledged as saved; terminal records should not become active through a stale writer. Study the newer continuous/weekly stores' protections while retaining this feature's independent state machine.

Acceptance: competing owners, equal revisions with different contents, delayed callbacks, owner expiry, resume after reload, and completed-versus-active races. Expose conflicts as recoverable user choices. Storage/type changes require an approved compatibility plan.

### A4 — P1: Whole-library snapshots can overwrite unrelated changes

**Executed for legacy presets; source-confirmed for Staff Builder.** `use-staff-builder-library.ts:92` loads a snapshot once, then `:118`, `:138`, and `:261` replace entire stored libraries. Legacy presets do the same in `practice-session-builder.tsx:21,49` and `practice-session-library.ts:215`.

The legacy probe loaded two empty snapshots, successfully saved “Tab A” from one, then successfully saved “Tab B” from the other. Reload contained **only Tab B**. Staff Builder uses the same stale-snapshot write mechanism. A storage event listener alone would not make these writes atomic.

There is also a same-tab async-import race: `staff-builder-session.tsx:171` waits for `File.text()` and then calls the captured `state.importPiece`; its hook spreads the captured library. Creating/importing another piece while that read is pending can let the older completion overwrite newer work.

Recommendation: transactional per-record updates with revisions, or explicit writer ownership and conflict recovery. Rebase async imports against current state and fence obsolete operations. Preserve corruption protection and drafts; never silently resolve conflicts by discarding one version.

Acceptance: two tabs editing different and identical pieces; simultaneous imports; delayed file read plus create/rename; failure while resolving a conflict. Use actual isolated-browser IndexedDB/localStorage in addition to pure tests.

### A5 — P1 correctness decision: Imported notation can disagree with graded pitch

**Executed; existing intentional permissiveness.** An imported pitch with MIDI **60**, letter **E**, natural accidental, octave **4** is accepted by `parseStaffBuilderScore`; `validateStaffBuilderScore` returns no issues; practice projection expects MIDI **60**. The written E4 therefore disagrees with the C4 required by grading.

Evidence: `persistence/staff-builder-schema.ts:120`, `staff-builder-validation.ts:99`, `piece-practice-projection.ts:116`, `notation/staff-builder-notation.ts:246`. `staff-builder-contract.ts:18` explicitly says spelling/MIDI consistency is not checked. This is a contract improvement, not an undocumented recent regression.

Recommendation: add a semantic consistency issue before declaring a piece “Validated” or enabling practice. Retain the original import for repair; do not guess whether the written pitch or MIDI number was intended. Correct enharmonic spellings such as C-flat/B and B-sharp/C must remain valid, including octave-boundary arithmetic. Keep double accidentals unsupported unless separately approved.

Acceptance: consistent enharmonics, inconsistent octave/accidental pairs, imported legacy records, clear error location, and no silent repair. This change affects public validation semantics and needs a plan.

### A6 — P1/P2: Volume preferences can throw through rendering/audio paths

**Executed.** `src/lib/audio/instrument-volume.ts:16,43` and `src/lib/audio/feedback.ts:16,41` access localStorage without guards. Both getters threw `SecurityError` when reads were denied; both setters threw `QuotaExceededError` when writes failed.

Instrument volume is read during `useSyncExternalStore` rendering (`instrument-volume-control.tsx:25`). Feedback volume is also read by UI/audio paths. With no application error boundary, denied preferences can have consequences beyond losing a setting. A full application render failure was not browser-reproduced.

Recommendation: use an in-memory/default preference when storage is unavailable, notify subscribers independently of write success, and expose a small persistence message where useful. Test denied access to `window.localStorage` itself, throwing `getItem`/`setItem`, malformed numbers, and subscription behavior.

### A7 — P2: Staff Builder imports lack resource limits

**Source-confirmed, documented contract gap.** `staff-builder-piece-file-browser.ts:13` reads all text without checking bytes; `staff-builder-piece-file.ts:38` parses synchronously; `staff-builder-schema.ts:236` maps unbounded score arrays. Large AI-generated or accidental imports can monopolize the UI and require full processing before discovering a storage failure. The current UI does report a failed save; the gap is early resource control, not absence of all failure feedback.

Recommendation: preflight file bytes, then bound relevant measures/events/pitches/annotations/text with a useful explanation. Choose limits from realistic scores. Preserve existing data on rejection and define how oversized legacy data remains recoverable. Weekly program imports already demonstrate bounded preflight.

Acceptance: just-under/over limits, nested oversized structures, slow reads canceled by navigation, valid large music, and unchanged library after rejection. Do not claim an exploitable security incident from this finding.

### A8 — P2: Feature failures lack containment and recovery

**Source-confirmed.** `main.tsx:9` mounts App directly, and no Error Boundary exists in `src`. Improv's lazy import (`App.tsx:22,101`) and lazy Study View have loading fallbacks but no rejected-import recovery. An uncaught render or rejected lazy-import error can remove the shell and retained feature owners. Event-handler and asynchronous failures also need their own explicit handling; Error Boundaries do not catch every error category.

An older uncontrolled tab may request a chunk removed by `.github/workflows/deploy.yml:57`, which deploys using `rsync --delete`. Controlled PWA clients may already have the chunk cached; failure is conditional, not inevitable.

Recommendation: contain feature failures while retaining the shell and unrelated active session; offer deliberate retry and recovery. Review atomic deployment/old-asset retention separately. Do not automatically reload a tab holding temporary audio, unsaved drafts, or active performance evidence.

Acceptance: rejected lazy import, descendant render failure, active hidden session present, offline retry, and existing draft preserved. Add containment before expanding lazy loading.

### A9 — P2: Recovery and capacity tools lag behind storage policies

Three related product gaps merit planned follow-up:

- A malformed Staff Builder row can reject the whole library (`staff-builder-schema.ts:282`), although raw data remains preserved. The recovery UI offers clearing the area (`staff-builder-session.tsx:128`). Add raw rescue export and selective, read-only salvage before destructive recovery.
- Legacy V1 preset edits live in a dirty in-memory working copy (`practice-session-builder.tsx:21–23,39,49–52`) with explicit Save but no reload/close draft recovery. Mode switching retains that host; reload does not. Provide recoverable drafts and truthful saved state.
- Weekly programs/history have hard ceilings of 100 programs, 100 revisions per program, and 10,000 history records globally, but no complete owner-controlled archive/export/prune workflow (`practice-program-indexeddb.ts:119`, `practice-attempt-indexeddb.ts:69`, `docs/WEEKLY_PROGRAM_V2.md:111,137`). Add maintenance before users reach those limits; never silently discard evidence.

### A10 — P2 timing decision: Melody drops available MIDI source timestamps at admission boundaries

**Source-confirmed with an executed recorder/adapter probe.** `src/hooks/use-midi.ts:148–156` reads the MIDI event timestamp and `use-app-midi-input.ts:20–22` forwards it. `features/melody/components/melody-session.tsx:534` accepts only the pitch. `melody-performance.ts:38–42` admits and timestamps the attack using callback-time audio time instead of the available event provenance.

With a downbeat at 10 seconds, an event whose synthetic source time was 9,990 ms but whose callback arrived at 10.010 seconds was accepted as a +10 ms performance attack through the same one-argument adapter. It locked the recorder to MIDI and rejected a subsequent virtual attack. Conversely, delivery after the evaluation cutoff is rejected regardless of an earlier source timestamp. This establishes the receipt-time behavior; it is **not a physical latency measurement or browser reproduction**, and browser/audio clocks cannot simply be assumed to share an origin.

The current preparation contract excludes preparation attacks from both grading and source locking. Decide a feature-owned timestamp/provenance policy for delayed delivery, with an explicit mapping between clock domains and conservative treatment of missing/anomalous times. The continuous engine contains useful local safeguards but must remain independently owned; do not transplant its grading engine or silently change Melody's timing tolerance.

Acceptance: preparation input delivered after the downbeat; in-window input delivered after the cutoff; unavailable/backward/implausible timestamps; MIDI-versus-virtual source locking; interruption and restart. Preserve raw timing provenance and distinguish uncertain evidence from a confident timing judgment.

## Efficiency and architecture

These are source-confirmed costs or scaling characteristics, supplemented by the explicitly labeled Node microbenchmarks in E3/E9, operation-count probe in E8, and synthetic capture/evaluation probe in E10. They are not measurements of browser frame time, battery use, or network experience.

### Fresh production-build baseline

The audit's final local build reported the following. These are emitted sizes and gzip estimates, not measured transfer sizes or load times on a user's connection.

| Asset | Emitted kB | Gzip estimate kB |
| --- | ---: | ---: |
| Main application JS | 1,241.01 | 354.15 |
| VexFlow vendor JS | 1,119.96 | 688.50 |
| CSS | 99.14 | 17.64 |
| Lazy Improv workspace | 128.46 | 37.51 |
| Lazy Study View | 7.05 | 2.54 |
| Improv analysis worker | 21.65 | Not reported |

The generated HTML references the main JS and preloads VexFlow: those two JS assets total **2,360.97 kB emitted / 1,042.65 kB estimated gzip**. The service worker precache contains **36 entries / 8,179.65 KiB**. This supports prioritizing first-entry loading and deliberate offline-payload tradeoffs; it does not establish poor observed performance on every device.

### E1 — P2: Reduce the initial feature graph without losing retained sessions

`App.tsx:3–13` eagerly imports almost every mode; only Improv is lazy. The hidden Practice Session builder mounts immediately (`:245`). Defer heavyweight feature/setup/import/report code until needed.

For Practice Sessions, defer only **until first entry**, then retain that same instance behind the current hidden wrapper. Putting it directly into the mode switch would destroy its draft/run preservation contract. Keep the root MIDI provider and input ownership unchanged. Measure cold-load bytes, parse/execute time, and first entry on a modest Chromebook; test cold/offline first entry and update transitions.

### E2 — P2: Persist changed records instead of repeatedly serializing all music

`use-staff-builder-library.ts:268–284` stringifies saved/current scores, writes the whole library, and writes the whole draft. Editor actions invoke this synchronously (`use-staff-builder-editor.ts:101`). Library rendering also validates each score (`staff-builder-library.tsx:50`).

Separate score edits from cursor/preferences, retain revision-based dirty state, and use asynchronous record-level persistence where justified. Coalescing writes is useful only with explicit pending/durable status and a documented recovery guarantee. Fix A4 concurrency as part of the storage design, not as a separate superficial debounce.

### E3 — P3, pending device profiling: Cache score timing instead of rebuilding it every animation frame

`use-staff-builder-playback.ts:50` resolves position every RAF. `staff-builder-playback.ts:24–27` rebuilds contexts and start offsets; `staff-builder-score.ts:148` scans prefixes and `staff-builder-time.ts:90` slices/reduces prefixes. This creates **quadratic measure-count setup per frame**. The playback/editor hooks also stringify the score during rendering.

**Second-pass measurement lowers the urgency.** The actual position resolver was run on valid all-rest 4/4 scores using Node 24.18.0 on this Windows desktop. After 200 warmup calls per size, nine interleaved batches of 300 calls per size produced these median per-call costs:

| Measures | 4 | 16 | 64 | 128 | 256 | 512 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Resolver time, ms | 0.000163 | 0.000861 | 0.009898 | 0.034291 | 0.118729 | 0.443243 |

This confirms unfavorable growth but **does not demonstrate dropped frames**: at 512 measures, the median batch mean was 0.443 ms and batch means ranged from 0.422–0.483 ms. These are batch averages, not maximum individual lookup latency. The 16,200 timed lookups exclude React, engraving, DOM, audio, and score serialization. Slower-device/end-to-end profiling should decide scheduling priority; E9 has much stronger measured urgency.

If profiling warrants it, build an immutable timing index once per musical score revision and use it for position lookup. Keep the visual cursor isolated from editor-wide work. Validate meter changes, ties, exact boundaries, playback cancellation, and long-score frame times; do not alter musical clocks to fit display work.

### E4 — P2: Keep unchanged notation from redrawing on UI-only updates

`staff-builder-multi-system-score.tsx:73` copies each `system` object on every render, while its VexFlow effect depends on that identity (`:34–39`). Selecting an annotation or opening print options changes parent state (`staff-builder-study-view.tsx:27`) even if music and layout are unchanged.

Stabilize layout inputs and isolate/memoize notation from overlays. Measure render counts and duration before/after. Preserve geometry reporting, semantic text, resizing, lyric layers, and printing. The shared `MusicStaff` effect also depends on its entire props object (`music-staff.tsx:157`); profile whether unrelated parent renders cause expensive engraving there before adding broad memoization.

### E5 — P2: Query the needed history instead of loading entire collections

Weekly recovery reads all program attempts and repeats the read (`practice-attempt-indexeddb.ts:73`, `practice-attempt-ownership.ts:18,30`), although the visible history is limited. Rolodex operations use full `getAll` and repeated validation even for targeted changes (`rolodex-store.ts:59,86`).

Use indexed status/program/date queries, cursor pages, and targeted records while retaining corruption checks, aggregate budgets, and transactional acknowledgements. The continuous-history cursor implementation is a useful local precedent. Benchmark realistic histories and near-capacity data; avoid a new shared persistence abstraction solely to remove code duplication.

### E6 — P2/P3: Measure audio scheduling and main-thread contention

`musical-event-player.ts:81` schedules onsets with main-thread `setTimeout`; `grand-piano.ts:157,179` clones an HTML audio element per note. Heavy layout can therefore delay scheduling. A decoded-buffer, bounded-lookahead AudioContext scheduler may help after onset jitter is measured. Preserve pitches, durations, volume, cancellation, offline sound, and each feature's ownership. Leave velocity/pedal evidence in other paths unchanged; the shared sampler does not provide those parameters.

Free Play also starts sound inside React state updater callbacks (`freeplay-session.tsx:78–86,131–138`). Strict Mode can replay updaters. Move once-only audio side effects out of state calculations and test one press/one attack under Strict Mode; audible duplication was not manually observed here.

Monophonic detection runs synchronously on the main thread, scheduling the next sample approximately 33 ms after analysis completes (`lib/audio/monophonic/microphone-capture.ts:175`, `pitch-detector.ts:25`). Profile under simultaneous notation work before considering a worker/audio-processing boundary. Preserve freshness, harmonic uncertainty, stream cleanup, and musical acceptance thresholds.

### E7 — P3: Stop idle churn and bound long-session work deliberately

- Tuner's mounted watchdog polls every 50 ms (`use-tuner.ts:29`), while idle `snapshot()` returns a fresh object (`microphone-capture.ts:199`). This sends new React state roughly 20 times a second with the microphone off. Stable empty snapshots/equality checks can remove the churn while retaining stale-reading cleanup.
- Standalone Flashcard, Sequence, and Ear Training journals append by copying growing arrays and scan earlier attempts (`flashcard-practice-result.ts:64`, `sequence-practice-result.ts:40`, `ear-training-practice-result.ts:35`). Benchmark long sessions, then consider incremental indexes/chunked evidence. Define retention explicitly before any cap; never silently drop results.

### E8 — P2/P3: Improv pagination repeatedly loads the complete metadata collection

**Executed operation-count probe, not a latency benchmark.** `use-improv-library.ts:29,32` drains pages of 100 records. Each page in `persistence/improv-indexeddb.ts:116–120,326–332` reads and validates the complete relevant collection; take listing also sorts it. With 1,000 valid collections and 1,000 valid take tombstones, the actual repository APIs made 11 `getAll` calls per listing, reading 11,000 rows to return 1,000. The combined collection/selected-take refresh therefore read 22,000 metadata rows. The fake IndexedDB probe does not reproduce real-browser cloning cost or elapsed time.

The hook checks cancellation only after both page-draining loops (`use-improv-library.ts:33`), so an obsolete refresh can continue reading until that final generation check. Closure or an error can stop it earlier. Data is bounded, which limits growth, but a paginated interface is not currently a paginated storage query.

Recommendation: use actual indexed/cursor pages, or take one verified snapshot per refresh and page that snapshot. Check generation/cancellation between awaited batches. Preserve global integrity, deletion/tombstone semantics, sorting, and storage budgets; do not remove validation just to reduce counts.

Acceptance: unchanged ordering/results at 0/99/100/101/1,000 rows; operation counts proportional to records actually needed; stale refresh stops promptly; malformed records still surface correctly. Prioritize against observed library sizes and E9.

### E9 — P2, highest measured performance priority: Overlap-heavy Improv evidence makes summary work quadratic

**Executed against valid repository-generated takes.** `improv-performance.ts:136` marks every queued attack ambiguous on each overlapping note-on for the same channel/pitch. Repeated attacks whose releases are missing therefore repeatedly scan a growing queue. This is legal raw evidence, not a rejected schema. `components/improv-take-review.tsx:44–45` computes the summary synchronously in `useMemo` when displaying a take, before the separate worker-based insights can help.

Fixtures were generated through the actual recorder, passed `requireLoadedTake`, and remained below the supported 100,000-event limit. The table shows median milliseconds across three summary calls per fixture, excluding generation/validation, on Node 24.18.0 on this Windows desktop:

| Raw events | Paired note-on/off | Same-key note-ons without releases |
| --- | ---: | ---: |
| 1,000 | 1.145 | 3.170 |
| 4,000 | 5.240 | 13.722 |
| 16,000 | 17.061 | 255.999 |
| 64,000 | 134.086 | 7,391.175 |

The 64,000-event overlap runs ranged from 5,736.711 to 7,526.005 ms. These are synthetic abnormal-input resilience results, **not measured normal-playing browser stalls**. A source losing releases or a valid imported journal can nevertheless supply this shape. The combination of measured computation time and synchronous render placement makes this more actionable than a generic bundle-size or complexity concern.

Recommendation: represent ambiguity per key/cohort without revisiting every prior attack, and use efficient queue traversal while preserving conservative overlap/pairing semantics. Avoid expensive derived summary work in a synchronous render path; evaluate worker ownership or staged computation without moving raw evidence into React or silently truncating it.

Acceptance: identical summaries for paired notes, overlapping same-pitch attacks, cross-channel notes, unmatched releases, and missing releases; bounded growth across supported input sizes; responsive loading/cancellation on the supported lower-end device. Use stable operation/scaling checks rather than a fragile universal millisecond assertion.

### E10 — P2 resilience: Melody's short attempt duration does not bound incoming event count

**Executed synthetic high-rate-input probe.** `melody-performance.ts:51` copies the full attack array on every accepted attack, with no count/byte budget. `melody-alignment.ts:37–48` allocates and visits `(expected + 1) × (performed + 1)` cells. Short phrases bound expected notes and elapsed musical time, but a sequencer loop or faulty MIDI source can still deliver many messages within that time.

The actual recorder accepted all 5,000, 10,000, and 20,000 synthetic attacks in a two-measure exercise with six expected attacks. Local Node capture took approximately 16, 84, and 807 ms respectively; alignment allocated 35,007, 70,007, and 140,007 cells, with evaluation completing in 8–10 ms. These are illustrative local executions, not repeated browser benchmarks or normal human-input measurements. Capture growth is the stronger concern in this sample; do not portray the small alignment timings as a demonstrated stall.

Recommendation: define an explicit accepted-evidence budget and use amortized append storage. On exhaustion, visibly interrupt with the accepted prefix preserved; never report a truncated attempt as a complete assessment. Choose limits using realistic device/message rates and retain the separate Melody state machine.

Acceptance: high-rate input, exact limit/next event, interruption cleanup, retry, retained evidence, and truthful result status. This is distinct from import-file limits and the long-session journals in E7.

## Delivery, testing, and maintainability

### D1 — P2: Make verification reproducible

The package has no `packageManager` field and permits Node >=22.12.0. CI uses pnpm 10/Node 22; this workstation uses pnpm 11.9.0/Node 24.18.0. The first audit verification unexpectedly recreated `node_modules`, a behavior already recorded repeatedly in `docs/TESTING.md`.

Choose a supported package-manager version, align local and CI tooling, and put one current verification procedure near the top of testing documentation. Separate install/refresh from verification. The existing process-local safeguards are `CI=true`, `TZ=UTC`, `pnpm_config_verify_deps_before_run=false`, `pnpm_config_update_notifier=false`, and `npm_config_offline=true`; they assume an intact dependency installation.

### D2 — P2: Promote a small browser regression suite into maintained checks

`pnpm verify` covers lint, TypeScript, Vitest, and production/PWA build. The checked-in workflow runs after pushes to master, then deploys. Extensive local browser scripts exist under ignored `.dev`, but they are not a reproducible CI gate.

Promote a small supported set: cold start; first lazy entry/failure; dialogs and focus; MIDI ownership transition; two-tab storage; import failure; offline/PWA update; narrow layout. Keep physical QA separate and visible. Consider read-only pull-request verification with deployment still restricted to the owner-controlled path. Avoid migrating every historical script at once.

Add meaningful budgets after measuring: initial JS, large-score engraving time, idle render count, import size/time, history query time, and audio onset jitter. `check-types` and `build` both run TypeScript; removing duplicate checking is a minor build-time improvement after correctness work.

### D3 — P2/P3: Test uncovered behavior, not only current implementation contracts

The generator sweep found a gap despite large automated coverage. Persistence tests intentionally codify some permissive/destructive policies. Add the behavioral cases in A1–A6, not implementation-mirroring assertions.

`docs/TESTING.md:156` also records a recurring copy-score focus assertion that passed in isolation/rerun without a fix. `staff-builder-copy-score.test.tsx:71` checks focus immediately while production places it in a passive effect. Determine whether this is scheduling or real focus loss, retain the assertion, and wait for the intended user-visible outcome appropriately. Historical flakiness is not proof of a failure in this audit's final run.

Use fixed clocks/seeds for reproducibility where practical; no new timezone failure was demonstrated. Keep deterministic music invariants and physical-device acceptance separate from test totals.

### D4 — P3: Consolidate current guidance and keep refactors local

**Small documentation corrections completed during this audit.** README and onboarding now list ten top-level modes, include Improv, and describe Melody's three-quarter-beat lead-in. The old architecture Checkpoint 5 narrative remains historical and now explicitly points to the superseding Flow V2 F3A behavior. `melody-preparatory-lead-in.ts:26–31` and the current architecture description agree on three quarter beats in 4/4. No musical behavior changed.

Architecture/testing documents each exceed 260 KB and mix current contracts with many historical checkpoints. A concise current capability/ownership/validation index would reduce search time and contradictory status reading; historical detail can remain linked.

Large feature components and the global stylesheet are maintenance pressure points, but line count alone is not a defect. Split by stable responsibility only when changing that area: setup, current performance, results, persistence orchestration, and presentation. Share proven dialog/control patterns; preserve Flashcards, Sequences, Free Play, and other engines as independent domains.

### D5 — P3 product tradeoff: Offline sample payload

The source contains **12 piano WAV files totaling 5,721,616 bytes**. `pwa-assets.ts` intentionally precaches WAVs alongside application assets, and configuration tests protect this. That buys reliable offline audio at an initial installation and storage cost. Unchanged hashed samples can be reused across updates; changed samples add transfer cost.

Compression, alternate formats, or optional sound packs need audible quality, startup, browser compatibility, and offline tests. Do not remove samples from precaching merely to improve a bundle-size headline. VexFlow's dedicated vendor chunk is already a useful caching boundary.

### D6 — P2 verification risk: Print cleanup can run while a nonblocking print session remains active

`use-browser-print.ts:46` schedules unconditional completion one second after `window.print()` returns if no completion event has arrived. The completion removes feature-owned printable content (`staff-builder-print-flow.tsx:10`; `practice-session-print-report.tsx:67`). The hook also listens for `afterprint` and print-media exit, but the fallback does not inspect whether print media is still active.

An isolated execution of the actual hook with a nonblocking `window.print`, `matchMedia('print').matches = true`, and no completion event produced: before the one-second fallback, completion count 0 and the print title applied; after it, completion count 1 and the original title restored, even though print media remained active. This is a **conditional lifecycle risk**, not an observed blank PDF or a proven failure in a named browser. The existing tests intentionally assert the one-second fallback but do not cover that active-media condition.

Recommendation: verify long-open print preview and cancellation in supported browsers. If the condition occurs, defer teardown while print is known active and retain a bounded recovery path when lifecycle events are unsupported or missing. Preserve title ownership, exactly-once completion, unmount cleanup, and focus return. A timeout alone is not evidence that printing finished.

## Strengths and decisions to preserve

- Pure musical generation/validation generally stays separate from React. Theory-aware spelling, classical melodic-minor direction, and unsupported-double-accidental boundaries are valuable contracts.
- Shared MIDI transport has ownership fencing and cleanup. The legacy held-note `Set<number>` deliberately collapses ports/channels; tests assert first-release behavior. Multi-device tracking is an explicit future behavior decision, not an uncovered regression.
- Newer weekly/continuous persistence uses ownership, transactional acknowledgement, interruption handling, and resource budgets. Reuse these lessons without merging feature state machines.
- Improv keeps raw evidence outside React, limits display work, and analyzes insights in a worker. Preserve that architecture while fixing the separate synchronous summary cost in E9; the worker does not cover every derived calculation.
- Permission requests and playback generally require deliberate action. PWA updates do not force an automatic reload during practice.
- The second pass checked the installed PWA plugin's real `onNeedReload` handling, not just its mocked tests. The app's explicit reload boundary is supported by that implementation. Download/native-save paths also fence stale callbacks and handle aborted or uncertain operations deliberately. Do not replace these with optimistic success notices or forced navigation.
- Provisional acoustic/fingering/qualification behavior is labeled conservatively. Keep those limitations; neither unit tests nor synthetic inputs establish physical accuracy or musical mastery.

## Proposed implementation batches

These are approval-sized candidates, not permission to implement them.

| Batch | Scope | Required decisions/risks | Acceptance focus |
| --- | --- | --- | --- |
| Reliability 1 | A1 generator eligibility; A6 preference fallbacks | Correct spelling; unchanged volume behavior | Exhaustive supported candidates; storage-denied rendering |
| Data safety | A2/A3 pitch-first persistence | Retention, ownership, schema compatibility | Failed retry retains data; terminal evidence cannot be resurrected |
| Library safety | A4, UX U14, plus bounded imports/recovery | Multi-tab strategy; draft guarantees; old records | Conflict/async-import probes in a real browser |
| Musical validation | A5 | Written-versus-MIDI repair choice; legacy imports | Enharmonic/octave consistency with actionable errors |
| Interaction repair | UX U1–U6, U15/U16 | Shared modal patterns; touch/keyboard behavior; save wording | Keyboard, screen-reader, phone/zoom regression checks |
| Improv performance | E9, then E8 in a separate change | Evidence pairing, summary ownership, integrity checks | Equivalent output with bounded work; browser responsiveness |
| Other performance | E1–E5 in separate small changes; E3 only when profiling warrants it | Retained-host lifecycle; cache invalidation; persistence | Before/after device measurements and unchanged contracts |
| Melody evidence | A10/E10 and UX U17 in separate plans | Clock provenance, evidence budgets, pitch-only wording | Delayed input, high-rate input, truthful incomplete and achievement states |
| Product flow | UX navigation/onboarding proposals | Target users, first-use defaults, discoverability | Observed user tasks rather than opinion-only redesign |

For a later product-code commit, propose the next patch version in its implementation plan; do not infer release approval from this audit. Version remains 2.9.24 here.

## Validation record

- **Final `pnpm verify`: passed, native exit code 0.** Lint, TypeScript, Vitest, production build, and PWA generation completed.
- **Exact test totals: 325 test files passed; 4,713 tests passed.** No tests were added, removed, or weakened. The 323-file source inventory excludes the root/build test files.
- **Second-pass focused validation: 6 test files / 145 tests passed, native exit code 0.** Covered `use-browser-print`, `download-dialog`, `native-save`, `register-service-worker`, `improv-performance`, and `improv-indexeddb`; log: `.dev/audit-2026-11-06-round2-focused.log`. These are a subset of the full suite, not additional unique tests. Full verification preceded the documentation-only second-pass edits; no product or test code changed afterward.
- Non-failing diagnostics remain: **one ESLint warning** at `src/features/piece-practice/hooks/use-piece-practice-acoustic-input.ts:176` about a cleanup ref, jsdom Canvas/media limitations in tests, and build plugin-timing/large-chunk warnings. They should not be confused with failed checks or with real-browser coverage.
- Final verification log: `.dev/audit-2026-11-06-verify-confirmed.log`. The prior run completed all stages but its PowerShell wrapper returned nonzero after rendering native stderr; verification was repeated with explicit native exit-code capture to resolve the ambiguity.
- The initial verification attempt was interrupted during pnpm's implicit dependency recreation. Offline restore lacked a store package; the approved locked restore then succeeded, reporting 529 reused packages and zero downloads. `HUSKY=0` skipped hook installation. Package and lockfile contents were not changed.
- The deterministic correctness probes, timing/operation-count probes, synthetic print lifecycle, and targeted jsdom import/focus probes are additional audit evidence, not new Vitest cases. Browser, screen-reader, physical MIDI/microphone, audible quality, and device profiling remain unverified in this audit.
- This audit adds three Markdown documents under `docs/audits/` and corrects current/historical descriptions in `README.md`, `docs/ONBOARDING.md`, and `docs/ARCHITECTURE.md`. The prioritized backlog summarizes every changed file. Dependency/build output and audit logs are generated ignored artifacts. No staging, commits, branches, tags, pushes, or deployment were performed; application version remains **2.9.24**.
- Handoff requires `git diff --check`, `git status --short`, then the repository's non-interactive CxR exporter. The actual exporter outcome and generated artifact path are reported with delivery.

