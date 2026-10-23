import { describe, expect, it } from "vitest";
import { getMelodyPreparationCue } from "./melody-preparation-cue";

describe("audio-clock preparation cue", () => {
  it("has exactly three quarter-note pulses and ends at the performance origin", () => {
    expect([0, 480, 960].map(tick => getMelodyPreparationCue(tick))).toEqual([
      { remaining: 3, pulsing: true }, { remaining: 2, pulsing: true }, { remaining: 1, pulsing: true },
    ]);
    expect(getMelodyPreparationCue(120)).toEqual({ remaining: 3, pulsing: false });
    expect(getMelodyPreparationCue(1439)).toEqual({ remaining: 1, pulsing: false });
    for (const tick of [undefined, -1, 1440, NaN, Infinity]) expect(getMelodyPreparationCue(tick)).toBeNull();
  });
});
