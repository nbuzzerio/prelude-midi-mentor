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
- Every product-code commit must update the authoritative `package.json` version. Use a semantic patch bump by default unless the owner explicitly approves a minor or major release, and mention the proposed version in the implementation plan. Do not silently skip the bump. A documentation-only commit is exempt only with explicit owner approval. The UI must continue deriving its visible version from `package.json`, tests must derive from or be updated for that version, and Git tagging/releasing remains owner-controlled.

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

## Routine command approval

The repository owner explicitly pre-approves routine local development commands needed to inspect, install dependencies, test, lint, type-check, build, or verify this repository. Codex may run these without asking for additional permission each time, including outside the sandbox when the execution environment requires it.

Pre-approved examples include:

- `pnpm install`
- `pnpm.cmd install`
- `pnpm install --frozen-lockfile`
- `pnpm.cmd install --frozen-lockfile`
- `pnpm verify`
- `pnpm.cmd verify`
- `$env:CI='true'; pnpm.cmd verify`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- focused Vitest and test commands
- `git diff`
- `git diff --check`
- `git status`
- read-only Git inspection commands
- package and version inspection
- ordinary filesystem and source inspection required for the task

If pnpm needs to refresh or reinstall local `node_modules` to perform requested repository work, that is also approved. Do not stop merely to ask whether these routine repository-development commands may run.

### Still requires explicit owner approval

This pre-approval does not authorize destructive or history-changing operations. Continue to require explicit owner instruction before:

- `git add` or staging, unless the owner explicitly requested staging for that task
- `git commit`
- `git push`
- tags or releases
- branch creation, deletion, or switching
- `git reset`
- `git restore`
- destructive checkout operations
- force operations
- deleting source or project files outside the approved implementation
- deployment or infrastructure mutation
- publishing packages
- changing external services, accounts, or secrets
- commands that could destroy authored work or stored user data

Never interpret routine-command approval as permission to mutate Git history or deploy.

### Environment and sandbox prompts

If the execution tool itself presents a native security confirmation UI, use an available approved execution path when possible rather than asking the owner conversationally again. For the routine repository commands listed above, the owner's standing answer is yes.

Only surface an approval request when:

- the tool or platform technically requires the user to click an approval control; or
- the command falls outside the routine pre-approved category.

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

## CxR handoff

- After completing implementation or review work and all requested validation, finish the handoff in this order:
  1. run the requested focused and final validation;
  2. run `git diff --check`;
  3. run `git status --short`;
  4. run the user's existing interactive Bash `cxdu` command to generate the CxR/Git-review artifact;
  5. report whether `cxdu` succeeded and include any generated artifact path it reports.
- On this Windows repository, `cxdu` is provided by the user's interactive Git Bash configuration. Invoke it with:

  ```bash
  & "C:\Program Files\Git\bin\bash.exe" -ic 'cxdu'
  ```

- `cxdu` is permitted only as this final handoff step. Its currently inspected definition delegates to `.dev/export-git-diff.cmd`, whose Git operations are read-only and whose generated artifact is `.dev/_git-diff.txt`.
- Do not redefine, duplicate, replace, or copy the implementation of `cxdu` into the repository, and do not create another repository script for it.
- If `cxdu` is unavailable or fails, report the command attempted and the failure accurately. Do not invent an artifact and do not treat failure as permission to stage, commit, reset, restore, checkout, clean, push, or otherwise mutate Git/index/history.
