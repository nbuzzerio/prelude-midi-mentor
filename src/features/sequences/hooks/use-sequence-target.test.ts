import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateSequenceTarget } from "@/lib/music/generators/sequences";
import { SEQUENCE_DEFAULT_TIMING } from "@/lib/music/sequence-timing";
import { getClefForMode } from "@/lib/music/note-utils";
import {
  CHORD_PROGRESSION_TEMPLATES,
  SUPPORTED_CHORD_PROGRESSION_KEYS,
} from "@/lib/music/chord-progressions";
import type {
  ChordProgressionKeyId,
  ChordProgressionTemplateId,
} from "@/lib/music/chord-progressions";
import type {
  PracticeClefMode,
  SequenceArpeggio,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
  SequenceScaleDirection,
  SequenceTarget,
} from "@/types/practice";

import { useSequenceTarget } from "./use-sequence-target";

vi.mock("@/lib/music/generators/sequences", () => ({
  generateSequenceTarget: vi.fn(),
}));

vi.mock("@/lib/music/note-utils", () => ({
  getClefForMode: vi.fn(),
}));

const ENABLED_ARPEGGIOS = new Set<SequenceArpeggio>(["major"]);

const ALL_CHORD_PROGRESSION_KEY_IDS = new Set<ChordProgressionKeyId>(
  SUPPORTED_CHORD_PROGRESSION_KEYS.map((key) => key.id),
);

const ALL_CHORD_PROGRESSION_TEMPLATE_IDS =
  new Set<ChordProgressionTemplateId>(
    CHORD_PROGRESSION_TEMPLATES.map((template) => template.id),
  );

const ENABLED_DIRECTIONS = new Set<SequenceDirection>(["ascending"]);

const ENABLED_INTERVALS = new Set<SequenceInterval>(["major-third"]);

const ENABLED_NOTE_CATEGORIES = new Set<SequenceNoteCategory>(["naturals"]);

const ENABLED_SCALES = new Set<SequenceScale>(["major"]);

const ENABLED_SCALE_DIRECTIONS = new Set<SequenceScaleDirection>([
  "ascending",
]);

const EXERCISE_TYPE: SequenceExerciseType = "intervals";

const GENERATED_TARGET: SequenceTarget = {
  clef: "bass",
  name: {
    primary: "Perfect fifth",
    secondary: "Descending melodic interval",
  },
  steps: [
    {
      durationTicks: 480,
      notes: [
        {
          midiNumber: 48,
          name: "C",
          octave: 3,
        },
      ],
    },
    {
      durationTicks: 480,
      notes: [
        {
          midiNumber: 41,
          name: "F",
          octave: 2,
        },
      ],
    },
  ],
  timing: SEQUENCE_DEFAULT_TIMING,
};

describe("useSequenceTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getClefForMode).mockReturnValue("bass");
    vi.mocked(generateSequenceTarget).mockReturnValue(GENERATED_TARGET);
  });

  it("starts with the initial sequence target", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
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
          durationTicks: 480,
          notes: [
            {
              midiNumber: 60,
              name: "C",
              octave: 4,
            },
          ],
        },
        {
          durationTicks: 480,
          notes: [
            {
              midiNumber: 64,
              name: "E",
              octave: 4,
            },
          ],
        },
      ],
      timing: SEQUENCE_DEFAULT_TIMING,
    });

    expect(result.current.startedAt).toBe(0);
  });

  it("returns the current target through the ref-backed getter", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
        mode: "treble",
      }),
    );

    expect(result.current.isSequenceTargetLocked()).toBe(false);
  });

  it("locks the current target", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
        mode: "treble",
      }),
    );

    act(() => {
      result.current.generateNextTarget();
    });

    expect(getClefForMode).toHaveBeenCalledWith("treble");

    expect(generateSequenceTarget).toHaveBeenCalledWith({
      exerciseType: "intervals",
      clef: "bass",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
      enabledChordProgressionTemplateIds:
        ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
      enabledDirections: ENABLED_DIRECTIONS,
      enabledIntervals: ENABLED_INTERVALS,
      enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
      enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
      enabledScales: ENABLED_SCALES,
    });
  });

  it("can generate a target using an explicit next mode", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
        mode: "treble",
      }),
    );

    act(() => {
      result.current.generateNextTarget("mixed");
    });

    expect(getClefForMode).toHaveBeenCalledWith("mixed");
  });

  it("forwards explicit chord progression settings after resolving mixed clef", () => {
    const progressionKeyIds = new Set<ChordProgressionKeyId>(["c-major"]);
    const progressionTemplateIds = new Set<ChordProgressionTemplateId>([
      "major-1451",
    ]);
    vi.mocked(getClefForMode).mockReturnValue("treble");

    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: progressionKeyIds,
        enabledChordProgressionTemplateIds: progressionTemplateIds,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: "chord-progressions",
        mode: "mixed",
      }),
    );

    act(() => {
      result.current.generateNextTarget();
    });

    expect(getClefForMode).toHaveBeenCalledWith("mixed");
    expect(generateSequenceTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        clef: "treble",
        enabledChordProgressionKeyIds: progressionKeyIds,
        enabledChordProgressionTemplateIds: progressionTemplateIds,
        exerciseType: "chord-progressions",
      }),
    );
  });

  it("updates the rendered target and current-target ref", () => {
    const { result } = renderHook(() =>
      useSequenceTarget({
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
        enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
        enabledDirections: ENABLED_DIRECTIONS,
        enabledIntervals: ENABLED_INTERVALS,
        enabledNoteCategories: ENABLED_NOTE_CATEGORIES,
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
        exerciseType: EXERCISE_TYPE,
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
    const updatedArpeggios = new Set<SequenceArpeggio>(["minor"]);

    const updatedDirections = new Set<SequenceDirection>(["descending"]);

    const updatedIntervals = new Set<SequenceInterval>(["perfect-fifth"]);

    const updatedNoteCategories = new Set<SequenceNoteCategory>([
      "accidentals",
    ]);

    const updatedScales = new Set<SequenceScale>(["natural-minor"]);

    const updatedScaleDirections = new Set<SequenceScaleDirection>([
      "ascending-descending",
    ]);

    const updatedExerciseType: SequenceExerciseType = "scales";

    const { result, rerender } = renderHook(
      ({
        arpeggios,
        directions,
        exerciseType,
        intervals,
        noteCategories,
        scaleDirections,
        scales,
        mode,
      }: {
        arpeggios: ReadonlySet<SequenceArpeggio>;
        directions: ReadonlySet<SequenceDirection>;
        exerciseType: SequenceExerciseType;
        intervals: ReadonlySet<SequenceInterval>;
        noteCategories: ReadonlySet<SequenceNoteCategory>;
        scaleDirections: ReadonlySet<SequenceScaleDirection>;
        scales: ReadonlySet<SequenceScale>;
        mode: PracticeClefMode;
      }) =>
        useSequenceTarget({
          enabledArpeggios: arpeggios,
          enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
          enabledChordProgressionTemplateIds:
            ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
          enabledDirections: directions,
          enabledIntervals: intervals,
          enabledNoteCategories: noteCategories,
          enabledScaleDirections: scaleDirections,
          enabledScales: scales,
          exerciseType,
          mode,
        }),
      {
        initialProps: {
          arpeggios: ENABLED_ARPEGGIOS,
          directions: ENABLED_DIRECTIONS,
          exerciseType: EXERCISE_TYPE,
          intervals: ENABLED_INTERVALS,
          noteCategories: ENABLED_NOTE_CATEGORIES,
          scaleDirections: ENABLED_SCALE_DIRECTIONS,
          scales: ENABLED_SCALES,
          mode: "treble",
        },
      },
    );

    rerender({
      arpeggios: updatedArpeggios,
      directions: updatedDirections,
      exerciseType: updatedExerciseType,
      intervals: updatedIntervals,
      noteCategories: updatedNoteCategories,
      scaleDirections: updatedScaleDirections,
      scales: updatedScales,
      mode: "bass",
    });

    act(() => {
      result.current.generateNextTarget();
    });

    expect(getClefForMode).toHaveBeenCalledWith("bass");

    expect(generateSequenceTarget).toHaveBeenCalledWith({
      exerciseType: updatedExerciseType,
      clef: "bass",
      enabledArpeggios: updatedArpeggios,
      enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
      enabledChordProgressionTemplateIds:
        ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
      enabledDirections: updatedDirections,
      enabledIntervals: updatedIntervals,
      enabledNoteCategories: updatedNoteCategories,
      enabledScaleDirections: updatedScaleDirections,
      enabledScales: updatedScales,
    });
  });
});
