import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Accidental, Beam, Dot, GhostNote, StaveNote, Stem, Stroke } from "vexflow";
import { getStaffBuilderVisualDuration, type StaffBuilderProjectedEvent, type StaffBuilderProjectedVoice } from "./staff-builder-notation";
import {
  applyStaffBuilderVexFlowAccidentals,
  createStaffBuilderVexFlowBeams,
  createStaffBuilderVexFlowTickable,
  createStaffBuilderVexFlowVoices,
  staffBuilderVexFlowPitchKey,
  staffBuilderTicksToVexFlowDuration,
} from "./staff-builder-vexflow-rendering";
import type { StaffBuilderDuration } from "../staff-builder-time";

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
  staff: "treble", voiceIndex, tickables: [0, 240].map((startTick, index) => event({
    eventId: `event-${voiceIndex}-${index}`,
    startTick,
    layoutDurationTicks: 240,
    visualDuration: { duration: "eighth", vexflowDuration: "8", dots: 0, ticks: 240 },
  })),
  beam: { beatGroups: ["1/4"], eventIds: [`event-${voiceIndex}-0`, `event-${voiceIndex}-1`] },
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

describe("Staff Builder shared VexFlow rendering", () => {
  it.each([
    ["quarter", 480, 4096],
    ["eighth", 240, 2048],
    ["sixteenth", 120, 1024],
    ["dotted-eighth", 360, 3072],
  ] as const)("maps Prelude %s ticks to VexFlow RESOLUTION ticks", (duration, preludeTicks, vexFlowTicks) => {
    const visualDuration = getStaffBuilderVisualDuration(duration);
    const rendered = createStaffBuilderVexFlowTickable(event({ layoutDurationTicks: preludeTicks, visualDuration }));
    expect(staffBuilderTicksToVexFlowDuration(preludeTicks).toString()).toBe(`${preludeTicks}/1920`);
    expect(rendered.note.getTicks().value()).toBe(vexFlowTicks);
  });

  it.each([
    [["eighth", "eighth"]],
    [["sixteenth", "sixteenth", "sixteenth", "sixteenth"]],
    [["dotted-eighth", "sixteenth"]],
  ] as const)("creates a real VexFlow beam for %j", (durations) => {
    let startTick = 0;
    const tickables = durations.map((duration, index) => {
      const visualDuration = getStaffBuilderVisualDuration(duration as StaffBuilderDuration);
      const projected = event({ eventId: `beam-${index}`, startTick, layoutDurationTicks: visualDuration.ticks, visualDuration });
      startTick += visualDuration.ticks;
      return projected;
    });
    const projection: StaffBuilderProjectedVoice = {
      staff: "treble",
      voiceIndex: 0,
      tickables,
      beam: { beatGroups: ["1/4"], eventIds: tickables.map(({ eventId }) => eventId) },
    };
    const rendered = createStaffBuilderVexFlowVoices([projection], "4/4");
    expect(createStaffBuilderVexFlowBeams(rendered)).toHaveLength(1);
  });

  it("attaches a native directionless Stroke only to authored arpeggiated chords", () => {
    const rolled = createStaffBuilderVexFlowTickable(event({ arpeggiation: "up" })).note as StaveNote;
    const ordinary = createStaffBuilderVexFlowTickable(event()).note as StaveNote;
    expect(rolled.getModifiers().filter((modifier) => modifier instanceof Stroke)).toHaveLength(1);
    expect(ordinary.getModifiers().filter((modifier) => modifier instanceof Stroke)).toHaveLength(0);
  });

  it("keeps arpeggiation compatible with accidentals, ledger pitches, and multiple voices", () => {
    const ledger = event({ arpeggiation: "up", pitches: [
      { id: "low", midiNumber: 36, letter: "C", accidental: "natural", octave: 2 },
      { id: "sharp", midiNumber: 78, letter: "F", accidental: "sharp", octave: 5 },
      { id: "flat", midiNumber: 82, letter: "B", accidental: "flat", octave: 5 },
    ] });
    expect(() => createStaffBuilderVexFlowTickable(ledger)).not.toThrow();
    expect(() => createStaffBuilderVexFlowVoices([voice(0), { ...voice(1), tickables: [ledger] }], "4/4")).not.toThrow();
  });
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
    expect(createStaffBuilderVexFlowBeams(voices)).toHaveLength(2);
    expect(beams).toHaveBeenCalledTimes(2);
    expect(beams.mock.calls.every((call) => call[1]?.maintainStemDirections === true)).toBe(true);
    applyStaffBuilderVexFlowAccidentals(voices, "G");
    expect(accidentals).toHaveBeenCalledWith(voices.map(({ voice: vexVoice }) => vexVoice), "G");
  });
});
