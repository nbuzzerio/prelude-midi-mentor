import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PracticeNote, PracticeTarget, SequenceTarget } from "@/types/practice";
import { SEQUENCE_DEFAULT_TIMING } from "./sequence-timing";

const mocks = vi.hoisted(() => ({
  accidentalApplyCalls: [] as Array<ReadonlyArray<unknown>>,
  accidentalInstances: [] as Array<{ type: string }>,
  connectorInstances: [] as Array<{ connectorType?: string }>,
  formatterInstances: [] as object[],
  rendererInstances: [] as object[],
  staveInstances: [] as object[],
  staveNoteInstances: [] as Array<{
    addModifier: ReturnType<typeof vi.fn>;
    options: Record<string, unknown>;
    setAttribute: ReturnType<typeof vi.fn>;
  }>,
  voiceInstances: [] as object[],
}));

vi.mock("vexflow", () => {
  class Accidental {
    static applyAccidentals(voices: unknown[], keySignature: string) {
      mocks.accidentalApplyCalls.push([voices, keySignature]);
    }

    type: string;

    constructor(type: string) {
      this.type = type;
      mocks.accidentalInstances.push(this);
    }
  }

  class Renderer {
    static Backends = { SVG: "svg" };

    container: HTMLDivElement;
    context = {};

    constructor(container: HTMLDivElement) {
      this.container = container;
      mocks.rendererInstances.push(this);
      container.appendChild(
        document.createElementNS("http://www.w3.org/2000/svg", "svg"),
      );
    }

    getContext() {
      return this.context;
    }

    resize = vi.fn();
  }

  class Stave {
    addClef = vi.fn(() => this);
    addKeySignature = vi.fn(() => this);
    addTimeSignature = vi.fn(() => this);
    draw = vi.fn(() => this);
    setContext = vi.fn(() => this);

    constructor(
      public x: number,
      public y: number,
      public width: number,
    ) {
      mocks.staveInstances.push(this);
    }
  }

  class StaveConnector {
    static type = { BRACE: "brace", SINGLE_LEFT: "single-left" };

    draw = vi.fn(() => this);
    setContext = vi.fn(() => this);
    setType = vi.fn((type: string) => {
      this.connectorType = type;
      return this;
    });
    connectorType?: string;

    constructor(
      public top: Stave,
      public bottom: Stave,
    ) {
      mocks.connectorInstances.push(this);
    }
  }

  class StaveNote {
    addModifier = vi.fn(() => this);
    setAttribute = vi.fn(() => this);
    setStyle = vi.fn(() => this);

    constructor(public options: Record<string, unknown>) {
      mocks.staveNoteInstances.push(this);
    }
  }

  class Voice {
    static Mode = { SOFT: "soft" };
    addTickable = vi.fn((tickable: unknown) => {
      this.tickables.push(tickable);
      return this;
    });
    addTickables = vi.fn((tickables: unknown[]) => {
      this.tickables.push(...tickables);
      return this;
    });
    draw = vi.fn();
    setMode = vi.fn(() => this);
    tickables: unknown[] = [];

    constructor(public options: Record<string, unknown>) {
      mocks.voiceInstances.push(this);
    }
  }

  class Formatter {
    format = vi.fn(() => this);
    joinVoices = vi.fn(() => this);

    constructor() {
      mocks.formatterInstances.push(this);
    }
  }

  return {
    Accidental,
    Formatter,
    Renderer,
    Stave,
    StaveConnector,
    StaveNote,
    Voice,
  };
});

import {
  renderGrandStaffHeldNotes,
  renderPracticeTarget,
  renderSequenceTarget,
} from "./vexflow";

const note = (midiNumber: number, name: string, octave: number): PracticeNote => ({
  midiNumber,
  name,
  octave,
});

beforeEach(() => {
  mocks.accidentalApplyCalls.length = 0;
  mocks.accidentalInstances.length = 0;
  mocks.connectorInstances.length = 0;
  mocks.formatterInstances.length = 0;
  mocks.rendererInstances.length = 0;
  mocks.staveInstances.length = 0;
  mocks.staveNoteInstances.length = 0;
  mocks.voiceInstances.length = 0;
});

describe("renderGrandStaffHeldNotes", () => {
  it("uses authoritative written notes and preserves the bass/treble split", () => {
    const container = document.createElement("div");

    renderGrandStaffHeldNotes(container, [
      note(66, "G♭", 4),
      note(48, "C", 3),
      note(65, "F♯", 4),
      note(70, "B♭", 4),
      note(71, "B", 4),
    ]);

    expect(mocks.staveNoteInstances).toHaveLength(2);
    expect(mocks.staveNoteInstances[0]?.options).toMatchObject({
      clef: "treble",
      keys: ["f#/4", "gb/4", "bb/4", "b/4"],
    });
    expect(mocks.staveNoteInstances[1]?.options).toMatchObject({
      clef: "bass",
      keys: ["c/3"],
    });
  });

  it("adds the selected signature to both staves and applies it independently", () => {
    const container = document.createElement("div");

    renderGrandStaffHeldNotes(
      container,
      [note(54, "F♯", 3), note(66, "F♯", 4)],
      "g-major",
    );

    const [trebleStave, bassStave] = mocks.staveInstances as Array<{
      addKeySignature: ReturnType<typeof vi.fn>;
    }>;
    expect(trebleStave?.addKeySignature).toHaveBeenCalledWith("G");
    expect(bassStave?.addKeySignature).toHaveBeenCalledWith("G");
    expect(mocks.accidentalApplyCalls).toHaveLength(2);
    expect(mocks.accidentalApplyCalls.map((call) => call[1])).toEqual(["G", "G"]);
    expect(mocks.accidentalApplyCalls[0]?.[0]).not.toBe(
      mocks.accidentalApplyCalls[1]?.[0],
    );
  });

  it("uses C only as accidental context for No Key", () => {
    const container = document.createElement("div");

    renderGrandStaffHeldNotes(container, [note(66, "F♯", 4)]);

    for (const stave of mocks.staveInstances as Array<{
      addKeySignature: ReturnType<typeof vi.fn>;
    }>) {
      expect(stave.addKeySignature).not.toHaveBeenCalled();
    }
    expect(mocks.accidentalApplyCalls.map((call) => call[1])).toEqual(["C"]);
  });

  it("distinguishes explicitly selected C major from No Key", () => {
    const container = document.createElement("div");

    renderGrandStaffHeldNotes(container, [], "c-major");

    for (const stave of mocks.staveInstances as Array<{
      addKeySignature: ReturnType<typeof vi.fn>;
    }>) {
      expect(stave.addKeySignature).toHaveBeenCalledWith("C");
    }
  });

  it("passes contradictory naturals and chromatic spellings to key-aware processing", () => {
    const container = document.createElement("div");

    renderGrandStaffHeldNotes(
      container,
      [note(65, "F", 4), note(66, "F♯", 4)],
      "g-major",
    );
    expect(mocks.staveNoteInstances[0]?.options).toMatchObject({
      keys: ["f/4", "f#/4"],
    });

    renderGrandStaffHeldNotes(
      container,
      [note(66, "G♭", 4), note(70, "B♭", 4), note(71, "B", 4)],
      "f-major",
    );
    expect(mocks.staveNoteInstances.at(-1)?.options).toMatchObject({
      keys: ["gb/4", "bb/4", "b/4"],
    });
    expect(mocks.accidentalApplyCalls.map((call) => call[1])).toEqual(["G", "F"]);
  });

  it("does not manually attach accidental modifiers in Free Play", () => {
    const container = document.createElement("div");

    renderGrandStaffHeldNotes(container, [note(66, "F♯", 4)]);

    const renderedNote = mocks.staveNoteInstances[0] as {
      addModifier: ReturnType<typeof vi.fn>;
    };
    expect(renderedNote.addModifier).not.toHaveBeenCalled();
    expect(mocks.accidentalInstances).toHaveLength(0);
  });

  it("keeps an empty responsive grand staff with both connectors", () => {
    const container = document.createElement("div");

    renderGrandStaffHeldNotes(container, []);

    expect(mocks.staveInstances).toHaveLength(2);
    expect(mocks.connectorInstances).toHaveLength(2);
    expect(mocks.connectorInstances.map((connector) => connector.connectorType)).toEqual([
      "brace",
      "single-left",
    ]);
    expect(mocks.voiceInstances).toHaveLength(0);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 560 460");
    expect(svg?.getAttribute("width")).toBe("100%");
    expect(svg?.getAttribute("height")).toBe("100%");
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    expect(svg?.style.display).toBe("block");
  });
});

describe("graded notation accidental regression", () => {
  it("keeps explicit Practice accidental modifiers", () => {
    const container = document.createElement("div");
    const target: PracticeTarget = {
      clef: "treble",
      name: { primary: "F sharp" },
      notes: [note(66, "F♯", 4)],
    };

    renderPracticeTarget(container, target);

    expect(mocks.accidentalInstances.map((accidental) => accidental.type)).toEqual(["#"]);
    expect(
      (mocks.staveNoteInstances[0] as { addModifier: ReturnType<typeof vi.fn> })
        .addModifier,
    ).toHaveBeenCalledTimes(1);
    expect(mocks.accidentalApplyCalls).toHaveLength(0);
  });

  it("keeps explicit Sequence accidental modifiers", () => {
    const container = document.createElement("div");
    const target: SequenceTarget = {
      clef: "treble",
      name: { primary: "Sequence" },
      steps: [{ durationTicks: 480, notes: [note(70, "B♭", 4)] }],
      timing: SEQUENCE_DEFAULT_TIMING,
    };

    renderSequenceTarget(container, target, 0, {
      firstVisibleStepIndex: 0,
      lastVisibleStepIndex: 0,
      showWholeSequence: false,
    });

    expect(mocks.accidentalInstances.map((accidental) => accidental.type)).toEqual(["b"]);
    expect(
      (mocks.staveNoteInstances[0] as { addModifier: ReturnType<typeof vi.fn> })
        .addModifier,
    ).toHaveBeenCalledTimes(1);
    expect(mocks.accidentalApplyCalls).toHaveLength(0);
  });
});

describe("timed Sequence notation", () => {
  function timedTarget(
    durations: readonly number[],
    chordAt = -1,
  ): SequenceTarget {
    return {
      clef: "treble",
      name: { primary: "Timed sequence" },
      steps: durations.map((durationTicks, index) => ({
        durationTicks,
        notes:
          index === chordAt
            ? [note(60, "C", 4), note(64, "E", 4), note(67, "G", 4)]
            : [note(60 + index, "C", 4)],
      })),
      timing: SEQUENCE_DEFAULT_TIMING,
    };
  }

  it("maps supported tick durations and uses the target meter", () => {
    const container = document.createElement("div");
    const target = timedTarget([120, 240, 480, 960, 120]);

    renderSequenceTarget(container, target, 2, {
      firstVisibleStepIndex: 0,
      lastVisibleStepIndex: 4,
      showWholeSequence: true,
    });

    expect(
      mocks.staveNoteInstances.map(({ options }) => options.duration),
    ).toEqual(["16", "8", "q", "h", "16"]);
    expect(
      mocks.voiceInstances.map(
        (voice) => (voice as { options: Record<string, unknown> }).options,
      ),
    ).toEqual([{ beatValue: 4, numBeats: 4 }]);
  });

  it("rejects unsupported notation durations without rounding", () => {
    expect(() =>
      renderSequenceTarget(document.createElement("div"), timedTarget([300]), 0, {
        firstVisibleStepIndex: 0,
        lastVisibleStepIndex: 0,
        showWholeSequence: false,
      }),
    ).toThrow("300 ticks is not supported by notation");
  });

  it("renders a current-measure window with the correct active attack", () => {
    const target = timedTarget([480, 480, 480, 480, 480, 480]);
    renderSequenceTarget(document.createElement("div"), target, 0, {
      firstVisibleStepIndex: 4,
      lastVisibleStepIndex: 5,
      showWholeSequence: false,
    });

    expect(mocks.staveNoteInstances).toHaveLength(2);
    expect(mocks.staveNoteInstances[0]?.setAttribute).toHaveBeenCalledWith(
      "data-sequence-active",
      "true",
    );
    expect(mocks.staveNoteInstances[1]?.setAttribute).not.toHaveBeenCalled();
  });

  it("renders whole temporal measures and a soft final partial measure", () => {
    const target = timedTarget([480, 480, 480, 480, 480]);
    renderSequenceTarget(document.createElement("div"), target, 4, {
      firstVisibleStepIndex: 0,
      lastVisibleStepIndex: 4,
      showWholeSequence: true,
    });

    expect(mocks.staveInstances).toHaveLength(2);
    expect(mocks.voiceInstances).toHaveLength(2);
    const rendererWidth = (
      mocks.rendererInstances[0] as {
        resize: ReturnType<typeof vi.fn>;
      }
    ).resize.mock.calls[0]?.[0] as number;
    const [firstStave, finalStave] = mocks.staveInstances as Array<{
      width: number;
      x: number;
    }>;
    expect(firstStave.x + firstStave.width).toBe(finalStave.x);
    expect(finalStave.x + finalStave.width).toBeLessThanOrEqual(rendererWidth);
    expect(
      (
        mocks.staveInstances[0] as {
          addTimeSignature: ReturnType<typeof vi.fn>;
        }
      ).addTimeSignature,
    ).toHaveBeenCalledWith("4/4");
    expect(
      (
        mocks.staveInstances[1] as {
          addTimeSignature: ReturnType<typeof vi.fn>;
        }
      ).addTimeSignature,
    ).not.toHaveBeenCalled();
    for (const voice of mocks.voiceInstances as Array<{
      setMode: ReturnType<typeof vi.fn>;
    }>) {
      expect(voice.setMode).toHaveBeenCalledWith("soft");
    }
  });

  it("keeps a simultaneous chord in one timed StaveNote", () => {
    renderSequenceTarget(
      document.createElement("div"),
      timedTarget([480], 0),
      0,
      {
        firstVisibleStepIndex: 0,
        lastVisibleStepIndex: 0,
        showWholeSequence: false,
      },
    );

    expect(mocks.staveNoteInstances).toHaveLength(1);
    expect(mocks.staveNoteInstances[0]?.options.keys).toEqual([
      "c/4",
      "e/4",
      "g/4",
    ]);
  });
});
