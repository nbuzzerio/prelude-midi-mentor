import { useFlashcardSettings } from "@/features/flashcards/hooks/use-flashcard-settings";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";


describe("useFlashcardSettings", () => {
  it("returns the default flashcard settings", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    expect(result.current.mode).toBe("bass");
    expect(result.current.showTargetName).toBe(false);
    expect(result.current.replayCorrectVirtualChords).toBe(true);

    expect(result.current.enabledExerciseTypes).toEqual(new Set(["notes"]));
    expect(result.current.enabledNoteCategories).toEqual(new Set(["naturals"]));
    expect(result.current.enabledTriadQualities).toEqual(new Set(["major"]));
    expect(result.current.enabledTriadPositions).toEqual(new Set(["root"]));
  });

  it("updates the clef mode", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.setMode("treble");
    });

    expect(result.current.mode).toBe("treble");
  });

  it("updates whether the target name is shown", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.setShowTargetName(true);
    });

    expect(result.current.showTargetName).toBe(true);
  });

  it("updates whether correct virtual chords are replayed", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.setReplayCorrectVirtualChords(false);
    });

    expect(result.current.replayCorrectVirtualChords).toBe(false);
  });

  it("adds an exercise type when it is not enabled", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleExerciseType("triads");
    });

    expect(result.current.enabledExerciseTypes).toEqual(
      new Set(["notes", "triads"]),
    );
  });

  it("removes an exercise type when more than one is enabled", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleExerciseType("triads");
    });

    act(() => {
      result.current.toggleExerciseType("notes");
    });

    expect(result.current.enabledExerciseTypes).toEqual(new Set(["triads"]));
  });

  it("does not remove the final enabled exercise type", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    const originalSet = result.current.enabledExerciseTypes;

    act(() => {
      result.current.toggleExerciseType("notes");
    });

    expect(result.current.enabledExerciseTypes).toEqual(new Set(["notes"]));
    expect(result.current.enabledExerciseTypes).toBe(originalSet);
  });

  it("adds and removes note categories", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleNoteCategory("accidentals");
    });

    expect(result.current.enabledNoteCategories).toEqual(
      new Set(["naturals", "accidentals"]),
    );

    act(() => {
      result.current.toggleNoteCategory("naturals");
    });

    expect(result.current.enabledNoteCategories).toEqual(
      new Set(["accidentals"]),
    );
  });

  it("does not remove the final enabled note category", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleNoteCategory("naturals");
    });

    expect(result.current.enabledNoteCategories).toEqual(new Set(["naturals"]));
  });

  it("adds and removes triad qualities", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleTriadQuality("minor");
    });

    expect(result.current.enabledTriadQualities).toEqual(
      new Set(["major", "minor"]),
    );

    act(() => {
      result.current.toggleTriadQuality("major");
    });

    expect(result.current.enabledTriadQualities).toEqual(new Set(["minor"]));
  });

  it("does not remove the final enabled triad quality", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleTriadQuality("major");
    });

    expect(result.current.enabledTriadQualities).toEqual(new Set(["major"]));
  });

  it("adds and removes triad positions", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleTriadPosition("first");
    });

    expect(result.current.enabledTriadPositions).toEqual(
      new Set(["root", "first"]),
    );

    act(() => {
      result.current.toggleTriadPosition("root");
    });

    expect(result.current.enabledTriadPositions).toEqual(new Set(["first"]));
  });

  it("does not remove the final enabled triad position", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleTriadPosition("root");
    });

    expect(result.current.enabledTriadPositions).toEqual(new Set(["root"]));
  });

  it("creates a new Set when a toggle changes a selection", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    const originalSet = result.current.enabledTriadQualities;

    act(() => {
      result.current.toggleTriadQuality("minor");
    });

    expect(result.current.enabledTriadQualities).not.toBe(originalSet);
    expect(originalSet).toEqual(new Set(["major"]));
    expect(result.current.enabledTriadQualities).toEqual(
      new Set(["major", "minor"]),
    );
  });

  it("updates each selection group independently", () => {
    const { result } = renderHook(() => useFlashcardSettings());

    act(() => {
      result.current.toggleExerciseType("triads");
      result.current.toggleNoteCategory("accidentals");
      result.current.toggleTriadQuality("diminished");
      result.current.toggleTriadPosition("second");
    });

    expect(result.current.enabledExerciseTypes).toEqual(
      new Set(["notes", "triads"]),
    );
    expect(result.current.enabledNoteCategories).toEqual(
      new Set(["naturals", "accidentals"]),
    );
    expect(result.current.enabledTriadQualities).toEqual(
      new Set(["major", "diminished"]),
    );
    expect(result.current.enabledTriadPositions).toEqual(
      new Set(["root", "second"]),
    );
  });
});
