import type { ContinuousAssessment, ContinuousAttack, ContinuousPassage, ContinuousPitchResult, ContinuousTiming } from "./continuous-types";

function timing(offset: number, tolerance: number, uncertainty: number | null): ContinuousTiming {
  if (uncertainty === null || !Number.isFinite(uncertainty)) return "uncertain";
  if (offset + uncertainty < -tolerance) return "early";
  if (offset - uncertainty > tolerance) return "late";
  if (Math.abs(offset) + uncertainty <= tolerance) return "on-time";
  return "uncertain";
}

/** Fixed, non-overlapping musical windows; correct pitches get first refusal globally. */
export function assessContinuous(passage: ContinuousPassage, attacks: readonly ContinuousAttack[],
  observedThroughMs = passage.durationMs + passage.tailMs): ContinuousAssessment {
  const used = new Set<number>();
  const groups = passage.expected.map((e) => {
    const candidates = attacks.filter((a) => Math.abs(a.timeMs - e.timeMs) <= e.associationMs)
      .sort((a, b) => Math.abs(a.timeMs - e.timeMs) - Math.abs(b.timeMs - e.timeMs) || a.timeMs - b.timeMs || a.id - b.id);
    const pitches: ContinuousPitchResult[] = e.target.expectedMidiNumbers.map((midi) => {
      const attack = candidates.find((a) => a.midi === midi && !used.has(a.id));
      if (!attack) return { midi, attackId: null, outcome: observedThroughMs >= e.timeMs + e.associationMs ? "missing" : "unobserved", timing: null, offsetMs: null };
      used.add(attack.id);
      const offsetMs = attack.timeMs - e.timeMs;
      return { midi, attackId: attack.id, outcome: "correct", timing: timing(offsetMs, e.onTimeMs, attack.uncertaintyMs), offsetMs };
    });
    return { targetId: e.target.id, measureIndex: e.target.measureIndex, eventIds: e.target.sourceEventIds, timeMs: e.timeMs, pitches, partialChord: false };
  });
  // Only after all correct-pitch matches, associate remaining wrong pitches to vacancies.
  groups.forEach((group, i) => {
    const e = passage.expected[i]!;
    const wrong = attacks.filter((a) => !used.has(a.id) && !e.target.expectedMidiNumbers.includes(a.midi)
      && Math.abs(a.timeMs - e.timeMs) <= e.associationMs)
      .sort((a, b) => Math.abs(a.timeMs - e.timeMs) - Math.abs(b.timeMs - e.timeMs) || a.timeMs - b.timeMs || a.id - b.id);
    group.pitches = group.pitches.map((p) => {
      if (p.outcome === "correct") return p;
      const a = wrong.shift();
      if (!a) return p;
      used.add(a.id);
      return { ...p, outcome: "wrong", attackId: a.id, offsetMs: a.timeMs - e.timeMs };
    });
    const matched = group.pitches.filter((p) => p.outcome === "correct").length;
    group.partialChord = group.pitches.length > 1 && matched > 0 && matched < group.pitches.length;
  });
  const pitches = groups.flatMap((g) => g.pitches);
  const count = (outcome: ContinuousPitchResult["outcome"]) => pitches.filter((p) => p.outcome === outcome).length;
  const timeCount = (value: ContinuousTiming) => pitches.filter((p) => p.timing === value).length;
  return { groups, extras: attacks.filter((a) => !used.has(a.id)).map((a) => a.id), expected: pitches.length,
    matched: count("correct"), wrong: count("wrong"), missing: count("missing"), unobserved: count("unobserved"),
    early: timeCount("early"), late: timeCount("late"), onTime: timeCount("on-time"), uncertain: timeCount("uncertain") };
}
