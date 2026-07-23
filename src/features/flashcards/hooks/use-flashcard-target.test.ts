import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { generatePracticeTarget } from "@/lib/music/notes";
import { useFlashcardTarget } from "./use-flashcard-target";

import type {
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNoteCategory,
  PracticeTarget,
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "@/types/practice";

type FlashcardTargetOptions = Readonly<{
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>;
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>;
  enabledTriadPositions: ReadonlySet<PracticeTriadPosition>;
  enabledTriadQualities: ReadonlySet<PracticeTriadQuality>;
  mode: PracticeClefMode;
}>;

vi.mock("@/lib/music/notes", () => ({
  generatePracticeTarget: vi.fn(),
}));

const mockedGeneratePracticeTarget = vi.mocked(generatePracticeTarget);

const DEFAULT_OPTIONS: FlashcardTargetOptions = {
  enabledExerciseTypes: new Set(["notes"]),
  enabledNoteCategories: new Set(["naturals"]),
  enabledTriadPositions: new Set(["root"]),
  enabledTriadQualities: new Set(["major"]),
  mode: "bass",
};

const GENERATED_TARGET: PracticeTarget = {
  clef: "treble",
  name: {
    primary: "E4",
    secondary: "Individual note",
  },
  notes: [
    {
      midiNumber: 64,
      name: "E",
      octave: 4,
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  mockedGeneratePracticeTarget.mockReset();
});

describe("useFlashcardTarget", () => {
  it("returns the initial target state", () => {
    const { result } = renderHook(() => useFlashcardTarget(DEFAULT_OPTIONS));

    expect(result.current.practiceTarget).toEqual({
      clef: "bass",
      name: {
        primary: "C3",
        secondary: "Individual note",
      },
      notes: [
        {
          midiNumber: 48,
          name: "C",
          octave: 3,
        },
      ],
    });

    expect(result.current.startedAt).toBe(0);
    expect(result.current.getCurrentTarget()).toEqual(
      result.current.practiceTarget,
    );
    expect(result.current.isAnswerLocked()).toBe(false);
  });

  it("generates a target using the current settings", () => {
    mockedGeneratePracticeTarget.mockReturnValue(GENERATED_TARGET);

    const { result } = renderHook(() => useFlashcardTarget(DEFAULT_OPTIONS));

    act(() => {
      result.current.generateNextTarget();
    });

    expect(mockedGeneratePracticeTarget).toHaveBeenCalledWith(
      "bass",
      DEFAULT_OPTIONS.enabledExerciseTypes,
      DEFAULT_OPTIONS.enabledNoteCategories,
      DEFAULT_OPTIONS.enabledTriadQualities,
      DEFAULT_OPTIONS.enabledTriadPositions,
    );

    expect(result.current.practiceTarget).toBe(GENERATED_TARGET);
    expect(result.current.getCurrentTarget()).toBe(GENERATED_TARGET);
  });

  it("allows the clef mode to be overridden for the next target", () => {
    mockedGeneratePracticeTarget.mockReturnValue(GENERATED_TARGET);

    const { result } = renderHook(() => useFlashcardTarget(DEFAULT_OPTIONS));

    act(() => {
      result.current.generateNextTarget("treble");
    });

    expect(mockedGeneratePracticeTarget).toHaveBeenCalledWith(
      "treble",
      DEFAULT_OPTIONS.enabledExerciseTypes,
      DEFAULT_OPTIONS.enabledNoteCategories,
      DEFAULT_OPTIONS.enabledTriadQualities,
      DEFAULT_OPTIONS.enabledTriadPositions,
    );
  });

  it("records the generation timestamp", () => {
    mockedGeneratePracticeTarget.mockReturnValue(GENERATED_TARGET);
    vi.spyOn(Date, "now").mockReturnValue(12_345);

    const { result } = renderHook(() => useFlashcardTarget(DEFAULT_OPTIONS));

    act(() => {
      result.current.generateNextTarget();
    });

    expect(result.current.startedAt).toBe(12_345);
  });

  it("locks the answer only once", () => {
    const { result } = renderHook(() => useFlashcardTarget(DEFAULT_OPTIONS));

    let firstResult = false;
    let secondResult = false;

    act(() => {
      firstResult = result.current.lockAnswer();
      secondResult = result.current.lockAnswer();
    });

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);
    expect(result.current.isAnswerLocked()).toBe(true);
  });

  it("unlocks the answer when a new target is generated", () => {
    mockedGeneratePracticeTarget.mockReturnValue(GENERATED_TARGET);

    const { result } = renderHook(() => useFlashcardTarget(DEFAULT_OPTIONS));

    act(() => {
      result.current.lockAnswer();
    });

    expect(result.current.isAnswerLocked()).toBe(true);

    act(() => {
      result.current.generateNextTarget();
    });

    expect(result.current.isAnswerLocked()).toBe(false);
  });

  it("uses updated settings after rerendering", () => {
    mockedGeneratePracticeTarget.mockReturnValue(GENERATED_TARGET);

    const updatedOptions: FlashcardTargetOptions = {
      enabledExerciseTypes: new Set(["triads"]),
      enabledNoteCategories: new Set(["accidentals"]),
      enabledTriadPositions: new Set(["second"]),
      enabledTriadQualities: new Set(["diminished"]),
      mode: "treble",
    };

    const { result, rerender } = renderHook(
      (options: FlashcardTargetOptions) => useFlashcardTarget(options),
      {
        initialProps: DEFAULT_OPTIONS,
      },
    );

    rerender(updatedOptions);

    act(() => {
      result.current.generateNextTarget();
    });

    expect(mockedGeneratePracticeTarget).toHaveBeenCalledWith(
      "treble",
      updatedOptions.enabledExerciseTypes,
      updatedOptions.enabledNoteCategories,
      updatedOptions.enabledTriadQualities,
      updatedOptions.enabledTriadPositions,
    );
  });

  it("updates the current target reference synchronously", () => {
    mockedGeneratePracticeTarget.mockReturnValue(GENERATED_TARGET);

    const { result } = renderHook(() => useFlashcardTarget(DEFAULT_OPTIONS));

    let targetDuringAction: PracticeTarget | undefined;

    act(() => {
      result.current.generateNextTarget();
      targetDuringAction = result.current.getCurrentTarget();
    });

    expect(targetDuringAction).toBe(GENERATED_TARGET);
    expect(result.current.practiceTarget).toBe(GENERATED_TARGET);
  });
});
