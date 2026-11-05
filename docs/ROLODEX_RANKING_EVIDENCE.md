# Rolodex ranking review evidence

This follow-up addresses the missing-evidence review of candidate
`7d8b3b118944f92670b025cc034e6302aa9aa7ac`, not PR-RC-02. No concrete code
defect was recorded. Existing implementation and assertions are preserved.

## Binding and limits

Studio's admission evidence binds this turn to
`C:\Users\nickb\Code\StudioWorktrees\pr_006`, branch `studio/pr_006`, integration
branch `master`, baseline `aa34323d7ed2c4c710b6a5504cba270b7961c885`, and the
candidate above. Admission reports a clean snapshot. This identifies the
currently authorized instance; it does not identify the discarded instance
also called pr_006 or prove prior inspection/operation history. This follow-up
does not inspect excluded worktrees or perform Git mutations. Prior absence
of prohibited operations cannot be certified from current source.

## Scoped source context for the host review packet

All paths below are relative to the assigned worktree. Supply the complete
candidate source through Studio's authorized packet process, rather than
unrelated dependency tests. These files were inspected during this follow-up;
that is not a claim that they were inspected before the original implementation.

| Source | Relevant contract/helper |
| --- | --- |
| `src/features/piece-practice/rolodex/rolodex-suggestions.ts` | `rolodexSuggestions`: parse completed records, hydrate, select native candidates, globally rank before the cap, deduplicate by frozen score plus source measure, retain selected run attribution. |
| `src/features/piece-practice/piece-practice-targeted-practice.ts` | `PIECE_PRACTICE_TARGETED_PRACTICE_PRIORITY`, `completedMeasures`, `selectPiecePracticeTargetedPractice`: provisional lexicographic policy, mistakes then skips then restarts then hesitation; completed in-range problem measures only. |
| `src/features/piece-practice/piece-practice-session.ts` | `getPiecePracticeMeasureResults` delegates to diagnostics; session creation, attempts, skips and restarts produce the test evidence. |
| `src/features/piece-practice/piece-practice-evidence.ts` | `derivePiecePracticeMeasureDiagnostics` counts recorded events by measure; `isProblem` requires a nonzero signal; hesitation thresholds use native timing policy. |
| `src/features/piece-practice/persistence/piece-practice-runs.ts` | `parsePiecePracticeRun`, `validCheckpoint`, evidence validators: source identity/timestamp and projected measure identity checks; `hydratePiecePracticeRun`: restores checkpoint with paused clock; `createPiecePracticeRun`: clones source; `PiecePracticeRunWriteCoordinator`: serialized backend operations. |
| `src/features/piece-practice/continuous/continuous-test-fixtures.ts` | `testScore`, `measure`, `note`: authored synthetic score with filled rests; successive targets are MIDI 60, 62, etc. These are test fixtures, not fabricated production evidence. |
| `src/features/piece-practice/rolodex/rolodex-model.ts` | `stable`, `createEntry`, `parseEntry`: frozen score/range identity, provenance and size validation; generated entry IDs/dates are not deterministic ranking outputs. |
| `src/features/piece-practice/rolodex/rolodex-types.ts` | `RolodexEntry`: score snapshot, measure IDs, source metadata and run/measure/reasons provenance. |
| `src/features/piece-practice/rolodex/rolodex-suggestions.test.ts` | Complete `observed` and `retained` helper definitions and all assertions below. |

## Assertion mapping for criterion-f16a260b3ebea495f1f64cb5

The existing file contains 12 cases (the first row expands to three).

| Test name | Assertions |
| --- | --- |
| ranks durable %s evidence ahead of %s evidence in either input order | mistake/skip, skip/restart, restart/slow priority pairs; reversed serialized inputs; exact selected reasons, score and measure IDs. |
| rejects stale source identities and evidence referring to a different source measure | Parser rejects timestamp mismatch and removed source measure; invalid records cannot generate suggestions or displace valid evidence. |
| ranks all durable candidates before capping, independently of input order | Strong later measures survive the cap; reverse input gives indexes 3, 2, 0; exact counts, source score and measure IDs. |
| deduplicates source measures without adding counts and breaks run ties stably | Repeated runs/measures produce two entries, stable run a attribution, restart count remains one. |
| keeps distinct frozen source snapshots and their measure references | Revised frozen score remains distinct; exact score, source timestamp and measure IDs. |
| preserves ranked provenance after recreating the run coordinator and serializing the entry | A new coordinator reads two serialized records from a shared Map backend; two deduplicated suggestions survive, with the strongest first. Entry round trip retains selected run, exact counts, score and measure ID. Not IndexedDB/browser reload coverage. |
| caps suggestions at three and retains the exact completed run score and factual skips | Three entries, stable measure ordering, exact frozen score and factual skip attribution. |
| ignores unavailable, corrupt and unsupported evidence | Null, malformed and future-version records yield no entries. |
| does not fabricate difficulty for a completed clean performance | Real completed clean session yields no suggestion. |
| does not suggest difficulty from an unfinished run or from silence without evidence | Active session yields no suggestion. |

## Executed evidence and missing host capabilities

Studio targeted verification `55f0d36a3efe4e01be427534078f0b7e` passed:
`pnpm exec vitest run src/features/piece-practice/rolodex/rolodex-suggestions.test.ts`.
It reports one file and 12 tests passed, exit 0, tied to the candidate checkpoint
as working-tree verification, not clean-commit acceptance. Output names the
file but not individual cases. The request adding `--reporter=verbose` was
rejected with `Test path is outside the authorized scope.` No alternate
execution route was used. Studio must enroll named output for this exact test
file, then execute and attach it to the checkpoint review to resolve that gap.

Full `pnpm run verify` also passed through Studio, exit 0, verification
`8432b816ca6c4a4fb3240c5d6243edf6`. The returned output is truncated; this
document does not infer fresh full-suite counts or individual test results
from the earlier recorded 4,693-test validation. The targeted count above is
directly visible. The full run reports jsdom canvas/text-metrics limitations;
its success is not evidence of real-browser rendering.

`studio_verify ["browser-contract"]` returned no suites, editable paths `src`,
and enrolled install/verify commands. Browser persistence reload, keyboard,
screen-reader and responsive behavior remain unrun. A separate scoped Studio
decision must enroll a browser acceptance suite/runtime before those checks
can be implemented and executed reliably; no missing automated check is
delegated to Human QA.

## Decisions and evidence still required

1. Owner/Studio must explicitly distinguish the discarded pr_006 instance from
   the authorized instance using instance identifiers and lifecycle records,
   and provide retained inspection and agent-operation audit records. Current
   identity and a clean diff cannot reconstruct that history.
2. Owner must settle the six pinned interpretations: current committed source
   is the implementation basis; inspection-before-implementation is historical
   and needs historical evidence; only missing ranking/deduplication behavior
   changes; scoring/MIDI/worker/schema/unrelated contracts stay unchanged;
   excluded workspace instances are identified explicitly; Studio alone owns
   Git mutations while authorized read-only inspection is permitted. These
   are proposed interpretations, not newly certified historical facts.
3. Studio must include the exact candidate contracts above and named passing
   targeted results in the review packet. This document is an index, not a
   substitute for complete pinned source or independent review.
4. Studio must supply authorized scoped evidence for protected
   `build/build-revision.test.ts` and bounded validation logs. This follow-up
   does not read protected source or external host logs, change evidence
   limits, or modify host tooling. No project-source edit can settle this.

## Second follow-up diagnosis

The recorded failure is missing review evidence, not a failing build or an
identified ranking defect. This follow-up strengthens the existing persistence
test by recreating the coordinator and decoding stored JSON on every read.
This closes the specific same-coordinator limitation of that test without
claiming browser persistence. Existing assertions are retained, with explicit
record and suggestion counts added. No production behavior changes.

The browser contract was queried again and still contains no suites. Only
`run verify` is enrolled for verification; no verbose-reporter permission is
inferred and the previously rejected command is not retried. Named execution
proof still requires Studio to enroll a focused verbose invocation for
`src/features/piece-practice/rolodex/rolodex-suggestions.test.ts` and attach its
output to the checkpoint. Source-packet limits and historical records cannot
be repaired by changing project tests or copying protected evidence.

Current working-tree `pnpm run verify` passed through Studio, exit 0,
verification `5b1b5dfd5a4e4674ad095727f097c3eb`. Returned output was truncated;
fresh exact suite counts and named suggestion PASS lines are not reported
here. The earlier counts are not substituted for current execution evidence.
The CxR exporter exited 1 without output; no artifact was confirmed.

No product files, shared types, UI or music policy change is proposed.
There is no product-code version bump in this evidence-only follow-up; package
and lockfile edits remain prohibited by the ticket. Acceptance and progression
remain subject to the unresolved host/provenance decisions above.

## PR-RC-02 current-source checkpoint

The owner explicitly authorized bounded implementation and documented-risk
progression at checkpoint `6b69b4814210f95064e46da3c65d28fad16cce90`.
This turn inspected the actual selector, parser/checkpoint validation, hydration,
session diagnostic delegation, evidence derivation, projection, synthetic
fixtures, Rolodex types/model, editor, library and transaction planner before
implementation. These usable source contracts permit this ticket's work;
they do not reconstruct historical inspection or excluded-instance records.

Missing behavior implemented:

- Suppress saved prescriptions (including archived entries) using the existing
  storage `prescriptionKey`, and visit-local dismissed prescriptions, before
  the three-suggestion cap. Dismissal writes no data and resets on leaving the
  library. Native ranking and frozen-score/source-measure deduplication remain.
- Load suggestions only after reading both evidence and saved entries; discard
  old offers during reload or on failure. Unreadable saved records prevent offers.
- Before every new suggested save/retry, re-read durable runs and rederive the
  exact selected run/measure/reasons against its frozen score. Missing, invalid
  or changed attribution blocks the write. Range edits must retain the evidence
  measure. Mutable library-source edits/deletions do not invalidate frozen music.
- Retain manual confirmation and pending-payload retry identity, fence successful
  repeat confirmation, focus the editor heading, and restore focus to the visible
  suggestion loader after review/cancel/save or dismissal.

Objective assertion locations:

| File | Assertions |
| --- | --- |
| `rolodex-suggestions.test.ts` | Existing ranking, ties, stale identity, corrupt/unfinished/clean evidence and coordinator reconstruction; new saved/dismissed suppression before cap; exact attribution recheck and out-of-range rejection; IndexedDB-fake quota failure, commit acknowledgement, reload provenance and duplicate save with unchanged original run. |
| `rolodex-editor.test.tsx` | Explicit instrument confirmation; failed-write retry retains exact payload; concurrent and acknowledged repeat clicks write once; accessible heading focus; failed evidence reads and missing evidence never call save. |
| `rolodex-library.test.tsx` | Review/cancel never writes; heading and return focus; dismissal survives suggestion reload; confirmed save retains serialized score/measure/evidence and disappears from offers; failed evidence reload clears old offers. |

No storage schema, public model, durable completion, scoring, MIDI, worker or
music-theory contract changes. Product version remains `2.9.24`: repository
guidance proposes patch `2.9.25`, but this ticket prohibits direct manifest and
lockfile edits. Studio must reconcile the version requirement before committing.

Browser contract discovery returned no suites and only the existing verify
command. Real-browser reload, keyboard traversal, screen-reader announcements
and responsive rendering remain NOT_RUN. DOM focus and accessible names are
automated assertions, not real-browser accessibility certification. Studio must
separately enroll a bounded browser suite/runtime to produce that evidence;
subjective Human QA does not replace it. Historical packet/protected-source and
named-output gaps above remain host review concerns, not facts inferred from
the present implementation.

Executed current-ticket verification:

- Focused Studio run `c92a595f723f4923a28ba6b369e3a45d` passed all three
  assertion files above: suggestions 15, editor 5, library 9 (29 total).
- Final `pnpm run verify`, Studio run `2c2d1baa143f44788f94ff779ad9700a`,
  passed lint, type checking, 324 test files / 4,701 tests and production build.
  This is working-tree evidence at the admitted checkpoint, not clean-commit
  acceptance. The host output reports file-level rather than individual-case
  results; named-case execution output remains unavailable.
- Retained intermediate result `7436ce1237e44fa7814f605df5f1128d` FAILED:
  1 test failed, 4,699 passed in 324 files. Its bounded returned output omitted
  the failing case/diagnostics. No cause is invented. The final focused and full
  runs pass; the intermediate failure remains part of the evidence history.
- Browser suite execution remains NOT_RUN. No dependencies were changed.

## PR-RC-03 contextual completed-session recommendations

`PiecePracticeSession` mounts `PostPracticeRecommendations` only for a completed
run whose revision has a storage acknowledgement. The panel reads that exact
validated revision back from the run store and reads Rolodex before deriving
offers. It uses the existing native ranking and attribution without changing
scoring, source snapshots, schemas or music behavior. Read failures and missing
or changed results produce an unavailable state, never fallback offers.

Each measure displays its recorded signal counts and source run. Inspection
reuses `RolodexEditor`, including its instrument confirmation, frozen score
preview, evidence revalidation, retry identity and repeated-write fence. The
editor now accepts the session's existing run store; its default is unchanged.
Cancel, decline and return leave results mounted. Declines last for this results
visit. Saved prescriptions are suppressed on reload. Layout uses existing
wrapping controls and responsive editor styles; focus returns to the panel
heading after inspection or decline.

Automated assertion map:

- `components/piece-practice-session.test.tsx`: actual session completion by
  native skip actions exposes no panel before the completion write resolves;
  acknowledgement enables contextual offers, return retains results, no
  Rolodex save occurs automatically.
- `rolodex/post-practice-recommendations.test.tsx`: native note attempts create
  a completed mistake fixture, saved/reloaded through the production run store
  with fake IndexedDB. Inspection cannot save before confirmation; confirmed
  save/reload retains the exact sourceScore, evidence run/measure/reasons and
  source measure IDs. Reloaded original durable result remains deeply equal.
  Separate cases cover clean completion, missing/unfinished/cancelled/fabricated
  evidence, read failure, removed evidence at confirmation, write failure/retry,
  saved suppression, cancellation/decline, and DOM focus restoration.
- Existing editor, library, ranking and persistence regressions remain in the
  full verify suite, including the repeated-confirmation fence.

Browser-contract discovery again returned no enrolled suites. Actual browser
Tab/Shift-Tab traversal, Enter/Space activation, focus restoration, accessible
name/announcement inspection, narrow viewport overflow and browser reload
remain NOT_RUN. DOM checks and fake IndexedDB do not establish those browser
properties. Separate owner decision: enroll a bounded browser acceptance suite
and runtime through Studio; no dependency or runtime permission is inferred.
Historical provenance, protected-source and named-case reporting gaps remain
unresolved independently. Version proposal remains 2.9.25 for Studio to handle;
direct package edits remain prohibited.

Current-ticket executed evidence (working tree at admitted checkpoint):

- Focused Studio run `9fce267b172b41b188e2dd125f7deb8f` PASSED: five files,
  132 tests (recommendations 11, session 92, ranking 15, editor 5, library 9).
  This includes the assertion map above. Host success output is file-level;
  individual named passing-case output remains unavailable.
- Intermediate full run `a941ededbd5040a1b36aa38cdd4caf7e` FAILED on the new
  render-time ref read. Replaced that read with a save-progress state snapshot.
- Intermediate full run `1c30256b93fc4f4bb2fe2d57e9dc2e6f` FAILED: 2 files
  failed / 323 passed; 4 tests failed / 4,707 passed. Focused run
  `b109d6b556a24b978dae0b28e081fb9f` reproduced those four failures. New test
  setup reused a cached run-store connection across IndexedDB fixtures, and
  the session test used a manually assembled piece rejected by native parsing.
  Isolated production store instances and a validated score projection fixed
  the fixtures without weakening assertions or changing native contracts.
- Two subsequent session-only diagnostic executions also retained the one
  fixture failure before that fixture correction. The focused run above passes
  all 132 tests after correction; historical failures remain FAILED.
- Final Studio run `fdfd6b801e0d455d95d1f651e040b97d` PASSED `pnpm run verify`:
  lint, type checking, 325 test files / 4,713 tests, and production build.
  Existing acoustic-hook lint and jsdom canvas warnings remain; no packages
  were changed. Browser acceptance remains NOT_RUN, independent of this pass.
