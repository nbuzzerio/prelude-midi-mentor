import { describe, expect, it, vi } from "vitest";
import { SCALE_REPERTOIRE_CATALOG, SCALE_REPERTOIRE_GROUPS, getScaleRepertoireEntry, realizeRepertoireScale, createScaleRepertoireTraversal, completeScaleRepertoireEntry, type ScaleRepertoireId } from "./scale-repertoire";
import { NOTE_RANGES } from "@/data/note-ranges";

describe("Scale repertoire catalog and spelling", () => {
  it("defines all 28 entries in major/relative-minor groups, with precisely 26 selectable", () => {
    expect(SCALE_REPERTOIRE_GROUPS.map((group) => group.map(({ id }) => id))).toEqual([
      ["c-major", "a-natural-minor", "a-harmonic-minor", "a-melodic-minor"],
      ["d-major", "b-natural-minor", "b-harmonic-minor", "b-melodic-minor"],
      ["e-major", "c-sharp-natural-minor", "c-sharp-harmonic-minor", "c-sharp-melodic-minor"],
      ["f-major", "d-natural-minor", "d-harmonic-minor", "d-melodic-minor"],
      ["g-major", "e-natural-minor", "e-harmonic-minor", "e-melodic-minor"],
      ["a-major", "f-sharp-natural-minor", "f-sharp-harmonic-minor", "f-sharp-melodic-minor"],
      ["b-major", "g-sharp-natural-minor", "g-sharp-harmonic-minor", "g-sharp-melodic-minor"],
    ]);
    expect(SCALE_REPERTOIRE_CATALOG).toHaveLength(28);
    expect(SCALE_REPERTOIRE_CATALOG.filter((entry) => !entry.disabledReason)).toHaveLength(26);
    expect(getScaleRepertoireEntry("g-sharp-natural-minor")).toMatchObject({ tonic: "g-sharp", form: "natural-minor", name: "G\u266f Natural Minor" });
    for (const id of ["g-sharp-harmonic-minor", "g-sharp-melodic-minor"] as const) {
      expect(getScaleRepertoireEntry(id).disabledReason).toMatch(/double accidentals/);
      expect(() => realizeRepertoireScale(id, "treble")).toThrow(/double accidentals/);
    }
  });
  it.each([
    ["c-major", "C D E F G A B C B A G F E D C"],
    ["a-natural-minor", "A B C D E F G A G F E D C B A"],
    ["a-harmonic-minor", "A B C D E F G\u266f A G\u266f F E D C B A"],
    ["a-melodic-minor", "A B C D E F\u266f G\u266f A G F E D C B A"],
    ["e-major", "E F\u266f G\u266f A B C\u266f D\u266f E D\u266f C\u266f B A G\u266f F\u266f E"],
    ["c-sharp-melodic-minor", "C\u266f D\u266f E F\u266f G\u266f A\u266f B\u266f C\u266f B A G\u266f F\u266f E D\u266f C\u266f"],
  ] as const)("realizes exact %s pitches up and back with one apex", (id, expected) => {
    const target = realizeRepertoireScale(id, "treble");
    expect(target.steps).toHaveLength(15);
    expect(target.steps.map((step) => step.notes[0].name).join(" ")).toBe(expected);
    const midis = target.steps.map((step) => step.notes[0].midiNumber);
    expect(midis[7] - midis[0]).toBe(12);
    expect(midis.filter((midi) => midi === midis[7])).toHaveLength(1);
    expect(midis.at(-1)).toBe(midis[0]);
  });
  it("uses C4 as treble C major's lower tonic", () => {
    expect(realizeRepertoireScale("c-major", "treble").steps.map((step) => step.notes[0].midiNumber)).toEqual([60,62,64,65,67,69,71,72,71,69,67,65,64,62,60]);
  });
  it.each(SCALE_REPERTOIRE_CATALOG.filter((entry) => !entry.disabledReason))("realizes $name safely in both clefs without changing written tonic", (entry) => {
    for (const clef of ["bass", "treble"] as const) {
      const target = realizeRepertoireScale(entry.id, clef);
      expect(target.steps).toHaveLength(15);
      expect(target.name.primary).toBe(entry.name);
      expect(target.steps[0].notes[0].name).toBe(entry.name.split(" ")[0]);
      for (const step of target.steps) {
        expect(step.notes).toHaveLength(1);
        expect(step.notes[0].midiNumber).toBeGreaterThanOrEqual(NOTE_RANGES[clef].minMidi);
        expect(step.notes[0].midiNumber).toBeLessThanOrEqual(NOTE_RANGES[clef].maxMidi);
      }
    }
  });
});

describe("Finite scale traversal", () => {
  const selection: readonly ScaleRepertoireId[] = ["c-major", "a-natural-minor", "g-major"];
  it("finishes in the user's order once, only through explicit successful completion", () => {
    let traversal = createScaleRepertoireTraversal(selection, "repertoire-in-order");
    expect(traversal.order).not.toBe(selection);
    for (const [index, id] of selection.entries()) {
      expect(traversal.order[traversal.completed]).toBe(id);
      realizeRepertoireScale(id, "treble"); realizeRepertoireScale(id, "treble");
      expect(traversal.completed).toBe(index);
      const result = completeScaleRepertoireEntry(traversal);
      expect(result.traversalCompleted).toBe(index === selection.length - 1);
      traversal = result.traversal;
    }
    expect(completeScaleRepertoireEntry(traversal)).toEqual({ traversal, traversalCompleted: false });
  });
  it("shuffles without replacement, with explicit completion and a fresh shuffle per restart/cycle", () => {
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(0.99);
    let traversal = createScaleRepertoireTraversal(selection, "repertoire-shuffle", random);
    expect(traversal.order).toEqual(["a-natural-minor", "g-major", "c-major"]);
    expect(new Set(traversal.order)).toEqual(new Set(selection));
    const originalOrder = traversal.order;
    for (let index = 0; index < selection.length; index += 1) {
      const result = completeScaleRepertoireEntry(traversal);
      expect(result.traversalCompleted).toBe(index === 2);
      traversal = result.traversal;
    }
    const fresh = createScaleRepertoireTraversal(selection, "repertoire-shuffle", random);
    expect(fresh.completed).toBe(0);
    expect(fresh.order).toEqual(selection);
    expect(originalOrder).toEqual(["a-natural-minor", "g-major", "c-major"]);
  });
  it("does not count an empty traversal and rejects unsupported entries", () => {
    expect(completeScaleRepertoireEntry(createScaleRepertoireTraversal([], "repertoire-in-order")).traversalCompleted).toBe(false);
    expect(() => createScaleRepertoireTraversal(["g-sharp-harmonic-minor"], "repertoire-in-order")).toThrow();
  });
});
