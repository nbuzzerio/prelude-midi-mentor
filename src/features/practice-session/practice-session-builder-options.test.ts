import { describe, expect, it } from "vitest";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "./practice-session-builder-options";
import { parsePracticeExerciseEntry } from "./practice-session-validation";

describe("Practice Session builder options", () => {
  it("provides all eight human-facing concepts as valid detached entries", () => {
    expect(PRACTICE_SESSION_BUILDER_OPTIONS.map(({ label }) => label)).toEqual(["Note Recognition", "Triads", "Melodic Intervals", "Scales", "Arpeggios", "Chord Progressions", "Ear Intervals", "Reading Flow"]);
    for (const option of PRACTICE_SESSION_BUILDER_OPTIONS) expect(parsePracticeExerciseEntry(option.createEntry(option.id))).toMatchObject({ ok: true });
  });

  it("uses explicit draft and native target defaults", () => {
    const entries = Object.fromEntries(PRACTICE_SESSION_BUILDER_OPTIONS.map((option) => [option.id, option.createEntry(option.id)]));
    for (const id of ["note-recognition", "triads", "melodic-intervals", "arpeggios", "chord-progressions", "ear-intervals"]) expect(entries[id]!.target).toMatchObject({ count: null });
    expect(entries.scales!.target).toEqual({ kind: "complete-scale-repertoire" });
    expect(entries["reading-flow"]!).toMatchObject({ config: { continuousPractice: true, continuousDurationMinutes: 5 }, target: { kind: "configured-timed-practice" } });
  });
});
