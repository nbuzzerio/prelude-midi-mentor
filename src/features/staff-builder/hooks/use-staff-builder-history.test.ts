import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { useStaffBuilderHistory } from "./use-staff-builder-history";

const score = (title: string): StaffBuilderScoreV1 => ({ schemaVersion: 1, id: "score", title, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: `2026-01-01T00:00:0${title.length}.000Z`, tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [] }], ties: [] });

describe("useStaffBuilderHistory", () => {
  it("records score snapshots, undoes, redoes, and clears redo after a new mutation", () => {
    const { result } = renderHook(() => useStaffBuilderHistory());
    act(() => result.current.record(score("a")));
    expect(result.current.canUndo).toBe(true);
    const restored: { value: StaffBuilderScoreV1 | null } = { value: null };
    act(() => { restored.value = result.current.undo(score("bb")); });
    expect(restored.value?.title).toBe("a");
    expect(result.current.canRedo).toBe(true);
    act(() => { restored.value = result.current.redo(score("a")); });
    expect(restored.value?.title).toBe("bb");
    act(() => result.current.undo(score("bb")));
    act(() => result.current.record(score("a")));
    expect(result.current.canRedo).toBe(false);
  });

  it("bounds history to the configured operation count", () => {
    const { result } = renderHook(() => useStaffBuilderHistory(2));
    act(() => { result.current.record(score("a")); result.current.record(score("bb")); result.current.record(score("ccc")); });
    let current = score("dddd");
    act(() => { current = result.current.undo(current) ?? current; });
    expect(current.title).toBe("ccc");
    act(() => { current = result.current.undo(current) ?? current; });
    expect(current.title).toBe("bb");
    expect(result.current.canUndo).toBe(false);
  });
});
