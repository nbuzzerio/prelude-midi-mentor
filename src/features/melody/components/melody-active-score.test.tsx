import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { MelodyActiveScore } from "./melody-active-score";
import type { MelodyReadingMeasure } from "./melody-reading-measure";
import { projectMelodyExerciseToPracticeDisplayScore } from "../melody-display-score";
import { generateMelodyExercise } from "../melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "../melody-types";

const observed = vi.hoisted(() => ({ props: vi.fn() }));
vi.mock("./melody-reading-measure", () => ({ MelodyReadingMeasure: (props: ComponentProps<typeof MelodyReadingMeasure>) => {
  observed.props(props);
  return <figure data-testid="reading-row" data-measure-index={props.measureIndex} data-measure-role={props.role} data-offset={props.offsetTicks}>
    {JSON.stringify(props.score.measures[props.measureIndex])}
  </figure>;
} }));

afterEach(() => { cleanup(); observed.props.mockClear(); });

describe("fixed Reading Flow measure rows", () => {
  it.each([1, 2] as const)("mounts exactly the %d authored measures before playing without altering canonical music", measureCount => {
    const exercise = generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, staff: "bass", keyId: "d-minor", measureCount }, "window");
    const score = projectMelodyExerciseToPracticeDisplayScore(exercise);
    const beforeScore = structuredClone(score), beforeExercise = structuredClone(exercise);
    const props = { score, measureCount, staff: "bass" as const, expanded: false };
    const view = render(<MelodyActiveScore {...props} displayMeasureIndex={null} />);
    const rows = screen.getAllByTestId("reading-row");
    expect(rows).toHaveLength(measureCount);
    for (let index = 0; index < measureCount; index++) {
      expect(rows[index]!.getAttribute("data-measure-index")).toBe(String(index + 1));
      expect(rows[index]!.textContent).toBe(JSON.stringify(score.measures[index + 1]));
      expect(rows[index]!.hasAttribute("data-offset")).toBe(false);
    }
    expect(view.container.querySelector('[data-measure-index="0"]')).toBeNull();
    view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={0} activeTick={-480} measureTick={480} />);
    for (let index = 1; index <= measureCount; index++) {
      view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={index} activeTick={(index - 1) * 1920 + 480} measureTick={480} />);
      screen.getAllByTestId("reading-row").forEach((row, rowIndex) => expect(row).toBe(rows[rowIndex]));
    }
    for (const [renderedProps] of observed.props.mock.calls) {
      expect(renderedProps.score).toBe(score);
      expect(renderedProps.staff).toBe("bass");
    }
    expect(score).toEqual(beforeScore);
    expect(exercise).toEqual(beforeExercise);
  });

  it("activates the already mounted preview in place and leaves the completed row visible", () => {
    const exercise = generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount: 2 }, "handoff");
    const score = projectMelodyExerciseToPracticeDisplayScore(exercise);
    const props = { score, measureCount: 2 as const, staff: "treble" as const, expanded: false };
    const view = render(<MelodyActiveScore {...props} displayMeasureIndex={1} activeTick={1919} measureTick={1919} />);
    const [first, second] = screen.getAllByTestId("reading-row");
    expect(first!.getAttribute("data-measure-role")).toBe("current");
    expect(first!.getAttribute("data-offset")).toBe("1919");
    expect(second!.getAttribute("data-measure-role")).toBe("upcoming");
    expect(second!.hasAttribute("data-offset")).toBe(false);
    expect(screen.getByText("The next measure is visible below.")).toBeTruthy();

    view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={2} activeTick={1920} measureTick={0} />);
    expect(screen.getAllByTestId("reading-row")[0]).toBe(first);
    expect(screen.getAllByTestId("reading-row")[1]).toBe(second);
    expect(first!.getAttribute("data-measure-role")).toBe("completed");
    expect(first!.hasAttribute("data-offset")).toBe(false);
    expect(second!.getAttribute("data-measure-role")).toBe("current");
    expect(second!.getAttribute("data-offset")).toBe("0");
    expect(second!.textContent).toBe(JSON.stringify(score.measures[2]));
    expect(screen.getByText("End of phrase after this measure.")).toBeTruthy();
  });

  it("withholds every row's playback tick in Ready and count-in even when preparation has a tick", () => {
    const score = projectMelodyExerciseToPracticeDisplayScore(generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount: 2 }, "prepare"));
    const props = { score, measureCount: 2 as const, staff: "treble" as const, expanded: true };
    const view = render(<MelodyActiveScore {...props} displayMeasureIndex={null} measureTick={480} />);
    const rows = screen.getAllByTestId("reading-row");
    expect(rows.every(row => !row.hasAttribute("data-offset"))).toBe(true);
    view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={0} activeTick={-480} measureTick={480} />);
    screen.getAllByTestId("reading-row").forEach((row, index) => expect(row).toBe(rows[index]));
    expect(rows.every(row => !row.hasAttribute("data-offset"))).toBe(true);
    expect(screen.getByLabelText("Preparatory lead-in").textContent).toBe("321");
    expect(view.container.querySelector('[aria-current="true"]')?.textContent).toBe("1");
  });

  it("keeps one count guide following native absolute ticks while both measures remain visible", () => {
    const score = projectMelodyExerciseToPracticeDisplayScore(generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount: 2 }, "count"));
    const props = { score, measureCount: 2 as const, staff: "treble" as const, expanded: false };
    const view = render(<MelodyActiveScore {...props} displayMeasureIndex={0} activeTick={-480} />);
    expect(screen.getAllByLabelText("Preparatory lead-in and count guide")).toHaveLength(1);
    expect(view.container.querySelectorAll("[data-tick]")).toHaveLength(0);
    for (const measureIndex of [1, 2]) {
      view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={measureIndex} activeTick={(measureIndex - 1) * 1920 + 480} measureTick={480} />);
      expect(screen.getAllByLabelText("Count guide")).toHaveLength(1);
      expect(screen.queryByLabelText("Preparatory lead-in")).toBeNull();
      expect(screen.getAllByTestId("reading-row")).toHaveLength(2);
      expect([...view.container.querySelectorAll("[data-tick]")].map(token => Number(token.getAttribute("data-tick"))))
        .toEqual(Array.from({ length: 8 }, (_, index) => (measureIndex - 1) * 1920 + index * 240));
      expect(view.container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
      expect(view.container.querySelector('[aria-current="true"]')?.textContent).toBe("2");
    }
  });

  it("passes keyboard-layout changes to the same authored rows without making another trial", () => {
    const exercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "one-measure");
    const score = projectMelodyExerciseToPracticeDisplayScore(exercise);
    const props = { score, measureCount: 1 as const, staff: "treble" as const, displayMeasureIndex: 1, activeTick: 480, measureTick: 480 };
    const view = render(<MelodyActiveScore {...props} expanded={false} />);
    const row = screen.getByTestId("reading-row");
    expect(screen.getByText("End of phrase after this measure.")).toBeTruthy();
    expect(screen.queryByText("The next measure is visible below.")).toBeNull();
    view.rerender(<MelodyActiveScore {...props} expanded />);
    expect(screen.getByTestId("reading-row")).toBe(row);
    expect(observed.props.mock.lastCall?.[0]).toMatchObject({ measureIndex: 1, measureCount: 1, expanded: true, role: "current", offsetTicks: 480 });
    expect(observed.props.mock.lastCall?.[0].score).toBe(score);
  });
});
