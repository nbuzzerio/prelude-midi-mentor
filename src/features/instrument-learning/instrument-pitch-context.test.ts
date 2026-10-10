import { describe, expect, it } from "vitest";
import { getInstrumentLiveContext, getLiveInstrumentPitch } from "./instrument-pitch-context";
import type { PitchSnapshot } from "@/lib/audio/monophonic/pitch-analysis-types";

const reading: PitchSnapshot = { state: "stable", fresh: true, ageMs: 0, pitch: { semitone: 62, frequencyHz: 293.66 } };
describe("instrument presentation pitch provenance", () => {
  it("uses exactly the fresh stable reading and reproduces the large playing panels' boundary", () => {
    expect(getInstrumentLiveContext("listening", reading)).toMatchObject({ state: "live", pitch: { semitone: 62 } });
    expect(getLiveInstrumentPitch("listening", { ...reading, ageMs: 120 })).not.toBeNull();
    expect(getLiveInstrumentPitch("listening", { ...reading, ageMs: 121 })).toBeNull();
  });
  it.each([
    [{ ...reading, state: "uncertain", fresh: false }, "uncertain"],
    [{ ...reading, state: "acquiring", fresh: false }, "uncertain"],
    [{ ...reading, ageMs: 121, fresh: false }, "stale"],
    [{ ...reading, pitch: null, state: "listening", fresh: false }, "absent"],
    [{ ...reading, ageMs: null }, "uncertain"],
    [{ ...reading, ageMs: -1 }, "uncertain"],
  ] as const)("does not locate historical/uncertain/absent pitch: %s", (value, state) => {
    expect(getInstrumentLiveContext("listening", value)).toEqual({ state, pitch: null });
  });
  it.each(["idle", "paused", "denied", "error"] as const)("cannot treat retained pitch as live when capture is %s", (status) => {
    expect(getInstrumentLiveContext(status, reading)).toEqual({ state: "absent", pitch: null });
  });
});
