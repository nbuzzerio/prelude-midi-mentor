import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateMelodicIntervalTarget } from "@/lib/music/generators/intervals";
import { getClefForMode } from "@/lib/music/note-utils";
import type {
  PracticeClefMode,
  SequenceDirection,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceTarget,
} from "@/types/practice";

import { useSequenceTarget } from "./use-sequence-target";

vi.mock("@/lib/music/generators/intervals", () => ({
  generateMelodicIntervalTarget: vi.fn(),
}));

vi.mock("@/lib/music/note-utils", () => ({
  getClefForMode: vi.fn(),
}));

const ENABLED_DIRECTIONS = new Set<SequenceDirection>(["ascending"]);

const ENABLED_INTERVALS = new Set<SequenceInterval>(["major-third"]);

const ENABLED_NOTE_CATEGORIES = new Set<SequenceNoteCategory>(["naturals"]);

const GENERATED_TARGET: SequenceTarget = {
  clef: "bass",
  name: {
    primary: "Perfect fifth",
    secondary: "Descending melodic interval",
  },
  steps: [
    {
      notes: [
        {
          midiNumber: 48,
          name: "C",
          octave: 3,
        },
      ],
    },
    {
      notes: [
        {
          midiNumber: 41,
          name: "F",
          octave: 2,
        },
      ],
    },
  ],
};

describe("useSequenceTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getClefForMode).mockReturnValue("bass");
    vi.mocked(generateMelodicIntervalTarget).mockReturnValue(GENERATED_TARGET);
  });

  it("starts with the initial sequence target", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    expect(result.current.sequenceTarget).toEqual({
      clef: "treble",
      name: {
        primary: "Major third",
        secondary: "Ascending melodic interval",
      },
      steps: [
        {
          notes: [
            {
              midiNumber: 60,
              name: "C",
              octave: 4,
            },
          ],
        },
        {
          notes: [
            {
              midiNumber: 64,
              name: "E",
              octave: 4,
            },
          ],
        },
      ],
    });

    expect(result.current.startedAt).toBe(0);
  });

  it("returns the current target through the ref-backed getter", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    expect(result.current.getCurrentTarget()).toBe(
      result.current.sequenceTarget,
    );
  });

  it("starts unlocked", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    expect(result.current.isSequenceTargetLocked()).toBe(false);
  });

  it("locks the current target", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    act(() => {
      expect(result.current.lockSequenceTarget()).toBe(true);
    });

    expect(result.current.isSequenceTargetLocked()).toBe(true);
  });

  it("does not lock an already locked target again", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    act(() => {
      expect(result.current.lockSequenceTarget()).toBe(true);
      expect(result.current.lockSequenceTarget()).toBe(false);
    });

    expect(result.current.isSequenceTargetLocked()).toBe(true);
  });

  it("generates a target using the current mode and enabled settings", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    act(() => {
      result.current.generateNextTarget();
    });

    expect(getClefForMode).toHaveBeenCalledWith("treble");

    expect(generateMelodicIntervalTarget).toHaveBeenCalledWith({
      clef: "bass",
      enabledDirections: ENABLED_DIRECTIONS,
      enabledIntervals: ENABLED_INTERVALS,
      enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
    });
  });

  it("can generate a target using an explicit next mode", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    act(() => {
      result.current.generateNextTarget("mixed");
    });

    expect(getClefForMode).toHaveBeenCalledWith("mixed");
  });

  it("updates the rendered target and current-target ref", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    act(() => {
      result.current.generateNextTarget();
    });

    expect(result.current.sequenceTarget).toBe(GENERATED_TARGET);
    expect(result.current.getCurrentTarget()).toBe(GENERATED_TARGET);
  });

  it("records when the new target was generated", () => {
    vi.spyOn(Date, "now").mockReturnValue(12_345);

    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    act(() => {
      result.current.generateNextTarget();
    });

    expect(result.current.startedAt).toBe(12_345);
  });

  it("unlocks the target when generating the next target", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        mode: "treble",
      }),
    );

    act(() => {
      result.current.lockSequenceTarget();
    });

    expect(result.current.isSequenceTargetLocked()).toBe(true);

    act(() => {
      result.current.generateNextTarget();
    });

    expect(result.current.isSequenceTargetLocked()).toBe(false);
    expect(result.current.lockSequenceTarget()).toBe(true);
  });

  it("uses updated settings after the hook rerenders", () => {
    const updatedDirections = new Set<SequenceDirection>(["descending"]);

    const updatedIntervals = new Set<SequenceInterval>(["perfect-fifth"]);

    const updatedNoteCategories = new Set<SequenceNoteCategory>([
      "accidentals",
    ]);

    const { result, rerender } = renderHook(
      ({
        directions,
        intervals,
        noteCategories,
        mode,
      }: {
        directions: ReadonlySet<SequenceDirection>;
        intervals: ReadonlySet<SequenceInterval>;
        noteCategories: ReadonlySet<SequenceNoteCategory>;
        mode: PracticeClefMode;
      }) =>
        useSequenceTarget({
          enabledDirections: directions,
          enabledIntervals: intervals,
          enabledNoteCategories: noteCategories,
          mode,
        }),
      {
        initialProps: {
          directions: ENABLED_DIRECTIONS,
          intervals: ENABLED_INTERVALS,
          noteCategories: ENABLED_NOTE_CATEGORIES,
          mode: "treble",
        },
      },
    );

    rerender({
      directions: updatedDirections,
      intervals: updatedIntervals,
      noteCategories: updatedNoteCategories,
      mode: "bass",
    });

    act(() => {
      result.current.generateNextTarget();
    });

    expect(getClefForMode).toHaveBeenCalledWith("bass");

    expect(generateMelodicIntervalTarget).toHaveBeenCalledWith({
      clef: "bass",
      enabledDirections: updatedDirections,
      enabledIntervals: updatedIntervals,
      enabledNoteCategories: updatedNoteCategories,
    });
  });
});
