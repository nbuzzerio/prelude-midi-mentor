import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContinuousReadingView } from "./continuous-reading-view";
import { projectContinuousPassage } from "./continuous-projection";
import { testScore } from "./continuous-test-fixtures";

vi.mock("./continuous-score", () => ({ ContinuousScore: ({ measureIndex, reading }: { measureIndex: number; reading: { width: number } }) =>
  <svg data-testid={`music-${measureIndex}`} data-width={reading.width} /> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("two-slot A1 music stand", () => {
  it("reuses upcoming and prepared DOM without moving either at measure transitions", () => {
    const passage = projectContinuousPassage(testScore("4/4", 16), 0, 15, 40);
    const v = render(<ContinuousReadingView passage={passage} measureIndex={0} />);
    const upcoming = screen.getByTestId("music-1"), prepared = screen.getByTestId("music-2");
    const slot = upcoming.parentElement!, preparedSlot = prepared.parentElement!;
    const column = slot.style.gridColumn, preparedColumn = preparedSlot.style.gridColumn;
    expect(document.querySelectorAll(".continuous-reading-slot:not(.continuous-reading-prepared)")).toHaveLength(2);
    expect(preparedSlot.hasAttribute("inert")).toBe(true);
    v.rerender(<ContinuousReadingView passage={passage} measureIndex={1} offsetTicks={300} />);
    expect(screen.getByTestId("music-1")).toBe(upcoming); expect(slot.style.gridColumn).toBe(column);
    expect(screen.getByTestId("music-2")).toBe(prepared); expect(preparedSlot.style.gridColumn).toBe(preparedColumn);
    expect(preparedSlot.hasAttribute("inert")).toBe(false);
    expect(document.querySelectorAll("svg")).toHaveLength(3);
    v.rerender(<ContinuousReadingView passage={passage} measureIndex={15} />);
    expect(document.querySelectorAll("svg")).toHaveLength(1);
  });
  it("responds to width changes without changing the passage or measure identity", () => {
    let resize = () => {};
    vi.stubGlobal("ResizeObserver", class { constructor(cb: () => void) { resize = cb; } observe() {} disconnect() {} });
    const passage = projectContinuousPassage(testScore("4/4", 8), 0, 7, 60);
    render(<ContinuousReadingView passage={passage} measureIndex={3} offsetTicks={720} />);
    const svg = screen.getByTestId("music-3"), element = document.querySelector(".continuous-reading")!;
    Object.defineProperty(element, "clientWidth", { value: 375 }); act(resize);
    expect(element.getAttribute("data-columns")).toBe("1"); expect(screen.getByTestId("music-3")).toBe(svg);
    expect(passage).toMatchObject({ start: 0, end: 7, bpm: 60, durationMs: 32000 });
  });
});
