import { describe, expect, it } from "vitest";
import { MELODY_PHASE_ONE_METER } from "./melody-meter";

describe("Melody Phase 1 meter", () => {
  it("defines a 4/4 eighth-subdivision counting guide independently of note durations", () => {
    expect(MELODY_PHASE_ONE_METER).toEqual({
      timeSignature: "4/4", capacityTicks: 1920, beatTicks: 480, subdivisionTicks: 240, countInBeats: 4,
      countTokens: [
        { tick: 0, label: "1" }, { tick: 240, label: "&" }, { tick: 480, label: "2" }, { tick: 720, label: "&" },
        { tick: 960, label: "3" }, { tick: 1200, label: "&" }, { tick: 1440, label: "4" }, { tick: 1680, label: "&" },
      ],
    });
  });
});
