# Prelude audit: prioritized implementation backlog

Review date: **6 November 2026**. Application: **2.9.24**.

Start here for the proposed work order. The [application audit](2026-11-06-application-audit.md) contains technical evidence and the [UX/UI audit](2026-11-06-ux-ui-audit.md) contains interaction findings and design proposals. Finding IDs below refer to those reports.

**Status: assessment complete; product changes not implemented or approved.** The user authorized audit and documentation only. No source, test, package, or Git-history changes were made. The small current-documentation corrections listed below are complete. This queue is a set of workstreams to split into focused implementation plans, not a single approved refactor.

## What the second pass changed

| Finding | New evidence | Effect on the queue |
| --- | --- | --- |
| Improv summary, E9 | Valid 64,000-event missing-release fixture: median 7,391 ms summary versus 134 ms paired-input summary, executed in Node; summary runs synchronously in the review component | Highest measured performance priority; retain abnormal-input caveat |
| Improv listing, E8 | Actual list APIs read 11,000 metadata rows to return 1,000, separately for collections and selected takes | Fix read amplification when touching library performance; latency remains unmeasured |
| Score timing, E3 | Actual 512-measure resolver: median 0.443 ms per call on this desktop | Lower urgency to P3 pending device/end-to-end profiling |
| Legacy import, U14 | Current component loses newer edited text when an older read resolves; oversized-file rejection clears the prior draft | Add a small, high-value draft-preservation fix |
| Rolodex focus, U16 | Pausing the focused Active row removes it and leaves focus on BODY in jsdom | Add mutation focus/announcement acceptance, beyond dialogs |
| Melody evidence, A10/E10 | MIDI source time is dropped; synthetic delayed preparation input is admitted; high-rate input has no per-attempt evidence cap | Separate timing/provenance decision from input-budget resilience work |
| Melody wording, U17 | Pitch 100% / Timing 0% can intentionally earn “mastered” | Clarify pitch-only scope without silently changing grading |
| Save/print lifecycle, U15/D6 | Save continues after closing by design; print's one-second fallback completes despite active print media in an isolated nonblocking mock | Improve save wording; add browser print acceptance before claiming a browser defect |

The second pass also rejected apparent defects in PWA reload handling, native download cancellation, continuous assessment boundaries, and Improv replay/pause behavior after tracing the relevant safeguards. Preserving working contracts is part of the improvement plan.

## First ten workstreams

Priorities are local product priorities, not security scores. **P1** protects work, prevents reachable crashes, or resolves misleading musical evidence. **P2** addresses significant usability/reliability/scaling. Sizes are relative: **S** localized, **M** several related files, **L** persistence or cross-feature contracts. They are not delivery-time estimates. Every row remains proposed.

| Order | Workstream | Priority / size | Evidence | Dependency or decision |
| --- | --- | --- | --- | --- |
| 1 | Protect pitch-first history from failed saves and competing writers | P1; M then L | A2/A3: executed persistence probes | Retention, conflict, ownership, terminal-state policy |
| 2 | Make every selectable arpeggio configuration safe | P1; S/M | A1: deterministic generator failure and sweep | Preserve theory spelling and unsupported-double-accidental boundary |
| 3 | Preserve library changes and import drafts | P1; S for U14, L for A4 | A4/U14: executed store/component probes | Immediate stale-read fencing can be separate; durable concurrency needs a storage plan |
| 4 | Resolve written-versus-sounding pitch inconsistency | P1 decision; M | A5: executed parser/validator/projection disagreement | Owner-approved import/music contract and repair policy |
| 5 | Make storage denial and feature errors recoverable | P1/P2; M | A6 executed; A8 source-confirmed | Separate preference fallback from feature-boundary design |
| 6 | Remove expensive Improv summary and redundant library reads | P2; M, separate patches | E9 timings; E8 operation counts | Preserve raw evidence, pairing, integrity checks, and library limits |
| 7 | Repair modal focus and focus after list mutations | P2; M, separate feature patches | U1/U2 source; U16 component probe | Nested Escape, initial heading focus, focus return, background inertness |
| 8 | Make visible controls truthful and usable across input methods | P2; S/M then M/L | U3–U7/U9/U15; source and analytical evidence | Keyboard/multitouch semantics, color measurement, save lifecycle wording |
| 9 | Clarify and protect Melody performance evidence | P2; M, separate behavior decisions | A10/E10/U17 executed synthetic cases | Timestamp clock mapping, uncertainty, accepted-evidence budget; grading unchanged unless approved |
| 10 | Make existing music and first practice easier to discover | P2 enhancement; S then M | U12/U13: current paths; benefit is a hypothesis | Start with shortcuts; starter program needs musical/input review |

### 1. Protect pitch-first history

Source cluster: `src/features/piece-practice/persistence/piece-practice-runs.ts`, its tests, and the owning save/resume callers identified in the scoped plan. Keep this work within the pitch-first domain; newer continuous/weekly stores provide design precedents without requiring engine consolidation.

Start with the narrow failure case: a generic failed write must not delete the oldest saved run. Then specify conflict handling and terminal immutability. An equal revision with different content must not be reported as a successful acknowledged write.

Acceptance: two failed writes retain prior records; a simulated quota failure has a deliberate recoverable path; equal-revision conflicts are surfaced; a stale active writer cannot replace completed evidence; restart/retry preserves identity and acknowledged outcomes. Exercise the two-writer case in separate real browser contexts after deterministic store tests.

### 2. Make selectable generators safe

Source cluster: `src/lib/music/generators/sequences.ts`, its tests, and existing eligibility/spelling helpers in `src/lib/music/note-utils.ts` where needed.

Acceptance: every supported root/quality/direction/clef combination produces valid theory-spelled material or is excluded before selection with an explicit reason. Include B augmented in treble and bass, all three directions. Do not repair the exception by relabeling pitches enharmonically in a way that changes the requested theory, or by adding double accidentals outside scope.

### 3. Preserve libraries and source drafts

Source clusters: Staff Builder's `hooks/use-staff-builder-library.ts` and `components/staff-builder-session.tsx`; Practice Session's `practice-session-library.ts`, `components/practice-session-builder.tsx`, and `components/weekly-practice-import-dialog.tsx`. Split the small importer repair from the larger durable-library design.

Acceptance: two tabs saving unrelated edits retain both; conflicting edits remain recoverable; a delayed import cannot replace newer library work; a failed/oversized file read leaves pasted text intact; edits after read start invalidate that read's result. Decide draft guarantees before coalescing writes or moving storage. Pair A4 with E2 so a faster save does not preserve the same data-loss mechanism.

### 4. Reconcile notation and grading

Source cluster: Staff Builder's `persistence/staff-builder-schema.ts`, `staff-builder-validation.ts`, validation presentation, and Piece Practice's `piece-practice-projection.ts` as needed.

The current permissive import contract intentionally does not compare written pitch with MIDI. Decide whether inconsistency blocks practice, requires an explicit repair choice, or produces a clearly marked review state. Preserve the original import and identify the affected measure/event. Do not silently treat MIDI as correct and rewrite the notation.

Acceptance: the C4-MIDI/E4-written example cannot appear fully validated while silently grading the other pitch; correct B♯3/C4 and C♭4/B3 relationships remain accepted; octaves and accidentals are checked together; unsupported double accidentals stay outside scope.

### 5. Keep failures recoverable

Source clusters: `src/lib/audio/instrument-volume.ts`, `feedback.ts`, their consumers, and separately `src/App.tsx`/`main.tsx` plus feature recovery presentation.

Acceptance: denied reads/writes do not remove usable volume controls; temporary in-memory volume changes still notify listeners; rejected lazy chunks and descendant rendering failures leave a useful shell and preserve unrelated retained owners. Async/event-handler failures need explicit handling in addition to render boundaries. Retrying must not automatically reload away drafts or temporary recordings. Add containment before expanding E1's lazy-loading boundary.

### 6. Bound Improv derived work

Source clusters: `src/features/improv/improv-performance.ts`, `components/improv-take-review.tsx`, and separately `hooks/use-improv-library.ts`/`persistence/improv-indexeddb.ts`.

Acceptance: summary outputs remain equivalent for overlaps, missing releases, velocity-zero releases, pauses, cross-channel notes, and unmatched events. Scaling checks cover large valid evidence without arbitrary truncation or optimistic certainty. Opening a take remains responsive on a supported modest device. For pagination, preserve corruption/identity checks and ordering while eliminating whole-collection rereads per page; superseded refreshes stop between awaits. Changes to a worker message contract need explicit type/lifecycle review.

### 7. Repair focus behavior

Source clusters: Staff Builder's `staff-builder-print-options.tsx`, `staff-builder-print-flow.tsx`, `staff-builder-study-view.tsx`; `practice-session-print-report.tsx`; Piece Practice's `piece-practice-results.tsx` and `rolodex/rolodex-library.tsx`.

Acceptance: initial Tab and Shift+Tab remain inside a modal, including when a heading receives initial focus; Escape closes only the innermost layer; background controls cannot receive interaction; close returns meaningful focus. Pausing/archiving a focused filtered row moves focus predictably and announces how to find it. Test first, middle, last, and only-row cases, delayed saves, and failure. A shared dialog presentation pattern is appropriate; shared practice state is not required.

### 8. Make controls truthful and accessible

Source clusters: Free Play and Sequence session components/shared audio controls; `src/components/notation/piano-keyboard.tsx`; `src/hooks/use-mobile-play.ts`; affected styles/tokens; `practice-program-import-dialog.tsx` and owning status presentation.

Start with small independent fixes: hide an unavailable replay option, generate unique IDs even with the retained legacy host, and change “Cancel” to “Close” after a durable save begins. Then address primary-action contrast, virtual piano navigation/touch targets, and browser fullscreen synchronization.

Acceptance: every enabled control changes the promised behavior; accessible labels target the intended control; white-text/action colors meet the chosen measured contrast requirement; the piano has a deliberate keyboard entry/navigation model and usable touch range; fullscreen denial/exit retains working inline controls and correct focus. Test physical multi-touch and screen readers separately from unit tests. Do not require fullscreen for the core exercise.

### 9. Protect Melody evidence and explain its scope

Source clusters: `src/features/melody/components/melody-session.tsx`, `melody-performance.ts`, `melody-alignment.ts`, and separately `components/melody-timed-session-review.tsx`. Review existing low-level clock helpers without merging Melody with continuous Piece Practice.

The safest first presentation improvement is explicit pitch-only achievement language. Timestamp admission and event budgets need separate plans because they affect what evidence is accepted and how incomplete attempts are reported.

Acceptance: delayed preparation events cannot confidently masquerade as performance evidence; mismatched/missing clock provenance has a defined uncertain path; high-rate input interrupts visibly at a documented budget with the accepted prefix retained. Pitch-perfect/Timing-0% examples clearly describe pitch achievement rather than broad mastery. Preserve original versus repair evidence and current grading unless its change is explicitly approved.

### 10. Expose existing capabilities through users' tasks

Source clusters: `src/App.tsx`; Staff Builder's `components/staff-builder-session.tsx` and `staff-builder-library.tsx`; Practice Session's `components/practice-program-library.tsx`.

First try direct Piece Library/Rolodex entry points using existing owners. Then plan a previewable starter lesson that works without external JSON or an AI account and explains required input. Keep the broader five-destination navigation proposal as a research hypothesis rather than a prerequisite.

Acceptance: new users can start an appropriate exercise, find and practice a saved piece, and return to a difficult passage without learning the internal ownership names. Observe these tasks with piano/MIDI, virtual-input, and acoustic users. Navigation must preserve or explicitly resolve active sessions, drafts, and temporary recordings.

## Next queue and measurement plan

| Area | What to do next | Completion evidence |
| --- | --- | --- |
| Import/recovery, A7/A9 | Set bounded import policy; offer raw rescue/selected salvage and owner-controlled history/archive tools | Over-limit input rejected without data loss; malformed library remains exportable; near-capacity workflow is usable |
| Initial loading, E1 | Add feature failure containment, then defer unused feature entry/setup code | Cold and warm initial JS/parse/execute timings on a stated device; first/offline lazy entry; retained session survives navigation |
| Editor work, E2–E4 | Measure serialization, engraving, and timing together; cache only justified stable inputs | Real score-size ladder and UI-only interaction traces; no extra notation redraw for unchanged music; revision invalidation verified |
| Histories, E5/E8 | Profile real and near-capacity stores, then use targeted reads/cursors | Read counts, elapsed query time, corruption behavior, and stale request cancellation |
| Audio, E6 | Measure onset jitter under engraving/import load before scheduler redesign | Audible/recorded device evidence with input/output route and load stated; cancellation and offline playback unchanged |
| Idle/long sessions, E7/E10 | Remove idle rerenders; define evidence/resource policies before introducing caps | Idle render/work measurements; high-rate/long-run interruption preserves truthful results |
| Print, D6 | Test long-open preview/cancel on supported browsers | Printable document survives while print is active; lifecycle finishes once; title and focus restore correctly |
| Delivery, D1–D3 | Align pnpm/Node and maintain a small browser regression gate | Reproducible install/verify; exact test totals; tracked browser scenarios independent of ignored historical scripts |
| Offline audio, D5 | Treat sample size as a product tradeoff | Quality, installation/storage cost, format support, and offline behavior measured before changing precache |
| Notation accessibility, U10 | Test meaningful alternatives against each musical task | Real accessibility-tree and assistive-technology checks; descriptions do not accidentally give away the exercise answer |

Avoid optimization claims based only on line count, big-O notation, bundle warnings, or desktop microbenchmarks. Record device/browser, fixture shape, warmup/cache state, median and tail behavior, and whether measurements include rendering/storage/audio. Count operations when a timer would be unstable. The E3 reprioritization demonstrates why measurement matters.

## Decisions to preserve

- Keep Flashcards, Sequences, Free Play, Melody, continuous practice, and Improv ownership distinct. Reuse proven low-level helpers and interaction patterns without merging independent engines.
- Preserve theory-aware spelling, classical melodic-minor direction, and the current unsupported-double-accidental boundary.
- Preserve original performance evidence, terminal acknowledgements, uncertainty, and explicit input/audio permission.
- Do not automatically reload during practice or equate a browser download request with a verified file save.
- Do not silently change intentional mastery, timing, timer-duration, or importer contracts while fixing wording or performance.
- Review the source files, public/shared type changes, test cases, UX effects, and architectural/music risks in each later implementation plan. A later product-code commit requires an explicitly proposed version bump; this audit leaves **2.9.24** unchanged and makes no commits.

## Documentation completed and validation

| File | Change |
| --- | --- |
| `docs/audits/2026-11-06-application-audit.md` | Correctness, data integrity, efficiency, architecture, delivery, measured probes, priorities, limitations, and acceptance |
| `docs/audits/2026-11-06-ux-ui-audit.md` | Interaction/accessibility findings, navigation and first-use proposals, mode-by-mode suggestions, research and acceptance matrix |
| `docs/audits/2026-11-06-prioritized-backlog.md` | This cross-report queue, dependencies, file clusters, decision gates, and completion criteria |
| `README.md` | Corrected destination count, added Improv to the capability diagram, corrected Melody lead-in |
| `docs/ONBOARDING.md` | Corrected destination list/count and Melody lead-in |
| `docs/ARCHITECTURE.md` | Marked the historical two-beat Checkpoint 5 account as superseded by the current three-beat F3A behavior |

Full audit-session verification passed: **325 test files / 4,713 tests**, native exit 0, with lint/type/build/PWA stages complete. The second pass additionally ran **6 test files / 145 tests**, native exit 0, covering browser-print hook, download dialog, native save, PWA registration, Improv performance, and Improv IndexedDB. The focused tests are a subset of the full suite, not 145 additional unique tests. One existing ESLint warning remains. Synthetic probes are separate from those test counts.

Fresh browser access was unavailable; automatic approval review rejected opening Brave without a reason. No bypass was attempted. Browser, physical MIDI/audio, touch, assistive-technology, and actual storage-failure acceptance remain outstanding for future implementation. Historical screenshots and source review do not certify current rendered behavior.

No product fixes, staging, commits, branch changes, release, or deployment occurred. The final handoff refreshes the repository-local CxR artifact and reports its actual result separately.
