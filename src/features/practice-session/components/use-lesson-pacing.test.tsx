import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLessonPacing } from "./use-lesson-pacing";
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("counts available foreground practice, excluding preparation, background and save waits", () => {
  vi.useFakeTimers(); let time = 0; const now = () => time;
  const { result, rerender } = renderHook(({ running }) => useLessonPacing(running, now), { initialProps: { running: false }, wrapper: StrictMode });
  const tick = (ms: number) => act(() => { time += ms; vi.advanceTimersByTime(ms); });
  tick(90000); expect(result.current.label).toBe("0:00");
  rerender({ running: true }); tick(60000); expect(result.current.label).toBe("1:00");
  rerender({ running: false }); tick(3600000); expect(result.current.label).toBe("1:00");
  rerender({ running: true }); tick(540000); expect(result.current).toMatchObject({ label: "10:00", plannedTimeReached: true });
  tick(20000); expect(result.current.label).toBe("10:20");
});
it("does not use local midnight or DST wall-clock changes for pacing", () => {
  vi.useFakeTimers(); let monotonic = 50; const now = () => monotonic;
  const { result } = renderHook(() => useLessonPacing(true, now));
  act(() => { vi.setSystemTime(new Date("2026-11-01T06:00:00Z")); monotonic += 1000; vi.advanceTimersByTime(1000); });
  expect(result.current.elapsedMs).toBe(1000);
  act(() => { vi.setSystemTime(new Date("2026-11-02T05:00:00Z")); monotonic += 1000; vi.advanceTimersByTime(1000); });
  expect(result.current.elapsedMs).toBe(2000);
});
