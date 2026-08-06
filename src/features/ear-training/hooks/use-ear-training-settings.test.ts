import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEarTrainingSettings } from "./use-ear-training-settings";

describe("useEarTrainingSettings", () => {
  it("uses beginner interval and ascending defaults", () => {
    const { result } = renderHook(() => useEarTrainingSettings());
    expect([...result.current.enabledIntervals]).toEqual(["minor-second", "major-second", "minor-third", "major-third"]);
    expect([...result.current.enabledDirections]).toEqual(["ascending"]);
  });

  it("keeps at least one interval and direction enabled", () => {
    const { result } = renderHook(() => useEarTrainingSettings());
    for (const interval of ["major-second", "minor-third", "major-third", "minor-second"] as const) {
      act(() => result.current.toggleInterval(interval));
    }
    act(() => result.current.toggleDirection("ascending"));
    expect(result.current.enabledIntervals).toEqual(new Set(["minor-second"]));
    expect(result.current.enabledDirections).toEqual(new Set(["ascending"]));
  });

  it("allows descending direction", () => {
    const { result } = renderHook(() => useEarTrainingSettings());
    act(() => result.current.toggleDirection("descending"));
    expect(result.current.enabledDirections).toEqual(new Set(["ascending", "descending"]));
  });
});
