import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStaffBuilderMobilePresentation } from "./use-staff-builder-mobile-presentation";

afterEach(() => vi.unstubAllGlobals());

describe("useStaffBuilderMobilePresentation", () => {
  it("falls back to desktop when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(renderHook(() => useStaffBuilderMobilePresentation()).result.current).toBe(false);
  });

  it("tracks responsive presentation changes", () => {
    let matches = true;
    let listener: (() => void) | undefined;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return matches; }, media: "", onchange: null, addEventListener: (_type: string, next: () => void) => { listener = next; }, removeEventListener: vi.fn(), dispatchEvent: vi.fn() })));
    const { result } = renderHook(() => useStaffBuilderMobilePresentation());
    expect(result.current).toBe(true);
    act(() => { matches = false; listener?.(); });
    expect(result.current).toBe(false);
  });
});
