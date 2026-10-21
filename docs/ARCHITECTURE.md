# Prelude: MIDI Mentor — ARCHITECTURE

## Release candidate status

The working application is **2.9.22**. A1–D and the Piece Practice UI/CI follow-ups are committed through baseline `d0e4a5e`; release metadata is now prepared separately for owner review. Physical MIDI-piano acceptance remains pending and Automatic Qualification defaults OFF. Package version and embedded checkout revision retain separate owners. No musical model, scoring, native evidence or update lifecycle changes accompany this release preparation. Earlier baseline/version and checkpoint-scope notes below are historical.

## Rolodex qualification and retention - Checkpoint D

D was committed at `ba0ecd1` after C `9c59f659`, with package 2.9.21 retained by owner instruction at implementation time. The A1 engine, onset thresholds, native records and V2 executor/import schemas remain unchanged. `rolodex-qualification.ts` consumes only the native terminal acknowledgement callback, reuses A1 validation and summarizes the original assessment. A SHA-256 target identity includes the complete frozen score, source/range identities, prescription revision, eligible/selected instrument, mode, exact BPM and every policy parameter. Correct pitch and confident on-time evidence are distinct from expressive or technical musical mastery.

`rolodex-progress-types.ts` and `rolodex-progress.ts` own schema-1 compact summaries and pure progression. Rolodex entry schema 2 adds progress; schema-1 entries normalize to empty measured progress without a read-time rewrite. IndexedDB retains the existing database name and upgrades to version 2, adding a `settings` store. No A1/V2 migration occurs. Settings and passage updates use transaction completion acknowledgements. Metadata edits preserve evidence; prescription changes retain old summaries but begin an incompatible qualification context. No full-score replacement is introduced.

Physical acceptance is absent/off initially. Only an explicit owner confirmation after real MIDI-piano QA saves the selected input ID, full default A1 policy, activation generation and acceptance time. Connection alone, synthetic tests, imports and page reads cannot enable it. Only future attempts captured in the accepted context can qualify; a concurrent acceptance change is rechecked inside the progress transaction. New accepted contexts do not inherit older qualification. Old evidence is never regraded. Browser/device/audio latency remains uncalibrated; the owner must reassess changed hardware/output setups.

A clean candidate is a completed, fully observed native performance with at least one expected distinct pitch attack, every pitch correct and confidently on time, and zero wrong/missing/extra/unobserved/uncertain events. Missing local calendar or acceptance provenance prevents automatic progression. Three distinct qualifying performances establish retention eligibility. Completed confidently non-clean performances reset the sequence; stopped, failed, interrupted or uncertain evidence does not. Unreliable timestamps on unmatched attacks also make a result inconclusive. Retention requires a later local date than the third run's completion, after its terminal performance time, with a compatible captured timezone. Calendar context is captured through a read-only player notification using existing local-calendar primitives; Retry cannot attribute an older performance to today's date. No fixed 24-hour or missed-day penalty applies. Successful retention retires only this target; explicit Reactivate starts a new recorded cycle without erasing history. Cycle identity, rather than assuming a forward-only wall clock, fences old performances after reactivation.

Progress retains the latest 32 summaries plus up to four decisive qualification/retention summaries, independently of A1's 64-record eviction. A 96 KiB progress ceiling fits within the unchanged 384 KiB entry and 64 MiB aggregate ceilings; these are not quota guarantees. Compact summaries retain outcomes/counts, identity/fingerprint, exact configuration, device, calendar, observed native acknowledgement time, acceptance provenance and reasons, not raw journals. Identity deduplication plus a compaction cutoff prevents old successes from counting twice. Delayed conclusive contradictions inside pinned credit can still invalidate that sequence. Recent history is explicitly bounded, not a lifetime archive.

The shared Rolodex adapter records date and progress in one Rolodex transaction after the independent A1 acknowledgement. Failed writes retain the same pending identity and Retry; they cannot invalidate A1 or prematurely retire a target. Replay is a new native identity. Serialized transactions reread current records, preserve concurrent metadata changes and reject stale edits. Unsupported/corrupt data remains preserved. A crash between independent acknowledgements can still leave A1 saved without a Rolodex update; there is no cross-database atomic transaction or automatic backfill of older attempts.

Backup version 2 retains bounded history and progression provenance; imports mark every summary restored and never enable acceptance or create native acknowledgements. Historical Mastered state is labeled restored; fresh native qualification starts separately from restored credit. Conflicting identities still require explicit remapping; remapped evidence keeps its original passage identity and earns no new-target credit. Version-1 backups remain readable with no imported native evidence. Whole-batch validation and transactional import are retained.

`rolodex-history.ts` compares exact target identities and completed outcomes. Fine timing comparison additionally requires the same physical input ID and reliable observations; no latency calibration is inferred. Manual organization remains distinct from evidence-derived progress. UI shows short counters/next steps and expandable criteria/history, not a proficiency score.

Daily selection remains one optional Piano supplement, off by default. Eligible due retention under the currently enabled acceptance context comes first. Otherwise unpracticed passages, then the oldest local practice-day cohort, are considered; manual priority applies within that cohort, followed by exact practice recency and stable creation/identity. This fairness rule prevents permanent priority starving older work. Cross-piece error counts are not ranked as comparable difficulty. Mastered current targets, paused/archive states and incompatible instruments/music are excluded. V2 authored order/coverage remains unchanged. Current-lesson screen/print evidence carries separately acknowledged Rolodex progress and retains Retry through final review; no durable mixed lesson archive is created.


## Daily Piano Lesson repertoire - Checkpoint C

Checkpoint C composes one optional local repertoire occurrence outside the authored V2 queue. `practice-repertoire-preferences.ts` owns localStorage `prelude-lesson-repertoire-v1`: inclusion defaults off, Piano is the initial instrument choice, and reads never write or repair data. Failed saves retain the previous readable preference and report failure. No Weekly Program definition or imported schema changes.

`practice-lesson-repertoire.ts` filters acknowledged Rolodex records by enabled Piano preference, active status, explicit Piano eligibility, selected Piano Continuous Tempo profile and unchanged A1 compatibility. C originally ordered priority first; D now orders due accepted retention, unpracticed/oldest local practice-day cohort, priority within that cohort, exact practice recency, then creation/identity. No date or obsolete-prescription evidence receives no recency credit. A valid stopped/interrupted performance date denotes practice, never successful completion. D limits priority to a practice-day cohort so it cannot indefinitely starve older eligible work. Recency uses the retained current-prescription last-practice summary; due retention uses D’s bounded acknowledged progress, not an adaptive scheduler.

The program library rereads acknowledged passages on Start and freezes one complete prescription with a temporary occurrence ID. Later source/Rolodex edits, pauses or deletion cannot change the running lesson. Another tab's changes are reflected by the next selection read; there is no global lock across databases. A failed optional read or empty eligible pool leaves fundamentals available. V2's executor, queue, authored order, revisions, occurrence identities and coverage remain authoritative and unchanged.

The lesson presentation waits for the last fundamental's terminal acknowledgement before mounting the supplementary `PracticeLessonRepertoire`. It reuses `RolodexPractice` and `ContinuousPlayer`; optional host notifications expose native phase and acknowledged terminal records without introducing another MIDI/audio/scoring owner. Changing app sections interrupts A1 and releases its MIDI consumer; returning retains native Retry and Replay. Ready/count-in and review do not accrue playing time. The soft budget never stops a phrase.

Current-lesson evidence remains in memory, deduplicated by A1 attempt ID. Replay adds a distinct performance; save Retry does not. A pending/failed A1 terminal write blocks Finish and Return. A separate failed Rolodex date update preserves saved A1 evidence and its Retry remains mounted through final review; leaving unresolved date updates requires confirmation. V2, A1 and Rolodex transactions are independent and never presented as atomic. Deleting a passage after launch may prevent its date update but cannot invalidate the native performance.

The screen and print summary distinguish fundamental queue outcomes from the optional passage, unperformed/skipped work, independent A1 performances and native pitch/onset counts. Only acknowledged terminal A1 records are shown as saved. Pending native evidence blocks full-summary printing; separate date failures are labelled. No durable combined lesson archive, aggregate grade, mastery or retention model is added. Standalone player defaults and strict native/import storage contracts remain unchanged.


> This document describes the current architecture of Prelude and the responsibilities of its major systems. It focuses on how the application is organized today rather than every possible future direction.

## Practice Rolodex — Checkpoint B

B starts from committed A1 `b621843af29ac5b4fa50d0f293726bc7a36cd906`, version 2.9.21. The feature lives in `piece-practice/rolodex/`; Staff Builder hosts its library and manual save entry point. Continuous setup and acknowledged completed results also offer explicit saving. Manual enrollment requires no performance, MIDI connection, or difficulty grade. C later added an optional local daily-lesson occurrence without changing V2 fundamentals.

`rolodex-model.ts` validates detached canonical Score V4 snapshots, stable range identities and original measure numbers. Entries preserve the complete source, title/ID/update provenance, range, exact target BPM and A1 policy, source instrument, explicit eligible instruments, selected practice instrument, origin, timestamps, revision, prescription revision and owner-controlled status/priority. The full frozen score supplies inherited meter/key/clef and tie context. Source renaming/editing/deletion only changes an informative comparison; it never updates saved music. Metadata changes preserve identity and prescription revision. Range, eligibility, selected instrument or BPM differences establish another prescription revision; prior performance summaries retain their original revision. Full source replacement is not offered in B.

Staff Builder has no source-instrument metadata. Its manual save form starts with Unknown source and a visible Piano eligibility default requiring explicit confirmation. A declared Piano/Violin/Ocarina practice context supplies that instrument's default. Changing source instrument in the form visibly resets eligibility to that instrument and requires confirmation; cross-instrument eligibility and selected instrument remain explicit. Neither clef/title nor MIDI connectivity infers the source. Eligibility is permission, not compatibility or grading. Continuous Tempo is the only B execution profile. Violin/Ocarina entries and valid source music outside A1's musical scope can be saved, but execution is unavailable. Piano opt-in requires selecting Piano and passing unchanged A1 projection checks; no transposition or adaptation occurs.

`rolodex-store.ts` retains the database name `prelude-practice-rolodex-v1`; D upgraded IndexedDB to version 2 with `passages` and `settings`. Schema-1 entries normalize to schema 2 without read-time rewriting. Arbitrary pre-D binaries cannot be assumed to open this upgraded database; see [RELEASING.md](RELEASING.md) for non-destructive rollback boundaries. Transaction completion acknowledges save/edit/remove/import and separate last-practice updates. Mutation planning validates existing records, optimistic revisions, immutable source/evidence and duplicates before queuing writes. Corrupt/unsupported records remain in place, are visibly excluded from the usable list/export, and prevent writes that could overwrite them. Removing a valid record requires confirmation; there is no automatic retention eviction. A failed change retains its pending identity/payload for explicit Retry while mounted. Pending writes disable duplicate actions. Other-tab stale edits fail instead of replacing newer work.

Application ceilings are 256 entries, 256 KiB serialized source, 384 KiB serialized entry, 64 MiB aggregate entry payload and 64 MiB backup JSON. They do not guarantee browser quota. Quota failures abort transactions and preserve earlier passages. Duplicate comparison includes full frozen musical context, spelling, normalized event/tie identities, selected range, sorted eligibility, selected instrument, mode, BPM and policy; names and source dates are excluded. Distinct overlapping ranges are allowed.

`rolodex-practice.tsx` launches `ContinuousPlayer` using `projectContinuousPassage` from the saved snapshot and policy, never the current source library. A1 owns MIDI, audio, Ready/count-in, start acknowledgement, capture, scoring, terminal Retry and Replay unchanged. Its only additive UI interface notifies a caller after terminal save acknowledgement. Rolodex records a separate last-practice summary only if performance actually started; stopped/interrupted/failed outcomes retain their actual names. A failed Rolodex update cannot reject or rewrite the A1 save. Explicit Retry uses the same attempt ID; multiple failed replay updates remain pending separately. Departure while writes are pending is blocked through the existing guard; leaving failed updates requires confirmation. Earlier-prescription summaries are labeled accordingly, not reinterpreted as improvement. Neither ledger is a cross-database atomic transaction, and a crash between acknowledgements may leave the Rolodex date absent while A1 evidence remains saved.

`rolodex-backup.ts` exports JSON `{format:"prelude-practice-rolodex",version:2,entries:[...]}` and still imports version 1 and the existing DownloadDialog/name/export delivery owners. This does not change `.prelude.json`. Backup carries prescriptions, manual organization and bounded historical progress, not raw native A1 evidence or physical acceptance. Last-practice summaries are cleared on export/import; restored progress remains identifiable as historical and cannot create a native acknowledgement or enable acceptance. Whole-file validation precedes preview and a single import transaction. Matching prescriptions are explicitly skipped; conflicting IDs require explicit new-identity permission or cancellation. A collision arising after preview aborts the batch; no partial import or silent replacement occurs.

Optional suggestions read existing persisted pitch-first records through their parser/hydrator and unchanged Targeted Practice selector. At most three measures are offered with actual mistake/skip/restart/slow-response counts, original run ID and frozen source. The editor permits boundary adjustment and requires explicit Save/instrument confirmation. B’s suggestions introduced no new difficulty scoring or A1 timing recommendations. C/D subsequently added the bounded lesson/progress behavior above; acoustic Rolodex execution remains unavailable. Physical MIDI timing/comfort acceptance for A1 remains pending.

## Continuous-tempo Piece Practice — A1

A1 starts from committed `9b08d467d07499ae6ab405fb17f81467bab63cfd`, package **2.9.21**, and deliberately leaves the version and What's New unchanged. `PiecePracticeSession` adds a setup-only mode choice. Pitch-first is still the default; recovered blocking runs retain their existing owner. The continuous branch requires an authoritative saved source score and mounts a separate feature owner under `piece-practice/continuous/`. Blocking transitions, Targeted Practice, acoustic acceptance, Melody/Reading Flow and native Practice Sessions V1/V2 evidence are unchanged.

`continuous-projection.ts` parses a detached canonical Score V4 and reuses `projectStaffBuilderPieceForPractice` for validated timing, source identities and tie-aware attacks. It freezes the complete source, inclusive range, quarter BPM, policy and expected projection. Keeping the full score preserves inherited keys/clefs/meter and outgoing boundary ties without rewriting notation. Source library edits/deletion cannot replace that snapshot. One to four complete measures of constant 3/4, 4/4 or 6/8 are eligible at integer 40–120 quarter BPM. Incoming boundary ties, rolled chords, invalid/unresolved notation, unsupported meters/changes and oversized sources fail before Ready. Internal ties suppress continuation attacks. Simultaneous attacks are grouped across staves; identical MIDI unisons count once while retaining every source pitch/event identity. Neither physical hands nor fingering are inferred.

`continuous-clock.ts` owns A1's meter schedule and reuses only Melody's low-level oscillator click scheduling/cleanup. Score timing uses 480 ticks per quarter. A 3/4 count-in has three quarter pulses; 4/4 has four; 6/8 has two dotted-quarter pulses, with the first accented. At quarter BPM q, the 6/8 dotted-quarter tempo is q / 1.5 and its pulse lasts 90,000 / q ms. One authored bar is counted before the original downbeat. There is no Melody exercise conversion or shared scoring engine.

`ContinuousSession` owns Ready → starting acknowledgement → count-in → playing → terminal results. Ready creates no audio, timer, attempt or scored input. Begin synchronously fences repeat clicks and invokes native audio activation from the user action, then waits for the initial IndexedDB transaction and audio activation before scheduling clicks. One owned AudioContext supplies all musical coordinates; a 40 ms display/lifecycle poll never changes expectation times. Two-second performance checkpoints are independent of clock progression. Stop, background/freeze/pagehide, input loss, consumer replacement, suspended audio and unmount cancel scheduled nodes, clear the poll and close the owned context. Generation fences prevent delayed activation or writes from resurrecting a stopped session. React Strict Mode mounts do not allocate audio. The existing app departure-guard slot stops an active attempt first; a subsequent navigation can leave after acknowledgement. Failed terminal persistence permits an explicit confirmed unsaved departure.

`continuous-midi.ts` consumes selected-input raw messages through the existing app-level MIDI provider, with one consumer and its normal ownership notifications. The shared decoder distinguishes real Note On from Note Off/velocity-zero, malformed data and pedal messages. No virtual-keyboard, simulation or microphone callbacks are registered. Every accepted distinct Note On retains device, channel, velocity, source/receipt/audio timestamps and an attempt-local sequence. Held state is never sampled to fabricate attacks. A monotonic downbeat cutoff rejects delayed count-in/earlier-replay messages with usable source timestamps; missing/anomalous timestamps cannot establish such delivery history. The audio coordinate is corrected by plausible delivery age up to 50 ms. Timing uncertainty is at least 5 ms, increases with observed delivery age, and is unavailable for unreliable timestamps. This is browser-arrival timing, with uncalibrated physical input/output latency.

`continuous-assessment.ts` is pure and independent of React/input/storage. For each fixed distinct onset, the association half-window is min(400 ms, 0.5 musical pulse, 0.45 nearest distinct-onset gap); on-time tolerance is min(150 ms, 0.2 pulse, 0.4 gap). These configurable internal values and version 1 are frozen in the passage. The gap uses the smaller adjacent distinct-onset distance inside the selected range; endpoints use their sole neighbor, and isolated onsets use infinity so pulse/caps decide. Rests/range boundaries are not invented onsets. Compound 6/8 uses the dotted-quarter pulse. Count-in input is excluded, so the first association window is clipped at the performance downbeat. A final tail of min(400 ms, 0.5 pulse) follows the authored range end.

Correct MIDI pitches get first refusal across fixed, nonoverlapping windows, selecting nearest time, then earlier time, then attack identity. Each attack satisfies at most one expected distinct MIDI pitch. Remaining different pitches can fill unfulfilled slots as associated wrong pitches; remaining attacks are extras. A late prior pitch may therefore be an extra or a wrong pitch near a later onset, but never shifts that onset or consumes a legitimate later correct pitch. Partial chords retain pitch-level outcomes. Early/late/on-time is reported only when the timestamp uncertainty interval supports the classification; otherwise pitch correctness remains visible with uncertain timing. Interrupted windows that were not fully observed are not called missing. Results expose original measures/events and separate counts, never proficiency percentages, duration/pedal/dynamics/hand grades or invented future misses.

`continuous-score.tsx` is a feature-local wrapper around the canonical grand-staff renderer and temporal geometry. It draws notation only when the frozen score/measure changes, at a fixed 1.6 display scale (16 px staff-line spacing), retains full staff separation, and moves/follows the audio-clock playhead without rebuilding SVG. The active measure stays in the same pane when bars change; the next authored measure is also rendered below it. Small viewports automatically scroll the score horizontally rather than shrink notation. The wrapper has unique accessible measure descriptions and focusable scroll regions. Shared Staff Builder, pitch-first, Reading Flow and print defaults are unchanged. Narrow-screen look-ahead and physical piano-distance comfort remain acceptance limitations.

`continuous-store.ts` owns IndexedDB `prelude-continuous-piece-v1`, version 1, store `attempts`, independently of all existing ledgers. Each record contains stable identity/revision, full frozen provenance, policy/BPM/meter, input identity, actual attacks, terminal associations, calendar dates, observation boundary and terminal-save attempt count. Native transaction completion is the acknowledgement; a persisted terminal record proves its terminal write completed. Pending/failed acknowledgements remain separate runtime UI state. Start-write failure returns to Ready for same-ID Retry Start. Terminal failure preserves evidence in memory for Retry Save; retries cannot rewrite terminal evidence or create a new performance. Replay waits for acknowledgement, retains the exact passage/policy, and returns to Ready with a new identity on Begin. Saved history can prepare its original frozen range independently of the current library. An unfinished record is presented as an unfinished/possibly interrupted last checkpoint, not resumed or called completed; crash durability is only the last acknowledged checkpoint, with no guaranteed final unload write.

Limits are 256 KiB serialized source, 2,048 attacks, 768 KiB serialized attempt and 64 records. Evidence overflow interrupts instead of silently dropping attacks. Retention and writes share one transaction: evict old terminal evidence first in start-date order while protecting recent active records; abandoned starts become eligible after 24 hours. A full set of protected recent starts blocks a new write. Corruption, stale revisions, changed identity/provenance, quota/transaction failure and rewritten terminal evidence fail closed. No migration, dependency, generalized engine registry, Rolodex record, auto-enrollment or A2 feature is introduced.

## Filename counters and suggested print titles (implemented 2.9.21 checkpoint 1)

Committed baseline is **2.9.20**, HEAD `1003fa1a57678cfe11ed1235d7da275c49853602`. This checkpoint changes filename preferences and print lifecycle presentation only; calibration, replay, evidence schemas, serializer bytes and practice ownership are unchanged.

`lib/files/download-counters.ts` is React-independent, with injectable localStorage access. Keys use `prelude-download-counter-v1:` plus a JSON tuple of the existing sanitized stem and exact extension. Records are `{ version: 1, highWater }`, integer 1–999. Equal final filename identities share a sequence across activities; `.json` and `.prelude.json` remain distinct. Opening reads without writing; normal delivery acknowledges only after initiation returns, and native Save As only after successful writable closure. Cancellation, denial, failed/uncertain saves and detached operations do not advance. Acknowledgment re-reads storage and takes the maximum of the stored, tab-retained and submitted numbers before writing; localStorage is not an atomic cross-tab reservation and simultaneous tabs may suggest the same name.

Automatic suggestions start at 001, track Name edits and storage events, and stop at exhausted 999 with an empty Number plus instructions. Explicit Number edits survive Name/storage changes; lower successful numbers never lower the high-water mark. The selected original suggestion is counted after a successful native rename; the actual selected filename is displayed but arbitrary picker names are not tracked. Corrupt records remain untouched on opening and show a warning; an acknowledged export can replace that identity's record. Storage failures retain an in-memory high-water mark for this tab. No disk-file detection, cloud state or musical take/segment numbering is involved.

`lib/files/print-filename.ts` reuses Unicode sanitization for piece titles and preset report titles, avoids a duplicate trailing `_report`, and always suggests `_001` without `.pdf`. No PDF counter or new download format exists. Staff Builder's library and Study View share `StaffBuilderPrintFlow`; Piece Practice and Practice Session retain their own report composition. Each supplies a title to `useBrowserPrint`, which sets it immediately before the existing scheduled `window.print()` and restores it on afterprint/cancellation, errors, fallback, unmount, print-media exit, pagehide/pageshow and freeze. An ownership token and original-title inheritance fence overlapping/stale cleanup; unrelated title changes are preserved. Synchronous afterprint does not arm a stale fallback. Browser PDF filename/destination behavior remains best effort; no save confirmation is inferred.

## Adjustable violin readiness (implemented 2.9.21 checkpoint 2)

`instrument-learning/calibration-preferences.ts` owns `prelude-violin-calibration-tolerance-v1`, a browser-local `{ version: 1, toleranceCents }` record validated as an integer 1–30. Absence, corrupt/unsupported data and blocked storage use 10 without write-on-load; a failed save leaves the selected value active for the run with a warning. Ocarina does not read this preference or acquire a calibration workflow. That historical checkpoint retained package 2.9.21 and extended entry 16; release candidate 2.9.22 appends a separate entry 17. Checkpoint 1's naming/save contracts stay intact.

Fixed beginner policy v3 remains unchanged, as do precise v1 and historical beginner v2. New violin owners explicitly select `ADJUSTABLE_CALIBRATION_POLICY` v4 with default readiness ±10 cents. Only comparison of the stable median against the readiness boundary changes: `abs(medianCents) <= selectedTolerance + 1e-9`. Raw analyzer eligibility, four samples/90 ms coverage, spacing, candidate compatibility, median/spread/MAD/agreement, freshness and fundamental/harmonic protections retain the v3 contract. The internal precise collector rejects overrides and retains its original behavior. No grading tolerance, onset detector or microphone-processing configuration changes.

The existing acoustic hook owns the preference and session snapshot. Editing is allowed only while capture is stopped, outside an accepted transition. A changed value records the unfinished reference as a retry with its old v4 tolerance, clears the collector/held assessment, advances the calibration revision and sets a fresh observation cutoff. Completed choices remain unchanged; subsequent attempts carry the newly selected tolerance. Settings alone do not create, start or replace capture/streams. Startup, summary, the existing bounded attempt limit and detached owners cannot change the setting. Strict Mode/unmount/background safeguards stay with the existing capture owner.

Scalar Analysis **schema 1** gains an additive, explicitly versioned extension: v4 calibration sessions and attempts carry `acceptanceToleranceCents`; v4 attempts also carry `policyVersion: 4`. `policies.adjustableBeginnerCalibration` describes v4 only when v4 evidence is present. Existing `policies.calibration` remains fixed v3, alongside unchanged precise v1/beginner v2 definitions. Old calibration/attempt shapes have no new override fields and retain their original classification. The validator requires valid effective tolerances and a v4 definition for v4 sessions. No durable Run V2, IndexedDB or Improv migration exists, and no audio/raw waveform enters scalar JSON.

The preflight slider and ±1 buttons have native keyboard/touch controls, a visible ±N-cent value and labelled accessible value (singular “cent” at 1). Fixed ideal/excellent ±5, recommended ±10 and adjustment ±25 bands continue describing measured tuning quality. V4 displays “Within recommended band” separately from acceptance, so ±30 can accept an otherwise red estimate without redefining quality. Measured signed deviation remains separate; a ±1-cent preference does not certify detector accuracy. There is no ocarina calibration.

## Saved Improv replay playhead (implemented 2.9.21 checkpoint 3)

Each `improv-replay.ts` run exposes a read-only `ImprovReplayTransport`: take identity, `positionMs()` and `active()`. Position is the existing scheduler's `now()` minus that run's `startedAtMs`, held monotonically within zero and `projectImprovTiming(take).durationMs`. Invalid/throwing reads preserve the last valid coordinate without scheduling events. Stop/failure sample and freeze that coordinate; natural completion retains the projected duration. A new replay owns a fresh reader starting at zero. MIDI scheduling, voices, sustain, note projections and raw evidence are unchanged. Capture pauses are already compressed by the shared musical projection; the reader never subtracts them again.

`useImprovReplay` publishes the stable per-run transport only at lifecycle transitions and retains its frozen reader after stopping/completion. Existing workspace/background/departure owners still call Stop/dispose; generation checks fence stale completion callbacks. `ImprovTakeReview` passes only a matching selected-take reader into the existing `ImprovPerformanceStaff`. Its archived timeline/index is memoized per loaded take, never rebuilt per frame. Manual range/Earlier/Later navigation is disabled during playback, returns afterward, and detaches automatic following until the next explicit replay. Replacement/deletion/collection changes keep the existing review-generation and departure protections.

The same renderer draws live capture and saved review. Replay RAF reads transport musical position and moves existing SVG playhead/group geometry without React state or archived queries. Indexed note-window slices update on the existing 100 ms timer, at most 512 notes; the viewport uses the existing 80% threshold and 12-second desktop/6-second narrow window. Saved note-length and pedal interpretations remain those of the archive, not the replay cursor. Reduced motion updates geometry at 10 Hz without RAF. Effect cleanup cancels frames/timers and guards stale callbacks across Strict Mode, replacement and unmount. HTMLAudio sample startup/output latency remains approximate; no independent clock, replay Pause/Resume, quantization, grading, evidence schema or second rendering engine is introduced.

## Preferred export folder and optional native Save As (committed 2.9.20; historical checkpoint)

Verified clean committed **2.9.19**, HEAD `e0c4f237b4d71b05fdbbe700e5edf588b96bcd69`. Application navigation opens **Settings → Exports** as a sibling modal; it does not change the selected mode, remount musical feature hosts, or transfer MIDI/microphone/recording ownership. Both export dialogs use the existing native `dialog.showModal()` pattern: background controls are inert, keyboard events stay inside the modal, and focus returns to its opener. There are no music-theory or serializer changes.

`lib/files/export-preferences.ts` owns one independent IndexedDB database, **`prelude-export-preferences`**, version 1, store `preferences`, key `preferred-directory`. The record contains only `{ version: 1, directory }`, with the opaque directory handle; it contains no export bytes, audio, MIDI or musical evidence. The observable store and its small React subscription hook share this app-level preference across Settings and exports without merging feature state machines. Opening either dialog loads the preference and re-queries current permission on cached handles before enabling native saving; it never requests permission or opens a picker automatically. Choose Preferred Folder and Check/Renew Access invoke native selection/request directly from user interaction. Forget removes the preference, not files. A failed clone/write keeps the chosen handle for this tab and accurately reports that it was not remembered; failed removal warns that the preference may return after reload. Unsupported storage, stale handles, denied/expired access and restricted APIs leave normal downloads available. Only the actual folder name is displayed, never a filesystem path. Chrome's global download settings are not changed.

`DownloadDialog` keeps the existing immutable Blob, Name, Number, fixed Format and Filename Preview. In a secure context with both native APIs and a configured folder, it offers **Save As…**, **Download Normally** and **Cancel**. The preferred folder is a suggested `startIn`, not an automatic destination. Enter from filename fields invokes the same synchronous native handler when preferred access is usable; unresolved or unavailable access requires an explicit destination choice. Download Normally has an independent explicit handler. Without a preferred folder or native support, Enter retains ordinary downloading. Both routes share the synchronous duplicate-operation fence. The preference is loaded before native saving is enabled; denied/prompt/stale access requires an explicit renewal, reselect or Save As elsewhere choice. A rejected `startIn` is never silently retried without it. Native failure/cancellation never initiates an automatic browser download. Ordinary downloads remain the default when unsupported/unconfigured, and manual 001–999 numbering, reserved 000 and Unicode sanitization are unchanged; no suffix counter is added.

`lib/files/native-save.ts` exposes the small native handle/picker boundary and completion outcomes. The picker is invoked synchronously by the click handler before any await; it receives the preview filename, usable preferred handle, and only the actual format's MIME/extension. A returned incompatible extension is refused without renaming. The original captured Blob is written without conversion; **Saved** is reported only after successful stream `close()`. **Download requested** continues to mean ordinary browser delivery with completion unverified. Cross-realm AbortError detection distinguishes cancellation from failure/uncertainty. A synchronous operation fence prevents duplicate picker/write operations; AbortSignal and mount generations prevent late callbacks or writes after detach, and unsuccessful writes attempt abort without claiming restoration.

**Native replacement is not transactional safety.** Preserved owner-operated Windows Chrome 154 QA demonstrated explicit replacement confirmation and original preservation when replacement is declined. In the final identity-verified test, native selection changed the original **388 bytes to 0 before application writing**, then the intended **404 bytes** were written, closed and read back exactly; Node independently confirmed the final bytes/hash. The interface warns before Save As that accepting replacement may erase prior contents even if writing later fails. Failure/uncertainty messages acknowledge possible destination changes, including after extension refusal. Neither abort nor file identity establishes rollback or atomic replacement. Captured export Blobs remain available for explicit retry; feature evidence and temporary recordings remain owned by their original feature and are never automatically discarded. This accepted limitation is specific evidence for the tested Chrome setup, not a promise for every browser/device/filesystem. Native overwrite QA was not repeated during implementation.

The destination outcomes reach Staff Builder score JSON, Improv MIDI/collection JSON/temporary room audio, Piece Practice microphone recordings, and Acoustic Analysis JSON. Analysis uses its existing notice boundary to acknowledge native completion without requesting another download; collection/loss notices retain their ownership. Room-audio acknowledgment changes only its completion notice, not retention or departure guards. Native Print / Save as PDF stays browser-controlled. VexFlow splitting, singleton React ownership, lazy features, PWA update/offline policy and Workbox's existing size limit remain unchanged.

## App-controlled download naming (committed 2.9.19)

Verified clean committed baseline **2.9.18**, HEAD `20f9e0f543fa72a23000274ff06b63d63612b6a5`. `lib/files/download-filename.ts` is the sole sanitization/numbering policy: NFC Unicode letters/numbers/marks remain recognizable, unsafe separators become underscores, control/format characters are removed, stems are bounded to 120 UTF-8 bytes and empty names use feature-specific fallbacks. Manual numbers 1-999 format to three digits; 000 is reserved. Every new dialog starts at 001 without a counter or remembered number. Extensions are fixed by the existing format: Staff Builder `.prelude.json`, MIDI `.mid`, collection/scalar JSON `.json`, native microphone `.webm`/`.m4a`/`.ogg`. Filename numbers never become take numbers or segment identities.

`DownloadDialog` edits only name/number against one captured immutable Blob and fixed format/description. Staff Builder serializes its saved canonical snapshot before opening; Improv prepares committed collection JSON or the existing MIDI projection once; audio keeps the original finalized Blob; Acoustic Analysis prepares its existing scalar serialization before opening. Later source activity or parent rerenders cannot replace the open dialog's evidence. Feature callbacks update download-request notices only. Cancellation/unmount releases the dialog reference without discarding recordings, changing drafts or resaving evidence. Focus returns to the opener, Tab/Shift+Tab stay within the modal, Escape cancels, and the dialog reflows at 320px. Feature ownership, recording/timing/JSON schemas and report contents remain unchanged.

`lib/files/browser-download.ts` owns the ordinary anchor delivery and temporary URL cleanup. Anchors are removed immediately; successful requests retain their URL for one second so the browser can consume it, including after feature/dialog unmount; failed initiation revokes immediately. Audio preview URLs remain recorder-owned until explicit discard or departure. Requests are reported as **Download requested**, never proof of a safely saved file. Ordinary downloads use no folder handles or filesystem permissions. Browser collision behavior remains browser-controlled; native Print / Save as PDF and clipboard operations bypass this naming dialog. Optional native destinations are described above.

## Production notation vendor boundary (committed 2.9.18)

Verified baseline: clean committed **2.9.17**, HEAD `604b67213533bedea5d3bffa09630fc72fdcfa99`. Vite 8.1.4 / Rolldown 1.1.5 uses `build.rolldownOptions.output.codeSplitting.groups` to place only the VexFlow package into one statically imported `vexflow` vendor chunk. The module filter normalizes Windows separators and matches the package directory inside both ordinary and pnpm paths. Existing static notation imports and all six embedded fonts remain; Free Play notation is available on startup. React/React DOM stay together in the main runtime. No application ownership, MIDI/audio lifecycle, score semantics or routing changes are involved.

The emitted main is **975,880 bytes**, down from **2,096,576**; vendor is **1,119,962 bytes**. Headroom under Workbox's unchanged 2 MiB per-file cap is **1,121,272** and **977,190 bytes** respectively. Generated HTML preloads the vendor, all application JS chunks resolve and are precached in the existing **35-entry** manifest, and the static chunk graph is acyclic. Improv (**113,661 bytes**) and Study View (**7,048 bytes**) retain their lazy boundaries. This creates budget headroom and a separate vendor cache identity, not an asserted startup speed improvement: eager notation still downloads both chunks and all fonts, with one additional preloaded request. Cache globs, offline/update policy and the cap remain unchanged; future additions still require actual production artifact checks.

## Improv coordinated Pause/Resume (committed 2.9.17)

Verified implementation baseline: clean committed **2.9.16**, HEAD `75629f8787f861ebc726e1af2708c581b3d31424`. Both physical-book First-Take Sight-Reading and Free Improvisation allow deliberate pauses inside one immutable take identity/number. A pause is a practice convenience, not a first-take violation. This section extends the historical Phase 2-7 contracts below; Piece Practice, Staff Builder, the shared MIDI/microphone owners and audio-retention policy remain unchanged.

### Evidence and durable coordination

New workspace captures use record/metadata version 2 and an append-only control list. Each control has its own contiguous sequence, the preceding raw-event watermark, the original observed clock/context validity, its kind and observed audio state. One full cycle is `pause`, `pause-ack`, `resume-request`, `resume-ack`, `resume`. These distinguish intent, native audio acknowledgment, durable authorization and effective musical cutover. Raw MIDI received during a pause remains immutable continuity evidence, including attacks, releases, system messages and all CC64 values. Only display/playback/metrics interpretation excludes it. Existing version-1 captures retain their shapes and uncompressed timing.

IndexedDB stays at database version 1 with the same stores; record versions change, not the database schema. Atomic checkpoints append control prefixes alongside raw prefixes and advance independent raw/control committed watermarks. Controls cannot precede their required raw watermark, be rewritten, skip a sequence or regress metadata. Silence checkpoints renew the existing writer lease throughout intentional pauses. Retry retains the exact failed operation; recovery remains an explicit lease-fenced incomplete prefix, never an automatic Resume.

Pause closes the musical gate synchronously before waiting for native audio or storage. Its acknowledgment must be durable before Resume proceeds. Resume first durably commits its request, revalidates physical source/ownership/foreground/lease, awaits native audio Resume if still healthy, and durably commits `resume-ack` authorization. Only then does a fresh observed `resume` boundary open the musical gate. Sampling this effective boundary after storage waits prevents storage latency from becoming musical silence. That effective cutover is checkpointed atomically before/with every resumed raw-event prefix: a crash before its acknowledgment can leave only a durably authorized but still paused prefix; it cannot commit resumed events without their cutover. A failure saving the effective cutover terminates capture conservatively and retains the suffix for Retry. This is durable authorization before resumption, not a claim that the later observed cutover was already saved before it was observed.

Session phases are Ready, Recording, Pausing, Paused, Resuming, Stopping, Saved, Interrupted and Failed, separate from MIDI storage and audio finalization statuses. Storage failure before coordinated Resume leaves a safely paused take requiring explicit Retry Save. A failure after coordinated Resume starts or authorization completes interrupts the attempt. Stop works while paused and during native/storage transitions, fences their continuations by generation, and finalizes the same take at the observed terminal boundary without inventing Resume. Device/owner loss, background/freeze/pagehide, expired lease and limits remain genuine interruptions even while paused; reconnection never resumes. A new take cannot receive an earlier transition's callbacks.

### Wall time, musical time and crossing notes

`improv-musical-time.ts` supplies a React-independent incremental musical clock and bounded channel/pitch continuity filter. The shared Phase 4 receipt-relative timing policy first establishes monotonic approximate elapsed coordinates, retaining delivery order and anomaly reports. Musical time subtracts observed intentional pause intervals; an open pause ends at the projected terminal boundary. Original browser/receipt/control timestamps stay untouched. Equal times retain order, regressions hold position, and the existing seven-day coordinate bound/fallback uncertainty remains. Live rolling staff, saved review, summaries, sampled replay and MIDI file export consume this same interpretation. Review reports musical duration, actual elapsed duration when known and pause count. Future analytics must explicitly select a clock and exclude paused/context-only events rather than treating raw delivery count as performance count.

Pause cuts visible key-down trails and releases only generated playback/export voices; it does not create raw note-offs. Held pre-pause and paused attacks become FIFO ghost counts keyed by channel/pitch. Their later releases consume ghosts before newer active voices, including velocity-zero releases and overlapping equal pitches. No post-resume attack is inferred for a still-held key. This deterministic matching cannot establish physical voice identity when hardware omits releases. Paused CC64 remains evidence; the last explicitly observed value may restore the conventional playback threshold at Resume, while unobserved initial pedal state remains unknown. Acoustic sustain/half-pedal behavior is not inferred.

MIDI export keeps type-0/fixed transport timing but removes intentional breaks; replay uses the same musical positions. Generated pause-boundary cleanup, terminal cleanup and observed-controller restoration carry distinct provenance; canceled/failed replay cleanup has an explicitly unknown performance-time position; omitted paused/context releases are reported separately. Replay prefilters excluded events once before scheduling, avoiding a giant timer burst when a long paused raw-message prefix collapses to one musical time. Version-2 JSON preserves original events, timestamps and controls; legacy-only exports remain version 1. Strict restore accepts both backup versions, validates the matching record/control prefixes and creates a fresh collection without altering original Take 1. Audio remains absent from JSON/IndexedDB.

### Room audio, bounded work and presentation

The feature-local room recorder facade uses native `MediaRecorder.pause()`/`resume()` and waits for matching native events/state, with a ten-second bound. It reuses Piece Practice's sole recording-only track owner and finalizer without changing them. Pausing keeps the acquired microphone; it requests no new permission and creates no second recorder/segment. Stop from native paused state finalizes the same temporary blob. Request and acknowledgment clocks are retained in temporary timing details; audio/MIDI edges are approximate and can differ during native/storage transitions. Native container downloads stay unchanged. Observed wall span includes breaks and is not decoded audio duration or sample-accurate synchronization.

An independent microphone error/track loss/limit retains legitimate audio where the native container permits, clearly reports audio stopped, and leaves healthy MIDI running; later MIDI-only Pause/Resume is permitted. A coordinated transition failure, inconsistent native state or failed post-resume acknowledgment instead interrupts the combined take and preserves available prefixes. MIDI save and audio finalization stay independent. Unsupported native Pause/Resume disables coordinated Pause with an explanation; users can still Stop. Browser buffering/last-chunk validity and temporary-audio loss on reload remain limitations.

Existing raw count (100,000), 64 MiB take accounting, 2,048-event/8 MiB unsaved backlog, lease/checkpoint policy and room-audio wall-duration/byte budgets remain. Paused MIDI and control evidence consume these limits; paused time counts toward the existing twenty-minute room-audio wall limit. Controls add a 2,560-observation cap (512 complete pause cycles) and count toward the same byte budgets. No per-message React updates, extra MIDI listener, per-frame journal copies, database migration or precache-cap increase is introduced. Live intervals remain capped at 4,096 and visible output at 512; saved review retains its bounded interval index. Musical animation freezes while paused and continues in the existing 12/6-second viewport without a silent break. All new product code stays in the lazy Improv feature.

Pause/Resume and Stop Take remain beside the primary controls with visible disabled/transition status and focus treatment. Timer/playhead explicitly use musical elapsed seconds; a compact note explains that paused MIDI remains in JSON evidence. Held-note text is supplementary and never announced per event. Reading/saved-window keyboard navigation, reduced-motion treatment, temporary-audio departure protection and independent first-take selection remain. The staff is an approximate time-based performance picture, not inferred conventional rhythm, sheet music, score validation or grading.

## Improv rolling performance staff (committed 2.9.16; historical architecture)

Baseline: clean committed 2.9.15 at `22c503849c4c51c63dd10197ce73dbabdd7f4ade`. This is a time-based performance display, not conventional transcription or a validated Staff Builder score. No evidence schema, persistence limits, MIDI owner, grading, recorder, audio lifecycle or permissions change.

`improv-workspace-session.ts` feeds `createImprovTimeline` only the single newly accepted immutable event obtained through the recorder's watermark cursor after persistence `append`. The final accepted safety-limit event is included; rejected events and post-terminal deliveries are excluded. The existing journal remains authoritative. `projectImprovEventTiming` extracts Phase 4's existing receipt-relative-to-Start policy for both incremental live projection and saved review. Equal timestamps retain delivery order; regressions hold the previous position; unusable receipts use explicitly uncertain browser fallback or previous position. Raw timestamps remain untouched. A seven-day coordinate bound and monotonic display clock prevent anomalous jumps. Terminal metadata freezes at a valid observed end or the safely projected accepted prefix; no note-off is fabricated.

`improv-timeline.ts` pairs releases FIFO by channel/pitch, including velocity-zero note-on releases. CC64 >= 64 is only an observed pedal indicator; trails show key-down time independently of sustain. Missing releases remain null and use dashed frozen trails capped at the displayed end. Initial held/controller state remains unknown. Live projection retains at most 4,096 note intervals, prunes closed intervals behind the window, and retains bounded per-channel/pitch omitted-attack counts to preserve FIFO after detail eviction. At most the newest 512 intersecting note intervals enter a rendered slice, in their original delivery order; missing releases cannot permanently hide recent attacks. A visible detail-limit notice distinguishes display omissions from authoritative evidence, which is retained by the unchanged capture/persistence systems.

`components/improv-performance-staff.tsx` is a narrow SVG temporal renderer, not another score engine. It reuses Free Play's key-aware spelling and diatonic letter/octave positions. E4-F5 and G2-A3 define treble/bass staff lines, with ledger lines. Written pitches outside C2-C6 use explicit labeled octave displacement into that range; actual names/pitches are retained, including the full MIDI 0-127 range. This prevents extreme ledger stacks and unbounded height; it is a display choice, not transposition of evidence. Every displayed accidental is explicit; the selected display key affects spelling only.

The viewport is 12 elapsed seconds, or 6 seconds below 500px of available staff width. The blue playhead advances initially, then the timeline scrolls continuously after 80% of the time window, preserving 20% future space. Faint guides mark elapsed seconds, never beats/measures. Narrow windows retain recent twelve-second context for subsequent widening. Continuing trails retain actual pitch labels after the attack scrolls out. Responsive SVG coordinates keep noteheads legible; height is 240-360px. React obtains bounded note slices at at most 10 Hz; animation frames move existing SVG groups/playhead/trails without React commits or history scans. Reduced motion uses the 10 Hz presentation instead. Ready/frozen/review snapshots do not repeatedly commit when unchanged. Frame/interval/resize cleanup fences stale callbacks; replacement hides earlier-take geometry until its new slice arrives. Physical MIDI ownership/room-audio lifecycle remain unchanged.

Saved Review calls the existing immutable `loadTake()` path. `timelineFromTake` builds one derived interval index within the existing 100,000-message take bound, then uses a max-end tree to query earlier/later windows with bounded output. Long-held intervals crossing windows remain visible; no whole-take render or per-navigation full scan occurs. The slider (0.1-second keyboard steps, Home/End) and Earlier/Later 10 seconds buttons change presentation only. First-take history remains independently selectable after later captures; switching selections resets the window. Known versus uncertain ends use the same Phase 4 committed-prefix checks as replay/export. Synthesized replay remains independent and does not follow the visual playhead. Text descriptions/held keys provide a fallback without announcing every MIDI note; controls retain visible focus.

Room audio remains optional, temporary and excluded from MIDI/JSON backups. Browser-local MIDI retention remains evictable; accepted evidence can still exceed display detail and unsaved suffixes can be lost on termination. Simulated browser MIDI cannot establish physical key timing, acoustic sustain, sound fidelity or screen-reader support.

## Staff Builder quality-of-life (committed 2.9.15; historical validation)

Baseline: clean committed 2.9.14 at `8af1fde64f12b90110ebfc3fa25bff50e730d0ba`. This patch changes Staff Builder viewing and editing controls; score V4, library V4, draft V3, music theory, Piece Practice grading and other input owners retain their contracts.

The library's **Study View** action passes a saved ID to `StaffBuilderSession`, which reads a fresh parsed snapshot through `readStaffBuilderLibrary`. Missing/deleted, corrupt, unsupported or unavailable storage produces an error without opening an editor. The existing full-sheet `StaffBuilderStudyView` receives that snapshot unchanged, including title, context changes, measures, ties and annotations; annotation visibility and print options remain presentation state. Viewing never invokes `openPiece`, draft creation, validated Save, practice projection or practice-recency writes. The library remains mounted but hidden while studying, preserving sort, recovery-draft ownership and opener focus. Exit/Escape returns to that action. Active-editor library access still requires the existing Return to Piece Library confirmation; no route bypass was added. An unresolved newer recovery draft is preserved while another saved piece is studied.

`useStaffBuilderEditor` owns the transient **Lock Editing / Unlock Editing** state. It defaults unlocked on each editor mount (including another piece, mode re-entry or return from Practice), persists through editor Study View, and is absent from score/draft schemas. A mutable command-access fence changes synchronously before React's visual toggle updates, and layout-effect cleanup rejects callbacks retained after real unmount. The same `canEdit` guard protects pending physical/virtual pitches, capture commits/rests/advancement, pass and capture-position changes, measure insertion/deletion, rhythm edits, annotation/lyric edits, ties, key/time/clef/tempo changes, corrections and history commands. The rhythm hook checks it before mutation dispatch or deletion-selection changes. Final persistence also refuses score replacement while locked. Queued pending-pitch updates recheck the fence.

Toggling does not persist, clear pending pitches, replace the score or consume history. Native disabled fieldsets/buttons and omitted notation mutation callbacks supplement the command fence; active notation menus close when their editing callbacks disappear. MIDI registration/connection and existing piano feedback stay available; note-off and pedal edges still flow through the provider, while locked pedal commits cannot change the score. No new MIDI owner, collector or feedback engine is introduced. Viewing selection and existing-measure navigation remain in memory while locked without autosaving; pending pitches disable measure navigation so they cannot move to another onset. Capture-position advancement, pass switches, validation/Save and Undo/Redo require unlock. Reading, scrolling, annotation-layer visibility, Study View, existing print/copy, playback and guarded departure remain available. Unlock resumes the retained draft, pending capture and history.

Both Study View entry points use local React lazy/Suspense loading of the same existing component. Initial eager implementation exceeded the existing 2 MiB PWA per-file cap; the isolated Study View chunk restores precache generation without changing the cap or rendering engine. Production validation checks that this chunk remains precached. Browser-native zoom and scrolling retain their existing behavior; no new zoom control is introduced.

## Improv playing-first workspace (committed 2.9.13; room audio committed 2.9.14)

`App.tsx` adds Improv beside Free Play and a feature-owned departure callback. The workspace loads lazily through a local Suspense boundary: initial eager integration exceeded Workbox's existing 2 MiB per-file precache limit; feature code splitting preserves that limit and the offline cache rather than increasing it. The retained Practice Session builder's actual active-run state excludes the entire active Improv component, so exclusion mounts no consumer or library. Existing modes, microphone/audio guards and databases retain their contracts. `AppMidiConsumer.onOwnershipChange` is an optional lifecycle notification from the existing single provider: replacement and current-token cleanup report loss; stale cleanup cannot displace the new owner. Reentrant registration checks fence initialization. This adds no MIDI access owner or normalized-input changes.

`components/improv-workspace.tsx` coordinates two activities: physical-book First-Take Sight-Reading and Free Improvisation. Both require an explicit usable connected physical input and a named collection (blank titles get neutral defaults). Opening setup never allocates a take. Source selection is never automatically substituted, and Start rechecks source availability, MIDI ownership and foreground state. No virtual-keyboard evidence, score entry or accuracy grading is supplied. Optional key context affects spelling only. Committed 2.9.16 replaces the original held-only `MusicStaff` presentation with the bounded rolling performance SVG described above; held-note text remains supplementary. Playing controls/timer/device/save state precede disclosures for history, review, key context and backup.

`improv-workspace-session.ts` is a React-independent coordinator over the unchanged journal and persistence adapter. It starts a fresh recorder/writer for each explicit safe attempt, forwards raw events through persistence `append`, retains failed pending evidence and exposes constant-size metadata/save state. A separate channel/pitch held-key projection never becomes authoritative capture. `hooks/use-improv-session.ts` uses the existing `useAppMidiInput` raw-source contract; no normalized aggregate held state is recorded. It batches display observations at most ten times per second, keeps raw history outside React and leaves note names/timer out of live announcements. A fresh owner context identifies each registration; selected-device loss, consumer loss, hidden/freeze/pagehide observations end capture without invented releases or resumption. Strict Mode cleanup is idempotent; real unmount best-effort finalizes before closing the feature-owned database handle.

Capture status and `ImprovSaveState` remain independent. Confirmed number and Saved locally require actual allocation/terminal transaction acknowledgment; active checkpoints are not completion. Failed saves retain in-memory evidence with Retry. Navigation consults synchronous engine state, opens a native focus-managed Stay / Stop-or-Retry-and-Save / explicit Abandon dialog and proceeds after save only when acknowledged. `beforeunload` supplements protection while capture or unacknowledged evidence exists; it is not a guaranteed final-save mechanism. Actual unmount/page termination can still lose the uncommitted suffix. Phase 3 lease-fenced explicit prefix recovery remains separate from observed terminal boundaries.

`hooks/use-improv-library.ts` owns bounded metadata listings and fences stale async results. `improv-library-view.tsx` exposes numbered histories, immutable first identity (including deletion), rename, explicit prefix recovery and named confirmed deletion. Raw history is never edited. `hooks/use-improv-replay.ts` owns one explicit replay adapter and disposes on stop, background, navigation, replacement and unmount. `improv-take-review.tsx` presents descriptive observations and uncertainty without grades. `improv-file-browser.ts` owns temporary download URLs; downloads are reported as requested, not guaranteed completed. Collection JSON restore uses the existing validated atomic fresh-history importer, preserving original numbering/tombstones/provenance. MIDI export exposes omitted/generated-message counts and remains a projection. No database migration or storage-engine semantics change.

Phase 6 attaches `improv-room-audio.ts`, `hooks/use-improv-room-audio.ts` and `components/improv-room-audio-controls.tsx` beside the unchanged MIDI engines. They reuse Piece Practice's recording-only track owner and native MediaRecorder finalizer without editing those systems. Opening Improv requests no microphone. An opt-in followed by explicit Prepare requests audio only, using the default microphone and ideal disabled echo cancellation/noise suppression/automatic gain control; browsers may ignore those preferences. Start waits for the recorder's native start notification, rechecks MIDI ownership/source/foreground through the existing Start boundary, and only then begins MIDI. Failed preparation consumes no take and offers an explicit MIDI-only choice. Every later take defaults to MIDI only.

Room-audio phase and MIDI save phase are independent: Saved locally still acknowledges only MIDI IndexedDB. Audio has disabled/preparing/ready/starting/recording/finalizing/available/failed/discarded states. `use-improv-session.ts` provides feature-local terminal notifications for Stop, device/owner loss and capture limits; background/freeze/pagehide and actual teardown stop the room stream too. Audio failure stops only audio. Startup has a ten-second bound; the reused microphone owner bounds permission preparation at thirty seconds and the finalizer at ten seconds. No implicit resume occurs. Strict Mode creates no stream until explicit preparation and fences real teardown; generations exclude old permission/recorder callbacks.

One recording result is retained in memory only. Shared limits stop at twenty minutes or near fourteen MiB, allowing final chunks toward a sixteen-MiB budget. A feature-local recorder facade hard-bounds accepted chunk data at sixteen MiB, refusing/reporting a whole oversized chunk rather than inventing a clipped container; the valid retained prefix may be unavailable if the browser provides no usable container. Browser-owned buffers and the transient incoming chunk are outside this application retention bound. Preview URLs belong to that result and are revoked on explicit discard/unmount; download URLs use the existing one-second cleanup. Native WebM/Opus, MP4/M4A or Ogg containers use the actual produced MIME/extension. Empty/unknown containers fail honestly. No conversion, audio database/cache storage, upload or JSON inclusion is introduced.

An unhandled result protects new-take replacement, collection switching, deletion and departure. A download request does not clear that protection: users verify their file and explicitly discard temporary audio. Stop-and-Save during departure retains audio and returns to review; explicit Leave Without Saving abandons temporary audio as well as any unsaved MIDI suffix. A supplementary beforeunload warning is not a guaranteed final flush. Reload/termination may lose audio even when MIDI is durable. Synthesized replay is excluded while preparing/capturing/finalizing audio; preview is explicit and stops on replacement/unmount. Timing records microphone request/readiness, browser-monotonic recorder start/stop-request/finalization, time origin and MIDI observations; any displayed start offset requires matching known origins and is approximate, not sample alignment or physical latency. The observed recorder span is not a verified decoded audio duration.

Owner-reported completion of five initial Phase 5 physical-piano checks is limited MIDI-workflow evidence. Room-microphone fidelity, real-device permissions, assistive technology, browser zoom, quota/eviction and cross-tab crash QA remain distinct from deterministic tests and local simulated-MIDI/native-MediaRecorder Chrome QA.

## Advisory ocarina fingering (2.9.8, committed)

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

This section records the fixed-policy foundation through 2.9.20. Implemented 2.9.21 checkpoint 2 above added v4 readiness and a violin tolerance preference without redefining these historical policy contracts.

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

Reading Flow uses `MelodyActiveScore` as one visual window into that full, unchanged display score. The existing native display-measure index and local/absolute ticks select the preparatory measure during count-in, then each authored exercise measure and its count guide. No display transition generates music, advances a transport or changes evidence. Setup previews the first authored measure; completion retains the existing results and explicit Try Another workflow. Resize, keyboard visibility and Focus only change presentation.

The opt-in `StaffBuilderScoreView.readingFlow` policy formats one single-staff measure to available width at 18px staff-line spacing, or 22px with the keyboard hidden. The renderer retains its vertical geometry reservation for stems, ledger lines and accidentals; the compact single-staff baseline removes unused second-staff space. A minimum 440-unit musical canvas prevents dense eighth notes/signatures from being crushed on narrow devices. One horizontal notation scroller follows the authoritative playback highlight, resetting at measure boundaries; there is no outer score track or permanently reserved lead-in column. Staff Builder, Piece Practice, print and report renderers retain their default 760-unit geometry and existing fitting behavior.

Melody-only hosted Focus/Mobile Play uses a reachable sticky host strip and one vertically scrollable playing region when height is limited. The same native connection/audio controls remain available, and Finish Lesson delegates to its existing host callback. Hosted Flashcards explicitly omits its redundant native Focus Staff control; standalone Flashcards retains that control and its own focus state. Neither change creates a new input, audio, executor or focus owner.

Timed practice stores each completed original attempt as immutable diagnostic evidence under stable trial identity. Session Review derives summaries and review order without rewriting those originals. Repair attempts append to a separate retry history, allowing the UI to compare the original Sight Read with the latest Repair while retaining every retry. Interval analytics aggregate transitions from original results into the Sight Read dataset and retry results into the Repair dataset; neither dataset is persisted beyond the in-memory session.

App-level MidiProvider ownership remains separate from Melody attempt/source locking. Shared piano WAVs are PWA-precached; metronome clicks are oscillator-generated. No Melody exercise, attempt, result, or analytics is persisted.

Melody calls `useMobilePlay` once inside the mounted `MelodySession`. Entering or exiting the focused presentation may occur during setup, audio startup, count-in, performance, results, or Session Review without replacing the generated exercise, AudioContext, performance clock, recorder, first-input-source lock, MIDI consumer, PianoKeyboard, score/count guide, result, or diagnostic history. The existing visibility-interruption policy still cancels an active starting, count-in, or performing attempt when the document becomes hidden; completed timed trials remain available for review. Duration and hold grading are not part of Melody.

---

# Overview

Prelude is a browser-based musicianship application for learning piano through standard notation and real-time input.

The current application provides ten top-level modes/tools: Flashcards, Sequences, Free Play, Improv, Ear Training, Melody, Staff Builder, Practice Sessions, MIDI Diagnostic and Chromatic Tuner. Piece Practice launches from Staff Builder; Targeted Practice sits inside its completed results. The working release candidate is 2.9.22 against committed baseline d0e4a5e; owner release and deployment remain pending. Together they support:

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

### Raw MIDI transport foundation (committed 2.9.9)

`src/lib/midi/midi-transport.ts` defines immutable `RawMidiMessage`, `MidiInputInfo` and `MidiInputConnectionChange` contracts. The existing `useMidi` owner samples `performance.now()` on handler entry, increments an owner-lifetime message sequence, and copies/freezes the complete delivered bytes before normalization. Raw provenance is `browser-midi-message`; availability observations have `input-availability` provenance and are never fabricated note/pedal messages. Missing/unreadable data has explicit status; empty/truncated/unexpected bytes remain evidence. Original numeric browser timestamps, including anomalous values, are unchanged; unavailable timestamps are null. Receipt order is authoritative even when timestamps are equal or regress. Neither clock measures physical key-contact time or device latency.

`useAppMidiInput({ onRawMessage, onInputConnectionChange, rawInputId })` registers through the same token-safe active consumer as normalized music callbacks. Omitted `rawInputId` observes all sources; an explicit ID filters only raw messages and availability changes to that browser input ID, including reconnect notifications. It never substitutes another input when the selected source disappears. Normalized callbacks, aggregate held/pedal state, deviceName/status and existing modes retain their all-input behavior. A future selected-source journal should consume raw callbacks rather than aggregate normalized callbacks. `connectedInputs` exposes frozen browser ID/name snapshots only after explicit MIDI connection; unavailable metadata is null, cannot identify a selected source, and is not replaced with an invented ID. These identifiers are browser/session scoped and not promised stable across browser restarts. Transport does not persist them; Phase 3 retains them only as take provenance, never as reconnection keys. Initial attachment publishes connected availability to the current consumer; registration does not replay messages or availability history, so consumers inspect `connectedInputs` for current availability. Global connection status can remain connected while a selected source is absent.

Input listeners use per-attachment identity and effect-lifetime checks, including for the same port object reconnecting. Queued deliveries remain evidence until an availability notification retires their attachment; a changed port state alone does not discard them. Cleanup removes listeners; late permission results cannot attach after owner retirement. Consumer callback/selection refs update at layout commit, old registration cleanup cannot clear a replacement, and a replacement during raw delivery cannot receive that message's normalized remainder. No event history or per-message transport state is retained in React; context metadata changes only with input availability. Legacy held-note rendering remains feature-owned. Transport delivery sequence spans consumer changes and is not a take-local sequence; excluded messages can produce gaps. Supported system/short/non-note messages reach raw callbacks without widening the existing permission request to SysEx access. MIDI Diagnostic retains its independent lifecycle and bounded history unchanged.

Improv Phases 1–3 provide transport, an in-memory journal and a feature-local persistent library. Replay/export, room capture and an Improv screen remain unimplemented. Physical MIDI timing/device QA remains pending. Hidden hosted Practice Sessions still own their engine registration: future Improv presentation must enforce the existing active-run exclusion rather than treating registration as a visibility-aware owner stack.

### Improv performance journal (committed 2.9.10)

`src/features/improv/improv-take.ts` defines immutable take metadata, raw event wrappers, separate connection observations, clock/owner context and explicit terminal boundaries. `createImprovTakeRecorder` in `improv-take-recorder.ts` owns exactly one in-memory take independently of React, Web MIDI and browser listeners. It exposes `start`, `append`, `observeConnection`, `stop`, `interrupt`, `metadata`, `readEvents`, `readConnections` and `snapshot`. Idle has no metadata; explicit Start creates recording metadata even with zero messages. Recording ends as completed or interrupted. First finalization wins; Stop is idempotent, later appends fail and Start cannot reset a used controller. A new capture requires a new controller and an injected unique ID factory. Phase 3 allocates take numbers independently of the journal.

The future consumer registers through `useAppMidiInput({ rawInputId, onRawMessage, onInputConnectionChange })`, confirms the selected ID in `connectedInputs` before Start, and passes transport callbacks directly to the recorder. No Phase 1 contract or normalized consumer changes are needed. Start requires a usable input ID and valid explicit monotonic observation. Messages from other/unidentified inputs are refused without changing the take. The selected ID/name is retained as browser-session provenance, not a stable hardware identity across reloads. A selected disconnection is retained separately with its take-event watermark and ends capture without release messages. A selected connected notification during capture is conservatively treated as reconnect/continuity loss and also ends capture; initial attachment must precede Start. Thus the connection journal naturally contains at most one observation. Reconnection never resumes a terminal take or substitutes another input.

The caller supplies a stable `ImprovCaptureContext` with document clock ID, MIDI-owner lifetime ID and `performance.timeOrigin` where available (otherwise null), plus explicit Start/Stop observations in the receipt clock. These are caller-assigned identities, not device measurements. A changed context or invalid/non-advancing transport sequence interrupts before accepting unrelated evidence; the terminal records the refused transport sequence when present. Gaps in the owner's sequence are retained as gaps, potentially caused by other sources, rather than asserted lost take messages. The owner identity must change when the underlying owner is replaced; the journal cannot discover an unreported owner loss.

Append invocation while recording determines membership. Original source/receipt timestamps, including equal, regressing, negative and nonfinite values, are retained unchanged with validity/regression flags; finite nonnegative means numerically valid, not physically accurate. Numeric browser timestamps remain explicitly `browser-event-unverified`. An event timestamp before Start or beyond a later terminal observation does not discard or rewrite delivered evidence. `inspectImprovEventTiming` provides separate numeric boundary relations with source-clock verification always false; invalid/regressing/mismatched terminal observations mark an uncertain end. No replay projection, sorting, quantization, note pairing, sustain interpretation, grading or latency estimate changes the raw journal. Original bytes, transport sequence and provenance survive intact, including malformed/unavailable payloads and system messages actually delivered by Phase 1. Take-local sequence is contiguous from 1. Unknown selected-device initial keys/controllers stay unknown: aggregate held-note state cannot establish them, and Start/Stop/disconnection invent no attacks or releases.

Default limits are **100,000 raw messages** and **64 MiB of conservative deterministic accounting**. Start metadata is charged at 1,024 bytes plus UTF-16 identifier/name lengths; each message is charged at 512 bytes plus 8 per byte value and UTF-16 source metadata; a connection observation is charged at 512 bytes plus source metadata. This is a provisional budget, not a browser heap measurement or allocation guarantee; snapshots/caller-retained references add memory. At 120 BPM, MIDI clock alone delivers 48 messages/second and reaches 100,000 in about 35 minutes; notes/controllers and higher-rate devices reach the cap sooner. Accepting the exact cap interrupts with that final event retained. A message exceeding the byte budget is explicitly refused, records its sequence in the terminal and preserves the complete prefix. Oversized Start metadata fails without starting; metadata exactly filling the budget preserves an empty started take interrupted at that boundary. There is no eviction or truncation. Callers must inspect returned terminal status even when the last append succeeds. Appends copy/freeze the current message and update constant-size metadata; only explicit snapshots copy full array containers, while bounded `readEvents` copies only the requested slice. Nothing triggers per-event React state updates.

The Phase 3 adapter consumes immutable `metadata()` and `readEvents(afterSequence, limit)` using an **inclusive retained watermark** (0 means empty), plus `readConnections()` and final status. Each event retains its transport sequence separately. Bound each read to the captured metadata watermark before any asynchronous save; later appends must not be paired with older metadata. Chunk writes should validate contiguous take-local sequences, atomically acknowledge their own durable watermark with compatible metadata, and persist terminal state even for empty takes. The in-memory `eventWatermark` is not a save acknowledgment; consumers must retain the controller until durable writes settle and track failures separately. Reads do not drain or delete the journal. Storage must preserve nonfinite timestamp evidence without naive JSON conversion, and distinguish recovered/incomplete recording metadata from an observed terminal boundary. No chunk writer, database schema, migration or durability claim exists in Phase 2.

The future lifecycle owner calls `interrupt` for consumer loss, hidden document, freeze/pagehide or capture unavailability, using an explicit observation. No global listener or existing navigation guard changes in this phase. Browser termination can prevent those observations and destroy all in-memory evidence; Phase 3 adds incremental durable writes and recovery for the last committed prefix; uncommitted evidence can still be lost. Hardware throughput, browser timing and actual lifecycle integration remain to be validated.

### Improv persistent local library (committed 2.9.11)

`improv-library.ts` defines the version-1 storage contracts, immutable structured-clone copies and typed failures. `improv-library-validation.ts` validates metadata, original boundary/clock uncertainty, raw event shape and derived flags, contiguous prefix/chunk structure, source identity and accounting. `persistence/improv-indexeddb.ts` implements `IndexedDbImprovLibrary`. It opens only on explicit operations, using a separate **`prelude-improv` database version 1**; no singleton is mounted and no existing database or retention policy changes.

| Store / indexes | Contract |
| --- | --- |
| `collections`, key `collectionId` | Named physical-book piece or improvisation session; activity, title, revisions/wall observations, immutable `firstTakeId`, monotonic `nextTakeNumber`, deletion tombstone. |
| `takes`, key `takeId`; `collectionId` and unique `[collectionId, number]` indexes | Immutable identity/number and writer token; latest observed capture metadata, committed watermark/accounting/chunk count, separate connection observations, continuity cursor, revision, checkpoint time, lease, storage status, recovery and last-operation receipt. Deleted takes retain only identity/number/deletion time. |
| `eventChunks`, key `[takeId, index]`; `takeId` index | Immutable append-only original event wrappers with explicit start/end take-local sequence. Chunks are added, never replaced. Loading assembles chunk-index order; it never sorts MIDI timestamps. |

Public operations create/list/rename collections, allocate/checkpoint/load/list/recover takes and explicitly delete takes/collections. All writes include all three stores in one readwrite transaction; native IndexedDB scope locking serializes allocation, fencing and deletion across handles/tabs. Reads use bounded requests in a readonly snapshot. Request callbacks enqueue dependent work synchronously within the transaction; success promises resolve only on `oncomplete`. Request success alone is not saved evidence. IDB errors/aborts roll back chunk and metadata together; blocked/unavailable/quota, stale/owned, corrupt/unsupported and limits are explicit errors. No failure-triggered cleanup or automatic eviction exists.

Start registration atomically adds a unique take, increments its collection counter and sets the original-first identity exactly once. It counts empty/interrupted captures. Cancel before Start performs no allocation. Retries of the same identity/token/Start return its existing registration without consuming another number. Simultaneous tabs are ordered by successful allocation commits, not cross-tab clock estimates. Before initial registration commits, the capture is pending in memory with no confirmed number; a failed transaction cannot reserve a durable Take 1. The future workspace must await registration acknowledgment and resolve failed pending work explicitly. A fresh recording uses a fresh take ID and writer token; reload/reconnect never resumes a stored take. Browser input/clock IDs remain capture provenance only.

Collection title changes never modify take evidence. Take deletion requires explicit matching ID, current revision and `confirmed: true`, and is refused while recording. Collection deletion likewise rechecks its revision and all recording owners in the same transaction. Expired active takes must first be explicitly recovered. Raw chunks and capture/source metadata are deleted; take ID/number tombstones remain. Collection deletion also clears the title and retains its ID/counter/first-identity tombstone. IDs and numbers cannot be recreated/reused; deleting Take 1 never promotes Take 2. A newly created collection with a new ID is a separate history. Phase 5 supplies the named confirmation UI; the storage engine itself remains presentation-independent.

`createImprovTakePersistence` in `improv-take-persistence.ts` forwards explicit Start/raw-message/availability/Stop/interruption operations to an injected Phase 2 recorder. Route messages through this adapter's `append` to enforce its unsaved backlog; direct recorder mutation is not the integration contract. React never owns the journal. Start owns one cancellable **2-second** checkpoint timer, including silence; Stop/disposal cancels it and drains terminal evidence. The adapter itself adds no visibility/unload listener, MIDI registration, permission request or existing guard changes. Phase 5 reports background/freeze/pagehide and consumer loss; the persistence engine remains environment-independent. `state()` exposes capture status, saving/pending/checkpointed/saved/failed state, confirmed number/watermark, pending counts/accounting and failure. Active checkpoint acknowledgment is `checkpointed`; `saved` requires the complete terminal transaction. The recorder snapshot remains accessible after failures for future backup/review.

The adapter permits one write in flight and coalesces flush requests. Each batch pairs immutable observed metadata with an ordered bounded event slice and only connection observations within that prefix. Committed watermarks advance atomically with chunks. Observed metadata may know about more events, or an actual Stop, than the committed prefix; those facts never imply a durable completed take. Finalization requires all observed events and connections, including an empty terminal take. A last-operation ID/revision receipt plus exact evidence comparison supports lost-ack retry without duplicate events; reusing an operation ID with different evidence is rejected. Confirmed progress only advances from completed transactions, never the in-memory watermark or an optimistic callback.

Limits are provisional and explicit: **1,000 collection identities** and **1,000 lifetime takes per collection**, including tombstones; pages at most 100 (bounded underlying collection reads at most 1,001); journal maximum 100,000 events / 64 MiB accounted; at most 1,024 chunks. Normal chunks contain at most 256 events / 1 MiB accounted. A larger single delivered message is stored alone, bounded by the journal's 64 MiB budget; it is never split/re-encoded. Default unsaved MIDI backlog is **2,048 messages / 8 MiB accounted**; bounded terminal/one-source-availability metadata is additional. Exact message limits end capture with the last accepted event retained; an over-byte-budget candidate is explicitly refused at an observed boundary, with `captureFailure` recording its sequence. The journal ends as `capture-unavailable`, preserves its prefix and cannot resume. Failed writes retain their prepared batch and journal; explicit Retry replaces no evidence. Metadata IDs/tokens are bounded to 1,024 characters, input names to 4,096 and titles to 256; invalid/incompatible data is refused without automatic repair. Accounting is not measured heap usage; full evidence loads/snapshots and caller references consume additional memory. Exhaustion never silently deletes old takes or reuses numbering.

Writer liveness uses a **30-second wall-clock lease**, renewed by committed checkpoints. Each mutation checks the immutable writer token, expected revision and current lifecycle; live writes after expiry are refused. The adapter checks expiry on delivery as well as timer/flush entry, so a delayed timer cannot silently accept returning notes. An explicitly stopped owner's retry may commit its complete suffix after expiry only if its token still owns the record and recovery has not revoked it. Recovery transactionally validates the committed prefix, checks expiry, clears ownership and sets separate `incomplete`/`lease-expired` recovery metadata. It does not change original capture boundaries/status or invent Stop, note-off or pedal-up. Thus an observed completed capture whose final flush was partial can remain an incomplete stored take. Late old-owner writes/finalization are fenced after recovery; there is no ownership transfer or capture resumption. Repeated terminal/recovery calls do not refinalize.

Wall time supports cross-tab liveness, not musical timing. Regressed checkpoint time is rejected; forward clock jumps or background timer throttling can expire a live tab conservatively. A returning tab may save its already-ended suffix before competing recovery wins, but must never resume after expiry. The lease is cooperative same-origin concurrency protection, not an authentication boundary. Future visibility/owner-loss wiring and real-browser multi-tab/clock behavior need QA. Abrupt closure can lose the uncommitted suffix (or the entire unregistered take). Native transaction completion is a browser-local acknowledgment, not a guarantee against disk loss, storage clearing or eviction. No persistent-storage permission or permanent room audio is requested.

Phase 4 consumes `loadTake()`'s immutable validated record and ordered chunks, preserving observed versus durable/inferred status separately. Native structured clone round-trips `NaN`, infinities, signed zero and null. Piece Practice, Staff Builder and Practice Session stores remain independent.

### Improv review, backup and playback (committed 2.9.12)

All Phase 4 modules are feature-local and independent of React, input capture and grading. These engines mount no UI, MIDI registration, microphone stream, automatic playback or global service; Phase 5 coordinates them. Original journal evidence, JSON backup, SMF projection, synthesized sample replay and future actual room audio are distinct representations.

`improv-performance.ts` exposes `projectImprovTiming`, `decodeImprovMessage` and `summarizeImprovTake`. Receipt timestamps relative to explicit Start are primary. Invalid receipts fall back to numerically usable browser timestamps with an explicit unverified-clock issue; otherwise the previous projected position is used. Negative/before-Start, nonfinite, regressing and beyond-limit positions are flagged; the projection holds delivery order without changing raw values. Equal times retain sequence order. Projection is bounded to seven days to prevent anomalous unbounded scheduling. A fully committed completed/interrupted take with a valid matching terminal clock retains its trailing boundary; incomplete/active/uncertain takes end at the last durable projected event, without asserting uncaptured duration. Delivered events beyond an observed terminal remain in the projection with a warning. No latency, performed BPM, meter or accuracy is inferred.

Descriptive summary includes attacks, pitch range, MIDI velocity minimum/maximum/mean (not acoustic loudness), observed CC64 count, repeated overlapping attacks, channel-aware key-down polyphony, unmatched releases/unreleased attacks, unambiguous receipt-time paired durations and explicitly projected inter-attack gaps. Same-pitch overlap uses FIFO for interpretation but ambiguous durations are omitted. Gaps are not claims of acoustic silence; no note/rhythm accuracy, phrasing score or coaching exists.

`improv-backup.ts` defines **`prelude-improv-backup` version 1**, `encodeImprovBackup`, `parseImprovBackup`, `improvBackupBlob` and `restoreImprovBackup`. Finite numbers are ordinary JSON; `NaN`, infinities and negative zero have explicit `$preludeNumber` tags; null remains null. The format identifies original delivery evidence and includes the complete collection context, all numbered takes/chunks and deletion tombstones. Requiring a whole history prevents a standalone later take from being imported as Take 1. Limits are 64 MiB UTF-8/file and aggregate committed accounting, existing 1,000-entry history limits, decode depth 64 and five million visited nodes; oversized backups fail explicitly without truncation. No arbitrary per-take JSON merge/import is offered in this phase.

`IndexedDbImprovLibrary.exportCollection` uses one bounded readonly snapshot and changes no evidence. `importCollection` validates the entire history through the existing metadata/chunk/source/timing/accounting validators, allocates fresh collection/take IDs, preserves numbering/counter and maps the original-first identity (including tombstones), checks collisions and writes all records/chunks in one native transaction. A duplicate or corrupt history is rejected; failure rolls back the entire destination. Restore always creates a separate history, never overwrites/merges existing records. An optional flat `importedFrom` holds original collection/take records; capture metadata (including original capture ID), source identities, events and boundaries remain unchanged. Chunk wrappers are reassociated with destination storage IDs, retaining indices/sequences. Repeated restores keep flat original provenance. Active snapshots become stored `incomplete` with separate `imported-prefix` recovery metadata, without invented Stop; originally incomplete records stay incomplete. Imported takes have no lease, no live writer/operation receipt and are explicitly fenced from allocation retries/checkpointing. New live captures in the restored collection allocate the next original number. Explicit deletion still requires confirmation and clears imported evidence/context when applicable.

This is a backward-compatible optional record extension to database version 1, not an object-store migration; existing native capture, leases, committed watermarks and first-take rules remain unchanged. Older builds that do not understand the extra provenance fields may refuse imported records. Validated restore preserves evidence but does not authenticate backup authorship, guarantee permanent browser retention or resume a capture.

`improv-midi-export.ts` exposes `exportImprovMidi` (`bytes` plus immutable report) and `improvMidiBlob`. Type-0 SMF uses one track, 10,000 PPQ (within the 15-bit metrical division limit) and a 1,000,000 µs/quarter fixed 60 BPM transport, giving 0.1 ms ticks. This is elapsed-time encoding, not beat quantization or performed tempo. Absolute positions are rounded before deriving deltas. Correct-length channel voice bytes retain channels, velocity-zero attacks/releases, release velocity, all compatible controllers and repeated CC64 values. Complete F0…F7 SysEx is length-encoded. Other system/common/realtime, malformed and unavailable messages are individually reported as omitted; SMF is never called a full provenance backup. Four-byte delta VLQs are limited to 0x0fffffff; longer gaps insert neutral zero-length sequencer-specific meta events. End-of-track retains the known boundary or explicitly uncertain prefix end. Unmatched note-on counts receive generated terminal note-offs and active sustain receives generated pedal-up only in the export projection, listed in the report. Output is bounded to 64 MiB. Independent test decoding validates the binary structure; actual DAW/player import remains QA.

`improv-replay.ts` exposes `createImprovReplay(sound, scheduler)` with explicit `play`, `stop` and idempotent `dispose`; each run returns completion, timing and ignored-message observations. Injection separates scheduling from sound. One pending timer advances the ordered stream against an absolute monotonic origin, avoiding per-message timers or React renders. Polyphonic attacks retain linear velocity gain (`velocity/127`); note-on zero releases, FIFO channel/pitch queues handle overlaps, and channel-specific CC64 ≥ 64 sustains released voices until pedal-up. Other controllers/program changes/system events are reported as unrendered. Stop, replacement, completion, scheduling/start failure and disposal release all owned voices and cancel pending callbacks. A provisional maximum of 512 active voices prevents excessive unmatched evidence from allocating unbounded audio resources; exceeding it explicitly fails the run and releases its voices, without truncating stored evidence. Natural sample completion frees capacity through an optional voice `ended` promise. Generation/run closure checks prevent stale callbacks affecting replacements. Phase 5 calls Stop/dispose on navigation/backgrounding; the engine itself changes no existing guard.

`improv-piano-voices.ts` provides `createImprovPianoVoices`, cloning the same twelve local grand-piano samples without modifying legacy piano APIs. Each attack applies application volume × velocity gain and octave playback rate; explicit release pauses/resets its own audio element, including a late browser play resolution. Samples decay naturally, may end before a long held note and have immediate cutoffs on release; HTMLAudio startup/timer timing, pitch shifting, envelope and pedal are approximate, with no half-pedal modeling or sample-accurate scheduling. Browser/user-gesture playback rejection is explicit. Hardware timing, audible fidelity, background behavior and real quota/multi-tab restore still require manual QA. Room audio remains unimplemented.

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

## Practice Sessions 2.0 — weekly definition foundation (historical checkpoint)

The weekly-program owner is independent of the existing daily-preset/curriculum owner. `practice-program-types.ts` defines schema-2 interchange IDs, revision, Sunday/local calendar policy, reusable pool, optional frequency/coverage goals and suggested rotations. Pure `practice-program-validation.ts` reuses the existing reduced-exercise validator and translator for all nine supported concepts; it rejects unknown fields/results atomically and preserves stable pool IDs. The original v1 importer is unchanged except for exporting that reusable exercise validator.

`persistence/practice-program-indexeddb.ts` uses separate `prelude-practice-programs` version-1 `programs`/`revisions` stores. Definition/native-configuration snapshots are immutable, with atomic add/head transactions, identical-content no-ops, same-revision conflicts, explicit newer-revision confirmation and stale-current fencing. Native snapshot validation preserves historical default settings outside the reduced interchange selections. Blocked/quota/corrupt/future data is reported without replacing it. Limits are 100 programs, 100 revisions each, 100 pool exercises, seven rotations, 24 references each and 256 KiB input.

The active builder edit view mounts `PracticeProgramLibrary`; runtime/summary ownership remains unchanged. Its import dialog, preview and revision selector display definitions only. Storage opens on explicit preview/view actions, not panel mount. Owner/generation fences suppress late callbacks; explicit saves already requested may commit after closing. Strict Mode cleanup closes the feature-local handle. No MIDI/audio ownership or grading changes. The v2 Copy-for-AI specification is separate; the original guide defaults to v1.

`practice-program-calendar.ts` uses calendar dates to identify Sunday-start weeks without elapsed-millisecond arithmetic and reserves local-date/UTC/timezone/offset attribution for future attempt starts. No attempts are allocated or persisted. See [WEEKLY_PROGRAM_V2.md](WEEKLY_PROGRAM_V2.md). Daily selection/execution, attempt records, comparisons and Guided Improvisation remain later checkpoints.

## Practice Sessions 2.0 — daily selection and durable attempts (Checkpoint 2)

PracticeProgramPractice owns only ordered queue selections and uses PracticeProgramExecutor to launch one existing single-exercise PracticeSessionRuntime run per attempt. Stable pool IDs, unique queue occurrence IDs and unique actual attempt IDs are separate. Existing scoped run/token/exercise callbacks, all four hosted engines/nine concepts, grading, target completion, Bonus and detailed temporary reports/printing stay native. Runtime adds only an optional allowSkip=false flag for weekly attempts; legacy default behavior is unchanged. Skips occur before Start and persist separate selection records. Repeat is a new occurrence/attempt/key; Bonus retains the attempt and prescribed boundary metrics.

The builder preserves the weekly panel while hidden, protects its queue/pending results from legacy launch, and reports actual weekly input activity separately from queue state. Inactive navigation/background/freeze/pagehide stops the hosted engine; no timers/audio/MIDI resume automatically. Callback scopes reject earlier attempts. Five-second coalesced progress/lease checkpoints, immediate completion/Bonus/terminal transitions and transactional acknowledgements separate current/pending evidence from last durable history. Native active-time helpers use a monotonic injected performance clock; wall-clock/calendar provenance is captured once at Start. Pending write failures freeze execution and retain results/stop time for explicit retry.

Separate prelude-practice-attempts IndexedDB version 1 stores strict bounded attempt/skip records, leaving definition DB version 1 and revisions untouched. Unique occurrence/kind indexing, immutable snapshots, owner IDs and optimistic write versions fence duplicate/stale/concurrent writes. Web Locks protect live attempts across readers/tabs and release on reload; abandoned in-progress rows recover to interrupted with last durable progress. Completed boundary outcomes survive recovery. Without Web Locks, a 30-second lease prevents premature recovery and requires history refresh after expiry. Corrupt/future/blocked/quota data is reported without replacement. No power-loss guarantee exceeds acknowledged native transactions.

History is memoized apart from native callback renders. Weekly counts aggregate durable starts/completions/incomplete outcomes/separate skips across stable IDs; current-pool coverage counts started attempts, not proven note activity or quality. Stored scalar summaries come from native reports, retain observed source provenance and prescribed-boundary metrics, and use null for unavailable measurements. Full musical journals are not persisted. Bounds: 100 selections including repeats, 10,000 history records globally, 64 KiB/record, 50 recent visible records and 100 recovery candidates per refresh; no silent deletion. A 24-hour active-time guard stops runaway attempts without clipping measured duration. Comparison dashboards and Guided Improvisation remain separate.

## Daily Piano Lesson — morning launch, Checkpoint 1A

The current morning entry extends the weekly owner above; it does not add another executor. `PracticeSessionBuilder` supplies its unchanged legacy editor as children of `PracticeProgramLibrary`. The latter renders Today's Piano Lesson above those children and retains the existing definition management below them. Entering weekly practice shows the same `PracticeProgramPractice` owner and hides/inerts the legacy editor without unmounting its temporary drafts. Existing V1 launch/run/report ownership stays in the builder.

`practice-lesson-preferences.ts` owns one versioned local preference containing only the explicitly chosen program ID. Reads never write. `practice-lesson.ts` resolves local weekday advice, rejects unresolved/duplicate/unrunnable selections, and detaches the exact preserved revision/native snapshots. It never invokes translation or introduces imported fields. An existing preferred identity permits read-only current-head lookup on the landing; this extends the earlier explicit-view-only definition-read behavior. No preference or definition rows are written by opening the landing.

Start is synchronously fenced, re-reads the current head, optionally invokes the existing MIDI connection function from the initiating action, and hands an optional initial selection to `PracticeProgramPractice`. That component uses `PracticeProgramExecutor.select/start` once, retaining its original attempt-start acknowledgement, progress, terminal retry, ownership and recovery contracts. No executor or persisted record/schema change is needed. Cancellation/navigation fences late definition/connection callbacks; an already requested MIDI permission flow may settle under its existing provider, but cannot launch a cancelled exercise. Missing advice opens the manual pool without attempts/skips.

The library uses `AppMidiContext` connection controls only, never consumer registration. `PracticeSessionRuntime` passes an optional `hostedStart` flag only for the first acknowledged morning attempt to Melody/Ear Training. Each native owner defers its once-only request past discarded Strict Mode effect setup, then calls its existing start/prompt operation. Existing native cleanup still owns clocks, scheduled sounds, MIDI subscriptions and unmount cancellation. A suspended Melody context can be resumed by an explicit continuation without allocating another context or resetting its attempt. Native failures retain manual continuation; no asynchronous browser user-activation guarantee is assumed. Manual queues, Repeat and standalone entry stay manual.

No ten-minute clock, lesson-level state machine/result store, automatic next exercise, instructional cue engine, notation geometry change, grading change, release metadata change or vendor/lazy/PWA configuration change is included.

### Daily Piano Lesson continuity — Checkpoint 1B

`PracticeProgramPractice` now hands explicitly launched morning queues to `PracticeProgramLesson`; its inactive initial mount retains the pending Start until foreground activation. The lesson component owns presentation, Finish intent, native-availability observation and ephemeral pacing only. `PracticeProgramExecutor.advanceLesson` serializes the convenience Next/Repeat/Skip transition around the existing terminal transaction, `next`, `repeat`, `skip` and acknowledged `start`. A transition lock, attempt identity and foreground generation fence late/double requests. `stop` cancels pending progression and closes performed work without inventing selection skips. Existing optimistic write versions, coalescing, native metrics/target-boundary metrics, interruption, lease/Web Lock, retries and recovery are reused unchanged.

`use-lesson-pacing` reuses `lib/practice/active-time` with the executor's monotonic clock. Its memory-only ten-minute threshold is advisory, separate from persisted attempt durations. Runtime availability gates count-based playable hosts; optional native activity callbacks gate Melody lead-in/performance and Ear Training answering only after prompt completion. No parallel clock drives native music, audio context, MIDI consumer or durable lesson record. Visibility still invokes the existing performed-attempt interruption policy. A reload retains attempt evidence, not the pacing display.

`practice-lesson-cues` is a pure validated native-entry presenter. It never derives settings from labels or generates music. Runtime's optional lesson contract replaces nested single-exercise numbering and the mandatory completion modal with a concise transition. Target completion hides/inerts the same mounted engine, preserving Bonus identity; detailed native reports and printing remain expandable. Lesson-only native-title suppression retains MIDI controls. Standalone/manual consumers receive no lesson contract. Every acknowledged morning Next/Repeat mounts a fresh native host with its own existing once-only hosted start; async browser activation can still require the native continuation control. Notation sizing, Focus Staff, imported contracts, attempt schemas, lazy/vendor/PWA boundaries and release metadata are unchanged.

### Daily Piano Lesson teaching feedback — Checkpoint 3

`practice-lesson-feedback.ts` is a pure presenter over existing `ProgramMetricSummary`, exact native prescriptions and the Checkpoint 1B cues. `summarizeProgramMetrics` continues to call the existing four native report selectors. Flashcards first-try denominators are completed targets, not all prescribed targets or answer submissions. Sequence retries count completed sequences requiring another attempt, separately from total incorrect sequence attempts. Ear Training uses completed identifications and first guesses. Available response/completion means cover completed native targets, including native retry elapsed time. Reading Flow presents original-trial Pitch, Timing and Movement diagnostics as native averages, never binary accuracy, proficiency or a new threshold. Null means are omitted; unknown/empty sources remain explicitly unknown. Titles never determine advice.

`PracticeProgramExecutor` retains a bounded memory-only `acknowledged` collection for the selected queue. Existing successful transaction boundaries upsert the returned record by record ID; terminal acknowledgements also retain their temporary native run for details/printing. Failed or pending writes do not enter this collection. Select/Return reset it; Next preserves it. `PracticeLessonSummary` joins only exact occurrence/exercise identities in the current queue, preserving authored order and distinct Repeat occurrences. It never queries history, so manual attempts and a second same-day lesson cannot enter the summary. No lesson ID, schema, table, migration, stored analytic or recovery change exists.

The lesson-only completion strip uses the current acknowledged attempt and keeps Next Exercise prominent. `practice-lesson-summary.tsx` composes concise exercise feedback, the closing conversation, and expandable existing `ExerciseDiagnostics`/`PracticeSessionPrintControls`. Reports mount only when expanded, without transferring focus from Next or creating another engine. The mounted native exercise remains hidden/inert at the target boundary and resumes as the same Bonus owner. Closed reports remain available for earlier attempts throughout this lesson.

Prescribed feedback uses immutable `targetMetrics` when available; missing boundaries use explicitly labelled overall recorded evidence, never a reconstructed prescribed result. Final native details preserve prescribed/Bonus selectors. Completed, stopped-early, interrupted, deliberately skipped and unperformed selections remain distinct; pending terminal/skip saves remain pending. The existing Finishing lesson, Retry saving and blocked Return rules remain authoritative. Completion of an elapsed target makes no playing-quality claim. One deterministic configuration-grounded suggestion is offered without historical improvement, per-note diagnosis, fingering assessment or mastery claims. Version/What's New, dependencies, native scoring, persisted formats and vendor/lazy/PWA ownership remain unchanged.


### Daily Piano Lesson clarity and build identity — Checkpoint 4

Both V2 entry routes now give the existing native runtime an outer queue presentation. Today's Lesson retains its acknowledged hosted start; manual V2 retains its native Start/Play policy. The manual owner calls the existing serialized advanceLesson transition for direct Next and Repeat, rather than requiring Finish Session, Continue, and Start. No executor, native run, evidence, identity or persistence semantics change. A three-selection outer queue still contains one native exercise per attempt. Expandable native reports explicitly identify this scope; their original Exercise 1 of 1 counts and measurements remain accurate. Legacy V1 reporting is unchanged.

The runtime owns outer position, upcoming title, target transition and the dominant Next/Finish action. Early Finish is separated from continuation. Compact feedback keeps Checkpoint 3's acknowledged evidence and recommendation; additional measurements/source, native reports and extra practice actions are disclosed on demand. PlayingViewDetails keeps native sound/settings children mounted. Hosted Melody keeps Try Another outside collapsed native diagnostics. Reading Flow geometry, following, clocks, MIDI consumer and AudioContext owners are unchanged. Landing setup/management uses native details elements, preserving mounted legacy drafts, onboarding, Edit Lesson and stored programs.

Vite evaluates build/build-revision.ts at compile time. It reads HEAD and cleanliness using read-only Git commands, embeds __PRELUDE_BUILD__, and the version header renders src/lib/build-identity.ts's description. GitHub Actions passes github.sha through PRELUDE_BUILD_REVISION; build preparation rejects a mismatched, unverified or dirty checkout when this explicit revision is supplied. Local dirty builds say local changes; archives without Git display an honest unavailable/development fallback. No browser Git lookup or runtime network request exists. The compiled bundle owns the displayed identity, so an available PWA update does not change it until the new app actually runs. Existing PWA activation, offline and vendor boundaries remain unchanged. Semantic version and What's New remain owner-controlled and unchanged for this review.


### Physical piano QA — Checkpoint 5

Practice Session print controls portal their feature-owned document directly into document.body. Print CSS scoped to that direct child removes sibling app roots with display:none, then flows the report statically at page width. The former visibility:hidden application retained layout space while the absolutely positioned report inherited mounted/fixed containers, producing trailing empty PDF pages. Other feature printing retains its existing CSS.

PracticeLessonSummary passes its existing teaching overview to PracticeLessonPrintControls. The printable queue joins exact occurrence/exercise identities through lessonSummaryRows and uses only acknowledged closed records. It reuses lessonExerciseFeedback and optional individual ExerciseDiagnostics without fabricating a combined native run or querying program/date history. Pending writes/errors/unclosed attempts block printing. Prescribed target metrics remain distinct from overall and Bonus evidence. Native report selection options and filename lifecycle remain native. Full-queue summaries/native journals are memory-only and unavailable after reload; saved individual attempts remain in the existing history. No executor, database, persisted schema or recovery changes are introduced.

MelodySession owns untimed Ready preparation. Acknowledged morning navigation prepares its continuous session but allocates no audio clock/recorder until Ready — Begin Count-in. Try Another generates once and prepares that phrase; New Timed Session, review retries and Bonus continuation also wait for deliberate count-in. MelodyActiveScore keeps authored display measure 1 during native preparatory ticks, suppresses note highlighting, and displays the unchanged two-beat count separately. At performance tick 0 the original cursor starts, following measure 2 at its original position. Score generation/projection, timing/scoring helpers, expected attacks and AudioContext/MIDI ownership are unchanged. Existing generation cancellation fences stale async audio activation, and the retained context closes on unmount.

Ready waits freeze the continuous-session budget, which is rebased only when the existing native transport successfully starts. The native musical clock is never advanced or rewritten to achieve preparation. The run reducer adds a transient practiceActivity gate and scoped ENGINE_ACTIVITY_CHANGED event, accepted only for Melody. Melody records begin with their active-time accumulator paused; the host bridges native activity without masquerading as visibility loss. Ready/result review is excluded from prescribed/Bonus active time. Visibility, terminal saves, retry and interruption remain owned by their existing paths. No activity gate is added to saved ProgramAttempt records.

PracticeSessionRuntime reads provider status without registering a MIDI consumer. Until an explicit choice, connected means keyboard hidden; other statuses mean visible. Explicit Show/Hide wins through status refresh/reconnect/disconnect. PracticeProgramPractice retains that nullable choice across native attempt mounts in either V2 queue; manual Return resets it. V1 retains local host choice across exercises. Focus/Mobile Play share this visibility policy without remounting engines. Standalone feature defaults remain unchanged, and no global preference is stored.
