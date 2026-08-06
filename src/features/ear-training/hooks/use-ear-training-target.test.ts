import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEarTrainingTarget } from "./use-ear-training-target";

const options = { enabledDirections: new Set(["ascending"] as const), enabledIntervals: new Set(["major-third"] as const) };

describe("useEarTrainingTarget", () => {
  it("initializes with a stable ready target and locks once", () => {
    const { result } = renderHook(() => useEarTrainingTarget(options));
    const initial = result.current.target;
    expect(result.current.getCurrentTarget()).toBe(initial);
    expect(result.current.lockTarget()).toBe(true);
    expect(result.current.lockTarget()).toBe(false);
  });

  it("generates and unlocks the next target explicitly", () => {
    const { result } = renderHook(() => useEarTrainingTarget(options));
    act(() => { result.current.lockTarget(); result.current.generateNextTarget(); });
    expect(result.current.isTargetLocked()).toBe(false);
    expect(result.current.getCurrentTarget()).toBe(result.current.target);
  });
});
