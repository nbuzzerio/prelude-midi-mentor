import { getMelodyQuarterBeatSeconds, type MelodyTimedExpectedAttack } from "./melody-timing";
import type { MelodyPerformedAttack } from "./melody-performance";

export const MELODY_ALIGNMENT_CANDIDATE_WINDOW_BEATS = 0.75;
export const MELODY_ALIGNMENT_PITCH_WEIGHT = 0.2;
export const MELODY_ALIGNMENT_MISSING_COST = 1;
export const MELODY_ALIGNMENT_EXTRA_COST = 1;

export type MelodyAlignedAttack =
  | Readonly<{ kind: "matched"; expected: MelodyTimedExpectedAttack; performed: MelodyPerformedAttack; timingDeltaMs: number }>
  | Readonly<{ kind: "missing"; expected: MelodyTimedExpectedAttack }>
  | Readonly<{ kind: "extra"; performed: MelodyPerformedAttack }>;

type Operation = "match" | "missing" | "extra";
type Cell = Readonly<{ cost: number; previousI: number; previousJ: number; operation: Operation }>;
const COST_EPSILON = 1e-9;
const OPERATION_PRIORITY: Readonly<Record<Operation, number>> = Object.freeze({ match: 0, missing: 1, extra: 2 });

function prefer(candidate: Cell, current: Cell | undefined): boolean {
  if (!current) return true;
  if (candidate.cost < current.cost - COST_EPSILON) return true;
  if (Math.abs(candidate.cost - current.cost) > COST_EPSILON) return false;
  return OPERATION_PRIORITY[candidate.operation] < OPERATION_PRIORITY[current.operation];
}

export function getMelodyAlignmentCandidateWindowMs(tempoBpm: number): number {
  return getMelodyQuarterBeatSeconds(tempoBpm) * 1000 * MELODY_ALIGNMENT_CANDIDATE_WINDOW_BEATS;
}

export function alignMelodyAttacks(
  expected: readonly MelodyTimedExpectedAttack[],
  performedInput: readonly MelodyPerformedAttack[],
  tempoBpm: number,
): readonly MelodyAlignedAttack[] {
  const performed = [...performedInput].sort((a, b) => a.sequenceIndex - b.sequenceIndex || a.audioTimeSeconds - b.audioTimeSeconds || a.id.localeCompare(b.id));
  const windowMs = getMelodyAlignmentCandidateWindowMs(tempoBpm);
  const width = performed.length + 1;
  const cells: Array<Cell | undefined> = Array((expected.length + 1) * width);
  const at = (i: number, j: number) => i * width + j;
  cells[at(0, 0)] = { cost: 0, previousI: -1, previousJ: -1, operation: "match" };

  const offer = (i: number, j: number, cell: Cell) => {
    const index = at(i, j);
    if (prefer(cell, cells[index])) cells[index] = cell;
  };

  for (let i = 0; i <= expected.length; i += 1) {
    for (let j = 0; j <= performed.length; j += 1) {
      const current = cells[at(i, j)];
      if (!current) continue;
      if (i < expected.length && j < performed.length) {
        const timingDeltaMs = performed[j]!.relativeTimeMs - expected[i]!.expectedTimeMs;
        if (Math.abs(timingDeltaMs) <= windowMs) {
          const timingCost = Math.abs(timingDeltaMs) / windowMs;
          const pitchCost = Math.min(Math.abs(expected[i]!.midiNumber - performed[j]!.midiNumber), 12) / 12;
          offer(i + 1, j + 1, { cost: current.cost + timingCost + MELODY_ALIGNMENT_PITCH_WEIGHT * pitchCost, previousI: i, previousJ: j, operation: "match" });
        }
      }
      if (i < expected.length) offer(i + 1, j, { cost: current.cost + MELODY_ALIGNMENT_MISSING_COST, previousI: i, previousJ: j, operation: "missing" });
      if (j < performed.length) offer(i, j + 1, { cost: current.cost + MELODY_ALIGNMENT_EXTRA_COST, previousI: i, previousJ: j, operation: "extra" });
    }
  }

  const aligned: MelodyAlignedAttack[] = [];
  let i = expected.length;
  let j = performed.length;
  while (i > 0 || j > 0) {
    const cell = cells[at(i, j)];
    if (!cell) throw new Error("Melody alignment could not reach the final state.");
    if (cell.operation === "match") {
      const expectedAttack = expected[i - 1]!;
      const performedAttack = performed[j - 1]!;
      aligned.push(Object.freeze({ kind: "matched", expected: expectedAttack, performed: performedAttack, timingDeltaMs: performedAttack.relativeTimeMs - expectedAttack.expectedTimeMs }));
    } else if (cell.operation === "missing") {
      aligned.push(Object.freeze({ kind: "missing", expected: expected[i - 1]! }));
    } else {
      aligned.push(Object.freeze({ kind: "extra", performed: performed[j - 1]! }));
    }
    i = cell.previousI;
    j = cell.previousJ;
  }
  return Object.freeze(aligned.reverse());
}
