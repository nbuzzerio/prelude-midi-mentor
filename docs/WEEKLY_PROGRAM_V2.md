# Weekly Programs — schema 2 and local attempt history

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

Flexible selection/repetition and durable attempts tied to exact revisions/native snapshots are now implemented. Defensible comparisons remain Checkpoint 3. Guided Improvisation is a separate later activity and is not required for ordinary weekly practice. Physical musical measurements remain owned by their existing engines.

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
