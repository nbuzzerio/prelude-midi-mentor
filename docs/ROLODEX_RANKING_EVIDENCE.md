# Rolodex ranking review evidence

This follow-up addresses the missing-evidence review of candidate
`7af21bbbca0f0b0b1376d9432397aef8e4bc3306`, not PR-RC-02. No concrete code
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
| preserves ranked provenance through durable run storage and entry serialization | Coordinator with Map backend and JSON round trips retains selected run, counts, score and measure ID. Not IndexedDB/browser reload coverage. |
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

No product files, tests, shared types, UI or music policy change is proposed.
There is no product-code version bump in this evidence-only follow-up; package
and lockfile edits remain prohibited by the ticket. Acceptance and progression
remain subject to the unresolved host/provenance decisions above.
