import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Accidental, Beam, Dot, GhostNote, StaveNote, Stem } from "vexflow";
import type { StaffBuilderProjectedEvent, StaffBuilderProjectedVoice } from "./staff-builder-notation";
import {
  applyStaffBuilderVexFlowAccidentals,
  createStaffBuilderVexFlowBeams,
  createStaffBuilderVexFlowTickable,
  createStaffBuilderVexFlowVoices,
  staffBuilderVexFlowPitchKey,
} from "./staff-builder-vexflow-rendering";

const event = (overrides: Partial<StaffBuilderProjectedEvent> = {}): StaffBuilderProjectedEvent => ({
  kind: "notes", eventId: "event", staff: "treble", startTick: 0, layoutDurationTicks: 720, unresolved: false,
  visualDuration: { duration: "dotted-quarter", vexflowDuration: "q", dots: 1, ticks: 720 },
  pitches: [
    { id: "f", midiNumber: 66, letter: "F", accidental: "sharp", octave: 4 },
    { id: "a", midiNumber: 69, letter: "A", accidental: "natural", octave: 4 },
  ],
  ...overrides,
});

const voice = (voiceIndex: number): StaffBuilderProjectedVoice => ({
  staff: "treble", voiceIndex, tickables: [event({ eventId: `event-${voiceIndex}` })],
  beam: { beatGroups: ["1/4"], eventIds: [`event-${voiceIndex}`] },
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

describe("Staff Builder shared VexFlow rendering", () => {
  it("preserves pitched/chord keys, duration, dots, rests, and ghosts", () => {
    const dots = vi.spyOn(Dot, "buildAndAttach");
    expect(staffBuilderVexFlowPitchKey(event(), 0)).toBe("f#/4");
    expect(staffBuilderVexFlowPitchKey(event(), 1)).toBe("a/4");
    const chord = createStaffBuilderVexFlowTickable(event());
    expect(chord.note).toBeInstanceOf(StaveNote);
    expect((chord.note as StaveNote).getKeys()).toEqual(["f#/4", "a/4"]);
    expect(dots).toHaveBeenCalledTimes(1);
    const rest = createStaffBuilderVexFlowTickable(event({ kind: "rest", pitches: [] }));
    expect((rest.note as StaveNote).isRest()).toBe(true);
    const ghost = createStaffBuilderVexFlowTickable({
      kind: "spacer", staff: "bass", startTick: 0, durationTicks: 480,
      visualDuration: { duration: "quarter", vexflowDuration: "q", dots: 0, ticks: 480 },
    });
    expect(ghost.note).toBeInstanceOf(GhostNote);
  });

  it("preserves polyphonic stems, beams, and effective-key accidental application", () => {
    const stems = vi.spyOn(StaveNote.prototype, "setStemDirection");
    const beams = vi.spyOn(Beam, "generateBeams");
    const accidentals = vi.spyOn(Accidental, "applyAccidentals");
    const voices = createStaffBuilderVexFlowVoices([voice(0), voice(1)], "4/4");
    expect(stems.mock.calls.map(([direction]) => direction)).toEqual(expect.arrayContaining([Stem.UP, Stem.DOWN]));
    createStaffBuilderVexFlowBeams(voices);
    expect(beams).toHaveBeenCalledTimes(2);
    expect(beams.mock.calls.every((call) => call[1]?.maintainStemDirections === true)).toBe(true);
    applyStaffBuilderVexFlowAccidentals(voices, "G");
    expect(accidentals).toHaveBeenCalledWith(voices.map(({ voice: vexVoice }) => vexVoice), "G");
  });
});
