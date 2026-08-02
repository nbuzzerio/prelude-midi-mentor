# Prelude Development Instructions

## Project workflow

- Use pnpm for all package commands.
- Run `pnpm verify` before declaring implementation work complete.
- Prefer small, focused changes.
- Keep documentation synchronized with implemented behavior.
- Summarize every changed file after completing a task.
- Report the exact test-file and test counts after verification.
- Flag architectural, music-theory, UX, accessibility, or testing risks before proceeding.
- Do not silently expand the requested scope.

## Planning and approval

- For nontrivial features, inspect the repository and present an implementation plan before modifying files.
- Wait for explicit approval before implementing a planned feature.
- A plan is required when a task is expected to:
  - modify more than approximately five source files;
  - introduce or change public/shared types;
  - alter architecture or feature ownership;
  - change music-theory behavior;
  - affect multiple practice modes.
- The plan should identify:
  - expected files;
  - the responsibility of each change;
  - required type changes;
  - required tests;
  - UI or UX effects;
  - music-theory decisions;
  - architectural risks.
- If implementation later requires files outside the approved plan, stop and explain why before changing them.

## Architecture

- Preserve Flashcards, Sequences, and Free Play as separate feature domains.
- Keep music-domain logic independent of React where practical.
- Keep validation separate from input collection.
- Keep feature-specific settings and state within their owning feature.
- Prefer existing helpers and established patterns before creating new abstractions.
- Avoid broad refactors unless explicitly requested and approved.
- Do not merge independent practice state machines merely to reduce superficial duplication.

## Music behavior

- Use correct standard musical terminology and notation.
- Preserve theory-aware note spelling for intervals, scales, and arpeggios.
- Do not simplify musical terminology merely to make it more beginner-friendly.
- Double accidentals are not currently supported unless a task explicitly adds them.
- Treat classical melodic minor as:
  - raised sixth and seventh degrees while ascending;
  - natural minor while descending.
- Surface ambiguous musical behavior as a decision before implementation rather than choosing silently.

## Git boundaries

- Do not stage files.
- Do not commit.
- Do not create, switch, or delete branches.
- Do not tag releases.
- Do not push.
- Do not open pull requests.
- Do not run destructive Git commands.
- Git status and read-only diff commands may be used only when needed for inspection.
- The user retains responsibility for reviewing, staging, committing, tagging, and pushing.
- If files are already staged, report that fact accurately.

## Safety

- Do not reveal, print, modify, or summarize secret values.
- Do not inspect `.env` files unless a task genuinely requires checking variable names.
- When checking environment configuration, refer to variable names only and never output their values.
- Ask before using network access or modifying anything outside this repository.
- Do not delete files unless deletion is explicitly requested and approved.

## Testing

- Test public behavior and musical rules rather than implementation details.
- Prefer deterministic tests and focused regression coverage.
- Test random generators through constraints and invariants rather than statistical distribution.
- Add regression coverage for bugs found through manual testing when practical.
- Do not weaken or remove tests merely to make verification pass.
- Manual MIDI, browser, responsive-layout, audio, and interaction testing may still be required.
- After implementation, run:

  ```bash
  pnpm verify
  ```
