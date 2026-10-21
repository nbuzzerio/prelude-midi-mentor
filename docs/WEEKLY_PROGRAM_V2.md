# Weekly Programs — schema 2 and local attempt history

## Rolodex retention supplement - Checkpoint D

The schema-2 program definition, fundamental queue, native attempts and coverage are unchanged. Optional repertoire remains OFF by default and freezes at most one unchanged, explicitly Piano-eligible A1 prescription. Selection now considers legitimately due retention first, then unpracticed/oldest local practice-day cohorts, priority within a cohort, exact recency, and creation/identity. This makes manual priority useful without indefinite starvation. Other-piece error counts are not treated as comparable difficulty.

Automatic qualification requires deliberate owner physical acceptance, and applies only to future compatible native performances. Three distinct clean completed runs establish a later-day retention check; confidently failed checks return to practice and inconclusive checks do not punish unavailable evidence. Mastered current targets leave ordinary rotation while their music/history remain available. Empty, disabled or unavailable repertoire still leaves fundamentals unchanged.

The current-lesson report keeps A1 native results separate from Rolodex date/progress acknowledgement. A failed Rolodex update leaves A1 valid and Retry available in final review. Only acknowledged progress is shown as saved; restored history is labeled historical. Screen/print never infer general musical mastery, hand independence or fingering from pitch/onset counts.


## Optional local repertoire supplement - Checkpoint C

Today's Piano Lesson has a secondary Repertoire settings disclosure. Include repertoire defaults OFF; Piano is selected initially, while Violin/Ocarina require explicit preference changes. Enabling other instruments does not authorize acoustic work in this Piano lesson. A candidate must be active, explicitly Piano-eligible, selected for Piano execution, and compatible with the unchanged A1 score/range/policy validator.

At Start, the existing local-day V2 rotation is resolved unchanged. A separate acknowledged Rolodex read selects at most one passage: priority, oldest current-prescription practice date, then stable creation/identity order. Missing or obsolete prescription evidence is not recent practice. A stopped/interrupted performance date never means successful completion. Empty/unavailable repertoire does not prevent fundamentals. The full selected score and settings are frozen for this temporary lesson occurrence; subsequent source/collection changes cannot replace them.

After the last fundamental is durably closed, Next: Repertoire opens native A1 Ready. A connected Piano input is reused without another instrument question. Begin Count-in remains a deliberate audio gesture. Without MIDI, connect/retry or Skip Repertoire remains available. Early Finish leaves repertoire unperformed; Skip is explicit; Stop closes an actual native attempt; Replay has its own A1 identity. Background or app-section departure interrupts the native player and releases input/audio resources.

No supplementary exercise enters the schema-2 definition, V2 queue, revision or coverage. V2 fundamentals, A1 results and Rolodex practice dates retain separate persistence. Pending A1 terminal evidence blocks Finish/Return/printing. A failed date update does not undo an acknowledged A1 result: Retry remains available in final review. The combined printable summary is current-tab-only, with native fundamental evidence and separate A1 pitch/onset counts and outcomes; reloading leaves independent saved attempts, not a reconstructed lesson archive. The ten-minute budget is guidance and never cuts off repertoire music.


Weekly Programs import, preview and explicitly save reusable definitions, launch freely selected native exercises and retain basic local attempts/progress. Comparison dashboards and Guided Improvisation are not implemented. Existing daily presets, their execution and schema-1 Weekly Practice imports remain independent and unchanged. The pending application version remains 2.9.21; release versioning is for the owner to reconcile separately.

Use **Practice Sessions → Import Weekly Program** for schema 2. **Weekly Program AI Guide → Copy for AI** includes the full strict schema, current native allowed values and a validated example. **Import Weekly Plan** and its original AI guide continue accepting schema 1; no automatic conversion occurs.

## Contract

Unknown fields are rejected at every recognized level. Validation is atomic and returns field paths. JSON must be a raw object, not fenced Markdown, at most 256 KiB measured in UTF-8 bytes. Imports contain definitions only: attempts, results, runtime state, provider metadata and unknown exercise types are rejected.

| Field | Contract |
| --- | --- |
| `format`, `schemaVersion` | Required `prelude-weekly-practice`, `2` |
| `programId`, `revision` | Required stable ID and safe positive integer revision (up to 9007199254740991) |
| `title`, `instructions` | Required nonblank title up to 120 Unicode characters; optional nonblank instructions up to 4000 |
| `week` | Required exact `{ "startsOn": "sunday", "datePolicy": "local-at-attempt-start" }` |
| `exercises` | Required reusable pool of 1–100 definitions, each with a unique stable `id` |
| Exercise settings | Existing schema-1 exercise fields and native validation; labels up to 100 characters |
| `weeklyTarget` | Optional exercise-level `{ "completedAttempts": N }`, integer 1–1000; a frequency goal, separate from a native exercise target |
| `weeklyGoal` | Optional `{ "distinctExercisesPracticed": N }`, integer 1 through pool size; a coverage goal, not a grade |
| `suggestedRotation` | Optional array of at most seven unique weekday recommendations, each `{ "day": weekday, "exerciseIds": [...] }`, 1–24 unique resolved pool references |

Stable IDs are case-sensitive: 1–80 ASCII letters, digits, dots, underscores or hyphens, beginning with a letter or digit. Weekdays use lowercase Sunday through Saturday. The same exercise ID may occur in several rotations. Rotation order and selected settings are preserved. Missing days impose no requirement. Frequency goals count completed saved attempts. Coverage counts distinct current-pool exercise IDs with saved started attempts, independently of completion or musical quality.

The nine supported concepts are `note-recognition`, `triads`, `melodic-intervals`, `random-scales`, `scale-repertoire`, `arpeggios`, `chord-progressions`, `ear-intervals` and `reading-flow`. Their required fields, allowed values, count limits and translation to native configurations are reused from schema 1. Scale Repertoire completes its selected list once; Reading Flow retains its native timed-practice target. No new musical grading rules apply. Unsupported double-accidental repertoire scales remain rejected, and chord progression selections must remain all major or all minor.

## Tested example

The following JSON is tested against the actual parser and the example in the Copy-for-AI guide. These scale identifiers are supported.

```json
{
  "format": "prelude-weekly-practice",
  "schemaVersion": 2,
  "programId": "piano-foundations",
  "revision": 1,
  "title": "Flexible foundations",
  "instructions": "Choose from the pool. Repeat exercises when useful; missed days are fine.",
  "week": { "startsOn": "sunday", "datePolicy": "local-at-attempt-start" },
  "exercises": [
    {
      "id": "reading",
      "type": "note-recognition",
      "label": "Treble natural notes",
      "staff": "treble",
      "noteCategories": ["naturals"],
      "showTargetName": false,
      "target": { "correctAnswers": 20 },
      "weeklyTarget": { "completedAttempts": 3 }
    },
    {
      "id": "scale-set",
      "type": "scale-repertoire",
      "label": "C major and A minor",
      "staff": "treble",
      "order": "in-order",
      "scales": ["c-major", "a-natural-minor", "a-harmonic-minor", "a-melodic-minor"],
      "showTargetName": true
    }
  ],
  "weeklyGoal": { "distinctExercisesPracticed": 2 },
  "suggestedRotation": [
    { "day": "monday", "exerciseIds": ["reading", "scale-set"] },
    { "day": "thursday", "exerciseIds": ["scale-set"] }
  ]
}
```

## Saving and revisions

Saved definitions use a separate browser-local IndexedDB database, `prelude-practice-programs`, version 1, with `programs` current heads and immutable compound-keyed `revisions`. The boundary saves both the validated interchange definition and its resolved native exercise configuration snapshots. It never writes the legacy localStorage preset/curriculum library, Improv collections, MIDI/audio evidence or other feature data. There is no cloud or network synchronization.

Preview is not Save. An identical program ID/revision/content is a no-op, including a historical revision that is no longer current. Object-key order does not affect equality; array order and text do. Different content at the same revision is rejected. An unsaved revision below the current revision is rejected. A newer revision needs an explicit checkbox confirmation before Save makes it current; all earlier snapshots remain available in the saved-revision selector. The save transaction rechecks the expected current revision, so a stale tab cannot overwrite another tab's changes. A new identity may begin at any positive revision.

There are at most 100 saved programs and 100 revisions per program. There is no delete, prune or reset feature in this checkpoint. Storage limits, blocked access, quota/transaction failures and corrupt/future rows produce errors and preserve existing data. Failed saves retain the import JSON for fresh validation/retry. Corrupt/future databases are not cleared, migrated or silently replaced. Valid historical native settings not exposed by the interchange remain preserved, rather than regenerated from newer defaults.

An explicitly requested save already in flight may finish after the dialog closes or navigation unmounts it. Closing is not an undo of Save. Async owner/generation fences prevent stale review, upload, list or save callbacks from updating a newer UI; Strict Mode creates a fresh store lifetime. Definition reads open for import/view actions and the configured morning card. Reading definitions requests no microphone/MIDI permissions; the deliberate morning Start can invoke the existing MIDI connection controls.

“Import as separate program” is deferred. To author a genuinely separate program, generate a new program ID deliberately; do not change an existing ID merely to bypass a revision conflict. Later owner-approved work can add safe explicit duplication and deletion/export management.

## Calendar and later execution

Pure calendar helpers identify a local `YYYY-MM-DD`, weekday and preceding Sunday using calendar-date arithmetic, never a fixed elapsed-millisecond subtraction. The reserved attempt-start attribution value includes local date, Sunday week identity, UTC start instant, IANA timezone (or null if unavailable) and offset minutes east of UTC. Callers must capture these together at the future attempt start; travel, DST or later settings must not reattribute saved attempts. Execution captures this attribution once at Start, before the durable checkpoint; later midnight/travel/timezone changes do not move it.

Flexible selection/repetition and durable attempts tied to exact revisions/native snapshots are now implemented. Historical comparisons remain deferred to a future owner-approved checkpoint. Daily Piano Lesson Checkpoint 3 supplies current-lesson teaching feedback only. Guided Improvisation is a separate later activity and is not required for ordinary weekly practice. Physical musical measurements remain owned by their existing engines.

## Daily execution and saved attempts

Open a saved definition and choose **Practice current revision**. Select any subset; selection order follows your choices and can be moved before preparation. **Use today's suggested rotation** is optional; no rotation means no automatic choices. **Edit selection** returns prepared work for editing without persisting anything. Start only the selected occurrence; do not enter unselected exercises or label them skipped. **Skip this selection** saves separate skip evidence and mounts no native engine. During a performed attempt, **End Session** stops early or finalizes an achieved target. After a saved result, **Repeat exercise (new attempt)** creates a fresh keyed engine, occurrence and attempt. **Keep Playing** remains native Bonus within the same attempt. Continue advances to the next selection; Return to pool discards only unperformed queue selections.

The existing four hosted native engines cover all nine imported concepts. Their evaluation, MIDI owner, target completion, Bonus and temporary detailed reports/print content remain intact. The weekly owner does not grade notes itself. The selected program definition and revision never change when practicing. Stable program/revision and pool IDs are distinct from occurrence IDs and actual attempt IDs. Every actual attempt stores immutable exercise/configuration/goal snapshots, owner and policy/metric versions, UTC/local start, Sunday week identity and timezone/offset provenance.

A separate **prelude-practice-attempts**, IndexedDB version 1, records attempts/skips; the definition database remains version 1 with no migration. Start must commit before a native engine mounts. Coalesced progress/lease writes occur at most every five seconds in normal play; completion, Bonus start and terminal transitions request immediate writes. Only acknowledged records appear as saved history. Failed writes stop the engine and retain pending results (including the actual stop instant) in the mounted builder for explicit retry. Navigation hides this persistent owner and interrupts its engine; it does not erase pending work. Closing/unmount attempts a terminal write, but acknowledged Start/progress remain the reliable reload fallback. Native transactions, not UI promises, determine save acknowledgement. No power-loss durability claim is made.

Web Locks prevent recovery from closing another tab's live attempt; the browser releases the lock on reload/crash. Unfinished unlocked starts recover to **interrupted**, retaining the last durable duration/metrics without adding imagined elapsed time. An achieved completion checkpoint remains **completed**, even when abandoned before leaving the native completion/Bonus UI. No native engine, MIDI/audio or timer resumes on reload. Where Web Locks are unavailable, a **30-second lease** is the conservative fallback; refresh history after expiry to recover abandoned rows. Large interrupted backlogs recover at most 100 rows per refresh.

Observed active duration uses the existing foreground hosted-practice timer (including setup/instructions while foreground), with prescribed/Bonus time and units separate. It is not proof of note activity or acoustic performance duration. Bounded native scalar summaries retain completed units, incorrect responses, first-try counts and response/completion averages where reported, repertoire coverage, and genuine Reading Flow pitch/timing/movement averages. Unavailable values are null, never invented grades. MIDI/virtual/simulation source provenance is retained where native reports supply it; other provenance stays unknown. Prescribed target-boundary summaries stay immutable when Bonus changes the final observed summary. Full musical journals and detailed reports are temporary rather than saved in this MVP.

**Saved weekly progress** counts durable starts, completed and closed-incomplete attempts, and separate skips by stable pool ID. Frequency goals count completed attempts; coverage counts current-pool IDs with started attempts, not accuracy. Unselected work remains Not yet practiced; missing days impose no failure. A date picker can review a previous Sunday-start week; recent records show exact revision, dates/outcomes/time/units and available native summaries. Results across different settings may contribute to coverage but are not asserted comparable in quality.

Bounds: 100 queue selections including repeats; 10,000 history records globally; 64 KiB per record; 50 recent visible records; no silent deletion/pruning. A 24-hour active-time guard stops runaway sessions, retaining observed time even if a delayed browser tick exceeds the threshold. Quota/blocked/corrupt/future records are reported and never cleared or overwritten; optimistic versions and unique occurrence/kind keys reject stale/duplicate writes. Storage capacity failures retain pending work for retry. Deletion/pruning/history export/backup, comparisons and Guided Improvisation require later owner approval.

## Morning launch — Checkpoint 1A

**Today's Piano Lesson** appears above the legacy preset builder. Choose Weekly Program loads the saved current heads; only clicking **Use [program] for today's lesson** designates a preferred program. Change Weekly Program makes another explicit choice. Importing, viewing and practicing never designate a preference.

The independent localStorage record `prelude-practice-lesson-preference-v1` contains only `{ "version": 1, "programId": "..." }`. Loading does not write, repair or clear preference bytes. Invalid/future/corrupt/unavailable preferences show a notice and offer explicit selection. A failed preference save retains the chosen identity for this tab with an accurate warning. A missing saved program leaves its preference untouched and offers another choice. Program definitions and revisions are unchanged.

For a preferred program, the card reads the current saved revision and resolves the local weekday with the existing calendar policy. Returning to the card, foreground/focus refresh, and an explicit definition save refresh the display. Start Today's Lesson reads the current head again, validates every selected reference, detaches that exact revision/native snapshot, and passes the authored rotation to the existing V2 practice owner. Its existing executor prepares occurrence IDs and starts only the first attempt. The native engine still mounts only after the initial transaction is acknowledged. Preparing your exercise, duplicate-action guards, start-save errors and the existing Retry saving path preserve that ordering. A later saved revision cannot change the running queue.

No rotation produces **No suggested lesson for today. Choose exercises.** Choose exercises opens the existing manual pool without creating an attempt. Edit Lesson also opens that manual interface without preparing or starting work. Invalid references/settings fail visibly rather than being filtered. Strict schema-2 imports still reject empty rotation reference arrays; the resolver also defensively treats empty advice as no assignment.

The deliberate Start action invokes the existing MIDI connection flow when disconnected. Connection denial/unavailable hardware leaves the chosen queue intact and shows connection guidance; use native Connect MIDI to retry or the existing on-screen input. No permission request occurs from loading the card. The library reads connection controls without registering a MIDI consumer.

Only the first morning attempt receives an optional hosted-start request. Reading Flow invokes its existing timed Start after acknowledgement; Ear Training invokes its existing first prompt player. Strict Mode setup replay and cancellation cannot deliver this request twice. Standalone modes, manual V2 starts, subsequent selections and Repeat retain their prior native Start/Play controls. If audio activation is blocked, Reading Flow offers **Enable audio and continue** against its same pending native context; Ear Training explains using Replay Prompt. No new audio owner or pre-acknowledgement engine is introduced.

Checkpoint 1A does not add a lesson timer, instructional cues, automatic queue continuation, lesson-level results, notation changes or comparisons. Existing Next/Repeat/Skip/End/Bonus/report/history semantics remain. Package version and release metadata remain unchanged at the owner's explicit request.

## Coherent morning lesson — Checkpoint 1B

Only Start Today's Lesson enables the lesson presentation. The existing executor remains the sole queue/attempt owner. A durable target-boundary checkpoint enables a brief transition with Next Exercise, Repeat Exercise and Keep Playing. Next closes the performed attempt, awaits its terminal transaction, then prepares/acknowledges the next attempt before mounting its native engine. Nothing advances automatically on completion. A failed save keeps the result in this tab; Retry saves the same evidence and does not automatically advance. Rapid Next/Repeat requests are fenced. Background/navigation or Finish cancels a pending transition.

Repeat inserts a fresh occurrence/attempt, subject to the existing 100-selection limit. Keep Playing remains Bonus in the same mounted attempt. Skip Exercise explicitly names the unstarted upcoming selection and writes the existing skip evidence; it does not start the following selection. Next Exercise then starts that selected exercise. Stop Exercise closes performed work truthfully. Finish Lesson gracefully closes any current attempt and leaves all remaining selections unperformed. Return is disabled while evidence is pending and returns to the morning entry after acknowledgement. No lesson rows, identities, import fields or new scoring rules are added.

The memory-only pacing display aims for about ten minutes. It uses the existing monotonic active-time accumulator, counting foreground time when Flashcards/Sequences are playable, Ear Training is answering after a completed prompt, or Reading Flow is in native lead-in/performance. It conservatively excludes Ear Training's short playback/preparation, blocked audio, start acknowledgement, terminal waits, result review and background time. Ordinary nonblocking progress writes do not pause playable practice. Existing background interruption/recovery behavior remains; the lesson does not silently resume an interrupted attempt. The budget never stops an engine or marks unfinished work failed. Local midnight and daylight-saving changes do not reset a launched rotation or alter this monotonic clock. Reload loses pacing only; acknowledged attempt evidence and interruption recovery remain durable.

One short cue is derived from the frozen native entry using native config/target validation, independently of its title. Bass/mixed clefs, exclusively minor arpeggios, single D harmonic-minor repertoire, native minor forms/directions, ear intervals and Reading Flow receive supported advice. Mixed/random selections use general language. Classical melodic minor retains raised sixth/seventh ascending and natural minor descending. No generated note, fingering, two-hand independence or player weakness is inferred.

The lesson runtime uses the authored selection position, keeps the native engine mounted at target completion for Bonus, and hides its inactive stage behind optional native details. Closed attempts retain the existing full report and printing in an expandable section. Repeated native feature titles are hidden only inside the lesson host; MIDI controls remain. Normal lesson controls can reflow without the old bounded session-strip scroll region. Manual V2, V1, standalone presentation, native reports, exact revision snapshots and historical record formats remain unchanged. Each subsequent lesson attempt and Repeat gets its own once-only hosted-start request; audio/MIDI ownership and continuation controls remain native. Reading Flow's per-phrase Try Another action and notation readability remain native behavior; neither is redesigned here.

## Comfortable Reading Flow — Checkpoint 2

Reading Flow now shows one large active measure, using the native generated score and playback position. Its preparatory rests occupy that same viewport during count-in, followed by authored measure 1 and, when present, measure 2. The existing count guide and current-note highlight follow their original ticks. The phrase, timing, native results and explicit Try Another action are unchanged; resizing and Focus do not regenerate music or restart an attempt.

Staff lines are 18px apart normally and 22px when the virtual keyboard is hidden. Desktop uses the available width rather than splitting it among lead-in and exercise measures. Narrow screens retain legible notation in one horizontal canvas that follows playback; vertical scrolling can still be necessary for music and controls. Hosted Focus provides a sticky control strip including Stop Exercise, Finish Lesson and Exit Focus, with native MIDI/audio continuation controls still reachable. The host owns focus; the redundant hosted Flashcards Focus Staff action is omitted while standalone behavior remains intact.

This is presentation only: program definitions/revisions, exact native snapshots, attempt and occurrence identity, persistence, interruption/recovery, lesson pacing, Next/Repeat/Bonus/Skip/Stop/Finish semantics and source provenance are unchanged. Manual V2, V1/schema-1 and standalone Melody reuse the same improved score window. Physical comfort at the piano remains an owner acceptance check; no new proficiency or historical comparison is inferred.

## Teaching-oriented feedback — Daily Piano Lesson Checkpoint 3

After reaching an exercise target, the lesson shows concise native measurements and a configuration-grounded teaching observation, with Next Exercise (or final Finish Lesson) as the primary action. Stop Exercise retains the truthful terminal outcome. Native detailed diagnostics and Generate Report printing are expandable at target completion and after closure. Keep Playing retains the same attempt and Bonus boundary; Repeat creates a distinct occurrence and attempt.

| Engine | Concise measurements | Available live but omitted from saved scalar evidence |
| --- | --- | --- |
| Flashcards | First-try/completed targets, separate incorrect attempts, mean completed-target response, known answer sources | Individual targets, submitted pitches, target-specific response times and unresolved attempts |
| Sequences | Completed sequences, completed sequences requiring retry, separate incorrect sequence attempts, mean completion, known answer sources | Failed steps, target snapshots, unresolved attempts, individual durations/repertoire identities |
| Ear Training | First-guess/completed identifications, separate incorrect guesses, mean completed-identification response | Particular intervals/directions, wrong guesses per target and unresolved guesses; input provenance is unknown |
| Reading Flow | Original diagnostic trial count, available native original Pitch/Timing/Movement averages | Attack/timing/movement detail, Repair retries and interval diagnostics; first-try correctness, response time and input provenance are unavailable |

These are existing native measures. Reading Flow percentages use native partial-credit diagnostics rather than binary note accuracy. Missing measurements are omitted or described as unavailable; no zero is invented. Flashcards/Sequences sources distinguish MIDI, on-screen input and simulation where actually recorded. A connected MIDI device never establishes a particular result's source, and no source label certifies physical piano proficiency.

Feedback uses the acknowledged prescribed `targetMetrics` where available, separately from final `metrics` that can include Bonus. Without a boundary, the aggregate is labelled all recorded work. Native details keep their existing phase interpretation. Count targets show unfinished prescribed units separately from completed-target first-try denominators. Timed completion is not proof of correct playing.

Finish Lesson closes with actual selections in their performed/authored order; it distinguishes completed, stopped early, interrupted, deliberate skips and unperformed work. One supported observation and one short next-time suggestion reuse the frozen configuration cues. The executor retains acknowledged records and temporary native reports in memory for these exact occurrence identities only. Previous manual attempts and another lesson on the same date are excluded without querying history. Reload loses this closing conversation; existing acknowledged attempt history/recovery remains unchanged. There is no persistent lesson archive or lesson ID.

Pending or failed terminal writes still display Finishing lesson, preserve Retry saving, and block Return. Pending explicit skips are not counted as acknowledged skips. Only acknowledged evidence may be described as saved. No historical improvement, specific difficult note/interval, fingering quality, mastery or universal proficiency score is inferred. Historical comparisons and richer diagnostic retention require a future checkpoint. No version/What's New or durable format changes are included.


## Lesson progression and Playing View — Checkpoint 4

Today's Piano Lesson and Manual V2 practice identify their workflow and show the outer Exercise N of total count plus the authored exercise name. While playing, Up next names the following selection. At a reached target, Next Exercise names its destination and uses one deliberate action to save/advance/start through the existing executor. The final selection offers Finish Lesson (or Finish practice for manual V2). There is no automatic progression. Repeated clicks and pending/failed terminal evidence retain the existing acknowledgement guards, retry and Return restrictions.

Repeat Exercise and Keep Playing are under More practice options. Explicit Skip names an unstarted selection in its own disclosure; Stop Exercise closes performed work. Finish Lesson early is separate from continuation and leaves remaining selections unperformed. Reading trial continuation remains available without expanding diagnostics. Sound and practice details, additional measurements/input provenance and detailed native reports remain accessible. Keyboard, Focus, virtual input and MIDI/audio continuation controls retain their owners.

An individual printable native report represents one attempt, not all outer selections. Its scope note identifies the outer position and explains that other queue selections are excluded; native Exercise 1 of 1 is preserved. V1 can legitimately produce a one-exercise report as well. Do not combine independent native attempts into a fictitious aggregate report.

The landing page prioritizes Today's Piano Lesson. Legacy Practice Sessions (V1) and weekly program management remain in expandable sections with mounted draft state. First-time management starts expanded; Edit Lesson remains beside the preferred lesson. Nothing is migrated or deleted.

The header retains the package version and adds the revision embedded in the running compiled bundle: v2.9.21 · build <short SHA>. An uncommitted local build additionally says local changes. For future deployment acceptance, compare the displayed SHA after reload with the successful deployment workflow's checked-out revision; hover over the identity for its full revision title. A reload/update prompt alone does not establish that the new bundle is active. Local builds without verified Git metadata explicitly report that limitation.


## Physical piano QA — Checkpoint 5

Completed Today's Piano Lesson offers **Print Lesson Summary**; completed manual V2 offers **Print Practice Summary**. These print the current queue's exact ordered occurrences, acknowledged outcomes, native scalar measurements, teaching observation and next-time advice. Completed, stopped early, interrupted, deliberately skipped and unperformed work stay distinct. Pending/failed saves block full-summary printing until Retry saving succeeds. **Include native exercise diagnostics** is optional and off by default. Individual **Print Exercise Details** retains the existing report choices and native evidence. The complete summary exists only in this tab; after reload use individual saved history, since no lesson archive is created. Browser print settings still own headers/footers.

Reading Flow now waits at **Ready — Begin Count-in** after the lesson automatically navigates to and durably prepares its attempt. Study the actual opening measure for as long as necessary. The original two-beat count-in appears separately while that same measure remains visible; no authored note is highlighted before performance. Try Another gives a newly generated phrase in Ready, retaining the native session/context. Preparation contributes neither musical grading nor timed practice. Large 18px/22px staff spacing, one narrow-screen notation scroller, and native scoring/measure following remain unchanged. Other engines retain automatic start. This preparation intentionally supersedes Checkpoints 1A/1B/2's immediate Reading Flow start and preparatory-rest display.

Hosted practice hides the virtual keyboard by default when MIDI is connected and shows it otherwise. Show Keyboard remains available. A deliberate Show/Hide choice lasts through the current queue and overrides connection refreshes/disconnects; without a choice, disconnect reveals fallback input. Focus and Mobile Play retain the same owner and choice. Standalone modes keep their existing defaults. No global preference, scoring, event routing, persistence or release metadata changes are included.
