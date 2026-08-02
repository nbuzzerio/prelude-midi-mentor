# Prelude Development Instructions

## Project workflow

- Use pnpm for all package commands.
- Run `pnpm verify` before declaring implementation work complete.
- Do not commit, tag, or push unless explicitly asked.
- Prefer small, focused changes.
- Explain affected files and the proposed approach before editing.
- Flag architectural, music-theory, or UX risks before proceeding.
- Summarize every changed file after completing a task.

## Architecture

- Preserve Flashcards, Sequences, and Free Play as separate feature domains.
- Keep music-domain logic independent of React where practical.
- Keep validation separate from input collection.
- Prefer existing helpers and established patterns before creating new abstractions.
- Avoid broad refactors unless explicitly requested.

## Music behavior

- Use correct standard musical terminology and notation.
- Preserve theory-aware note spelling for intervals, scales, and arpeggios.
- Do not simplify musical terminology merely to make it more beginner-friendly.
- Double accidentals are not currently supported unless a task explicitly adds them.

## Safety

- Do not reveal, print, modify, or summarize secret values.
- Do not inspect `.env` files unless a task genuinely requires checking variable names.
- Ask before using network access or modifying anything outside this repository.
- Do not delete files or run destructive Git commands unless explicitly instructed.

## Testing

- Test public behavior and musical rules rather than implementation details.
- Prefer deterministic tests and focused regression coverage.
- Manual MIDI and browser testing may still be required for interaction behavior.