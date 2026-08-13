import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSequenceSettings } from "./use-sequence-settings";

describe("useSequenceSettings", () => {
  it("uses the default sequence settings", () => {
    const { result } = renderHook(() => useSequenceSettings());

    expect(result.current.mode).toBe("treble");

    expect(result.current.showTargetName).toBe(false);

    expect(result.current.exerciseType).toBe("intervals");

    expect(result.current.enabledChordProgressionKeyIds).toEqual(
      new Set(["c-major"]),
    );
    expect(result.current.enabledChordProgressionTemplateIds).toEqual(
      new Set(["major-1451"]),
    );

    expect(result.current.enabledScales).toEqual(new Set(["major"]));

    expect(result.current.enabledScaleDirections).toEqual(
      new Set(["ascending"]),
    );

    expect(result.current.enabledArpeggioDirections).toEqual(
      new Set(["ascending-descending"]),
    );

    expect(result.current.enabledDirections).toEqual(new Set(["ascending"]));

    expect(result.current.enabledIntervals).toEqual(
      new Set(["minor-second", "major-second", "minor-third", "major-third"]),
    );

    expect(result.current.enabledNoteCategories).toEqual(new Set(["naturals"]));
  });

  describe("mode", () => {
    it("can change to bass clef", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.setMode("bass");
      });

      expect(result.current.mode).toBe("bass");
    });

    it("can change to mixed clefs", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.setMode("mixed");
      });

      expect(result.current.mode).toBe("mixed");
    });
  });

  describe("target name visibility", () => {
    it("can show the target name", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.setShowTargetName(true);
      });

      expect(result.current.showTargetName).toBe(true);
    });

    it("can hide the target name again", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.setShowTargetName(true);
        result.current.setShowTargetName(false);
      });

      expect(result.current.showTargetName).toBe(false);
    });
  });

  describe("directions", () => {
    it("can enable another direction", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleDirection("descending");
      });

      expect(result.current.enabledDirections).toEqual(
        new Set(["ascending", "descending"]),
      );
    });

    it("can disable an enabled direction when another remains", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleDirection("descending");
      });

      act(() => {
        result.current.toggleDirection("ascending");
      });

      expect(result.current.enabledDirections).toEqual(new Set(["descending"]));
    });

    it("does not disable the final enabled direction", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleDirection("ascending");
      });

      expect(result.current.enabledDirections).toEqual(new Set(["ascending"]));
    });
  });

  describe("intervals", () => {
    it("can enable another interval", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleInterval("perfect-fifth");
      });

      expect(result.current.enabledIntervals).toEqual(
        new Set([
          "minor-second",
          "major-second",
          "minor-third",
          "major-third",
          "perfect-fifth",
        ]),
      );
    });

    it("can disable an enabled interval when others remain", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleInterval("minor-second");
      });

      expect(result.current.enabledIntervals).toEqual(
        new Set(["major-second", "minor-third", "major-third"]),
      );
    });

    it("does not disable the final enabled interval", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleInterval("major-second");
        result.current.toggleInterval("minor-third");
        result.current.toggleInterval("major-third");
      });

      expect(result.current.enabledIntervals).toEqual(
        new Set(["minor-second"]),
      );

      act(() => {
        result.current.toggleInterval("minor-second");
      });

      expect(result.current.enabledIntervals).toEqual(
        new Set(["minor-second"]),
      );
    });
  });

  describe("note categories", () => {
    it("can enable another note category", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleNoteCategory("accidentals");
      });

      expect(result.current.enabledNoteCategories).toEqual(
        new Set(["naturals", "accidentals"]),
      );
    });

    it("can disable an enabled note category when another remains", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleNoteCategory("accidentals");
      });

      act(() => {
        result.current.toggleNoteCategory("naturals");
      });

      expect(result.current.enabledNoteCategories).toEqual(
        new Set(["accidentals"]),
      );
    });

    it("does not disable the final enabled note category", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleNoteCategory("naturals");
      });

      expect(result.current.enabledNoteCategories).toEqual(
        new Set(["naturals"]),
      );
    });
  });

  describe("exercise type", () => {
    it("can switch to scale practice", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.setExerciseType("scales");
      });

      expect(result.current.exerciseType).toBe("scales");
    });

    it("can switch back to interval practice", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.setExerciseType("scales");
        result.current.setExerciseType("intervals");
      });

      expect(result.current.exerciseType).toBe("intervals");
    });
  });

  describe("scales", () => {
    it("can enable ascending and descending scale practice", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleScaleDirection("ascending-descending");
      });

      expect(result.current.enabledScaleDirections).toEqual(
        new Set(["ascending", "ascending-descending"]),
      );
      expect(result.current.enabledDirections).toEqual(new Set(["ascending"]));
    });

    it("does not disable the final enabled scale direction", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleScaleDirection("ascending");
      });

      expect(result.current.enabledScaleDirections).toEqual(
        new Set(["ascending"]),
      );
    });

    it("can enable another scale", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleScale("natural-minor");
      });

      expect(result.current.enabledScales).toEqual(
        new Set(["major", "natural-minor"]),
      );
    });

    it("can disable an enabled scale when another remains", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleScale("natural-minor");
      });

      act(() => {
        result.current.toggleScale("major");
      });

      expect(result.current.enabledScales).toEqual(new Set(["natural-minor"]));
    });

    it("does not disable the final enabled scale", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleScale("major");
      });

      expect(result.current.enabledScales).toEqual(new Set(["major"]));
    });
  });

  describe("arpeggio directions", () => {
    it("changes independently from interval and scale directions", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => {
        result.current.toggleArpeggioDirection("descending");
        result.current.toggleArpeggioDirection("ascending-descending");
      });

      expect(result.current.enabledArpeggioDirections).toEqual(
        new Set(["descending"]),
      );
      expect(result.current.enabledDirections).toEqual(new Set(["ascending"]));
      expect(result.current.enabledScaleDirections).toEqual(
        new Set(["ascending"]),
      );
    });
  });

  describe("chord progressions", () => {
    it("can transition from major-only to minor-only selections", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => result.current.toggleChordProgressionKey("a-minor"));
      act(() => result.current.toggleChordProgressionTemplate("minor-1451"));
      act(() => result.current.toggleChordProgressionKey("c-major"));
      act(() => result.current.toggleChordProgressionTemplate("major-1451"));

      expect(result.current.enabledChordProgressionKeyIds).toEqual(
        new Set(["a-minor"]),
      );
      expect(result.current.enabledChordProgressionTemplateIds).toEqual(
        new Set(["minor-1451"]),
      );
    });

    it("rejects removing the final key and preserves its reference", () => {
      const { result } = renderHook(() => useSequenceSettings());
      const original = result.current.enabledChordProgressionKeyIds;

      act(() => result.current.toggleChordProgressionKey("c-major"));

      expect(result.current.enabledChordProgressionKeyIds).toBe(original);
    });

    it("rejects removing the final template and preserves its reference", () => {
      const { result } = renderHook(() => useSequenceSettings());
      const original = result.current.enabledChordProgressionTemplateIds;

      act(() =>
        result.current.toggleChordProgressionTemplate("major-1451"),
      );

      expect(result.current.enabledChordProgressionTemplateIds).toBe(original);
    });

    it("rejects a mode-incompatible prospective key selection", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() => result.current.toggleChordProgressionKey("a-minor"));
      const beforeRejectedToggle = result.current.enabledChordProgressionKeyIds;
      act(() => result.current.toggleChordProgressionKey("c-major"));

      expect(result.current.enabledChordProgressionKeyIds).toBe(
        beforeRejectedToggle,
      );
      expect(result.current.enabledChordProgressionKeyIds).toEqual(
        new Set(["c-major", "a-minor"]),
      );
    });

    it("rejects a mode-incompatible prospective template selection", () => {
      const { result } = renderHook(() => useSequenceSettings());

      act(() =>
        result.current.toggleChordProgressionTemplate("minor-1451"),
      );
      const beforeRejectedToggle =
        result.current.enabledChordProgressionTemplateIds;
      act(() =>
        result.current.toggleChordProgressionTemplate("major-1451"),
      );

      expect(result.current.enabledChordProgressionTemplateIds).toBe(
        beforeRejectedToggle,
      );
    });
  });
});
