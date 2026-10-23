import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "@/features/staff-builder/notation/render-staff-builder-measure";
import { projectStaffBuilderMeasure } from "@/features/staff-builder/notation/staff-builder-notation";
import { projectMelodyExerciseToPracticeDisplayScore } from "../melody-display-score";
import { generateMelodyExercise } from "../melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "../melody-types";
import { MelodyReadingMeasure } from "./melody-reading-measure";

vi.mock("@/features/staff-builder/notation/render-staff-builder-measure", () => ({ renderStaffBuilderMeasure: vi.fn() }));

const renderMeasure = vi.mocked(renderStaffBuilderMeasure);
let viewportWidth = 300;
let observers: Array<{ resize: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }>;

function fixture(staff: "treble" | "bass" = "treble") {
  const exercise = generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, staff, keyId: "d-minor", measureCount: 2 }, "readonly-row");
  return { exercise, score: projectMelodyExerciseToPracticeDisplayScore(exercise) };
}

function renderFixture(...[container, score, measureIndex, options]: Parameters<typeof renderStaffBuilderMeasure>): StaffBuilderMeasureRenderResult {
  const projection = projectStaffBuilderMeasure(score, measureIndex);
  const width = Math.max(400, options?.readingFlowWidth ?? 400);
  const events = score.measures[measureIndex]!.events.filter(({ staff }) => staff === options?.visibleStaff);
  const authoritativeEvents = new Map(events.map((event, index) => {
    const onsetX = 100 + index * 35 + index * index * 3;
    return [event.id, { eventId: event.id, staff: event.staff, startTick: event.startTick, onsetX, x: onsetX - 7, y: 40, width: 14, height: 40 }];
  }));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} 149`);
  svg.setAttribute("data-rendered-measure", score.measures[measureIndex]!.id);
  container.replaceChildren(svg);
  const control = { x: 8, y: 20, width: 20, height: 80 };
  return {
    width, height: 149, coordinateSpace: { width, height: 149 }, projection,
    anchors: {
      events: authoritativeEvents, authoritativeEvents, pitches: new Map(), positions: new Map(),
      timeline: { rhythmicStartX: 60, rhythmicEndX: width - 12, y: 20, height: 100, capacityTicks: projection.capacityTicks },
      notationControls: { trebleClef: control, grandStaff: control, bassClef: control, keySignature: control, timeSignature: control },
    },
  };
}

beforeEach(() => {
  viewportWidth = 300;
  observers = [];
  renderMeasure.mockReset().mockImplementation(renderFixture);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => viewportWidth);
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: ResizeObserverCallback) {
      observers.push({ observe: this.observe, disconnect: this.disconnect, resize: () => callback([], this as unknown as ResizeObserver) });
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readonly Melody measure", () => {
  it.each(["treble", "bass"] as const)("anchors three stationary %s preparation pulses to the real opening and retains the SVG into performance", staff => {
    const { score } = fixture(staff);
    const props = { score, measureIndex: 1, measureCount: 2 as const, staff, expanded: false, role: "current" as const };
    const view = render(<MelodyReadingMeasure {...props} />);
    const svg = view.container.querySelector("svg");
    const count = renderMeasure.mock.calls.length;
    for (const [tick, number] of [[0, 3], [480, 2], [960, 1]]) {
      view.rerender(<MelodyReadingMeasure {...props} preparationTick={tick} />);
      const marker = view.container.querySelector<HTMLElement>(".melody-reading-cursor");
      expect(marker?.dataset.cursorX).toBe("100");
      expect(marker?.dataset.preparing).toBe("true");
      expect(marker?.dataset.pulsing).toBe("true");
      expect(screen.getByRole("status", { name: `Count in: ${number}` }).textContent).toBe(String(number));
      expect(view.container.querySelector("svg")).toBe(svg);
    }
    view.rerender(<MelodyReadingMeasure {...props} offsetTicks={0} />);
    expect(view.container.querySelector<HTMLElement>(".melody-reading-cursor")?.dataset.cursorX).toBe("100");
    expect(screen.queryByRole("status")).toBeNull();
    expect(renderMeasure).toHaveBeenCalledTimes(count);
  });
  it.each(["treble", "bass"] as const)("keeps the %s SVG and score unchanged while the cursor and row role advance", staff => {
    const { score } = fixture(staff);
    const before = structuredClone(score);
    const props = { score, measureIndex: 1, measureCount: 2 as const, staff, expanded: false };
    const view = render(<MelodyReadingMeasure {...props} role="upcoming" />);
    const svg = view.container.querySelector("svg");
    const initialRenderCount = renderMeasure.mock.calls.length;
    expect(svg).not.toBeNull();
    expect(screen.getByText("Coming next")).toBeTruthy();
    expect(view.container.querySelector(".melody-reading-cursor")).toBeNull();

    view.rerender(<MelodyReadingMeasure {...props} role="current" offsetTicks={0} />);
    expect(screen.getByText("Current")).toBeTruthy();
    expect(view.container.querySelector<HTMLElement>(".melody-reading-cursor")?.dataset.cursorX).toBe("100");
    const secondTick = score.measures[1]!.events[1]!.startTick;
    view.rerender(<MelodyReadingMeasure {...props} role="current" offsetTicks={secondTick / 2} />);
    expect(view.container.querySelector<HTMLElement>(".melody-reading-cursor")?.dataset.cursorX).toBe("119");
    view.rerender(<MelodyReadingMeasure {...props} role="current" offsetTicks={secondTick} />);
    expect(view.container.querySelector<HTMLElement>(".melody-reading-cursor")?.dataset.cursorX).toBe("138");

    view.rerender(<MelodyReadingMeasure {...props} role="completed" />);
    expect(screen.getByText("Played")).toBeTruthy();
    expect(view.container.querySelector(".melody-reading-cursor")).toBeNull();
    expect(view.container.querySelector("svg")).toBe(svg);
    expect(renderMeasure).toHaveBeenCalledTimes(initialRenderCount);
    expect(score).toEqual(before);
  });

  it("clamps the cursor to its authored beginning and ending without moving the opening view", () => {
    const { score } = fixture();
    const props = { score, measureIndex: 1, measureCount: 2 as const, staff: "treble" as const, expanded: false, role: "current" as const };
    const view = render(<MelodyReadingMeasure {...props} />);
    const region = screen.getByRole("region", { name: "Measure 1 notation" });
    expect(region.scrollLeft).toBe(0);
    view.rerender(<MelodyReadingMeasure {...props} offsetTicks={-120} />);
    expect(view.container.querySelector<HTMLElement>(".melody-reading-cursor")?.dataset.cursorX).toBe("100");
    expect(region.scrollLeft).toBe(0);
    view.rerender(<MelodyReadingMeasure {...props} offsetTicks={5000} />);
    expect(view.container.querySelector<HTMLElement>(".melody-reading-cursor")?.dataset.cursorX).toBe("388");
    expect(region.scrollLeft).toBeCloseTo(260);
    view.rerender(<MelodyReadingMeasure {...props} offsetTicks={Number.NaN} />);
    expect(view.container.querySelector(".melody-reading-cursor")).toBeNull();
  });

  it("gives each keyboard-accessible row its own stable authored-measure and musical description", () => {
    const { score } = fixture("bass");
    const props = { score, measureCount: 2 as const, staff: "bass" as const, expanded: false };
    const rows = (secondActive = false) => <>
      <MelodyReadingMeasure {...props} measureIndex={1} role={secondActive ? "completed" : "current"} />
      <MelodyReadingMeasure {...props} measureIndex={2} role={secondActive ? "current" : "upcoming"} />
    </>;
    const view = render(rows());
    expect(screen.getByText("Measure 1 of 2")).toBeTruthy();
    expect(screen.getByText("Measure 2 of 2")).toBeTruthy();
    expect(screen.queryByText("Measure 3 of 3")).toBeNull();
    const regions = screen.getAllByRole("region");
    const descriptionIds = regions.map(region => region.getAttribute("aria-describedby"));
    expect(new Set(descriptionIds).size).toBe(2);
    for (const region of regions) {
      expect(region.tabIndex).toBe(0);
      const description = document.getElementById(region.getAttribute("aria-describedby")!);
      expect(description?.textContent).toContain("Bass clef.");
      expect(description?.textContent).toContain("D minor");
      expect(description?.textContent).toContain("4/4");
      expect(description?.textContent).toContain("note");
    }
    const ids = [...view.container.querySelectorAll("[id]")].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(view.container.querySelector("[aria-live]")).toBeNull();
    expect(view.container.querySelector("button")).toBeNull();
    view.rerender(rows(true));
    expect(screen.getAllByRole("region").map(region => region.getAttribute("aria-describedby"))).toEqual(descriptionIds);
  });

  it("reformats only when measured width changes and disconnects its observer on unmount", () => {
    const { score } = fixture();
    const view = render(<MelodyReadingMeasure score={score} measureIndex={1} measureCount={2} staff="treble" role="current" offsetTicks={1920} expanded={false} />);
    const region = screen.getByRole("region", { name: "Measure 1 notation" });
    const firstSvg = view.container.querySelector("svg");
    const initialRenderCount = renderMeasure.mock.calls.length;
    expect(observers).toHaveLength(1);
    expect(observers[0]!.observe).toHaveBeenCalledWith(region);
    act(() => observers[0]!.resize());
    expect(renderMeasure).toHaveBeenCalledTimes(initialRenderCount);

    viewportWidth = 800;
    act(() => observers[0]!.resize());
    expect(renderMeasure).toHaveBeenCalledTimes(initialRenderCount + 1);
    expect(renderMeasure.mock.lastCall?.[3]).toMatchObject({ readingFlowWidth: 444, readingFlowCompact: true, visibleStaff: "treble" });
    expect(view.container.querySelector("svg")).not.toBe(firstSvg);
    expect(view.container.querySelector<HTMLElement>(".melody-reading-presentation")?.dataset.readingScale).toBe("1.8");
    expect(region.scrollLeft).toBe(0);
    view.unmount();
    expect(observers[0]!.disconnect).toHaveBeenCalledOnce();
  });
});
