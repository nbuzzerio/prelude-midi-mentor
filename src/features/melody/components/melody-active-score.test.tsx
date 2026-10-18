import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MelodyActiveScore } from "./melody-active-score";
import { projectMelodyExerciseToPracticeDisplayScore } from "../melody-display-score";
import { generateMelodyExercise } from "../melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "../melody-types";
const observed = vi.hoisted(() => ({ props: vi.fn() }));
vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({ StaffBuilderScoreView: (props: { score: { measures: { events: unknown[] }[] }; measureIndex: number }) => { observed.props(props); return <div data-testid="score">{JSON.stringify(props.score.measures[props.measureIndex])}</div>; } }));
afterEach(() => { cleanup(); observed.props.mockClear(); });
describe("one active Reading Flow measure", () => {
  it.each([1, 2] as const)("shows the original %d-measure score one measure at a time without altering any events", measureCount => {
    const exercise = generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, staff: "bass", keyId: "d-minor", measureCount }, "window");
    const score = projectMelodyExerciseToPracticeDisplayScore(exercise), before = structuredClone(score);
    const props = { score, measureCount, staff: "bass" as const, expanded: false };
    const view = render(<MelodyActiveScore {...props} displayMeasureIndex={null} />);
    expect(screen.getByText(`Measure 1 of ${measureCount}`)).toBeTruthy();
    view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={0} activeTick={-480} measureTick={480} />);
    expect(screen.getByText("Lead-in · Preparatory rests")).toBeTruthy(); expect(screen.getByLabelText("Preparatory lead-in")).toHaveProperty("textContent", "12");
    expect(observed.props.mock.lastCall?.[0]).toMatchObject({ measureIndex: 0, playbackPosition: { offsetTicks: 480 }, readingFlow: "normal" });
    for (let index = 1; index <= measureCount; index++) {
      view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={index} activeTick={(index - 1) * 1920 + 480} measureTick={480} />);
      expect(screen.getAllByTestId("score")).toHaveLength(1); expect(screen.getByTestId("score").textContent).toBe(JSON.stringify(score.measures[index]));
      expect(screen.queryByLabelText("Preparatory lead-in")).toBeNull();
      expect(view.container.querySelector('[aria-current="true"]')?.textContent).toBe("2");
      expect(observed.props.mock.lastCall?.[0].score).toBe(score);
    }
    view.rerender(<MelodyActiveScore {...props} displayMeasureIndex={measureCount} expanded />);
    expect(observed.props.mock.lastCall?.[0]).toMatchObject({ measureIndex: measureCount, readingFlow: "expanded", score });
    expect(score).toEqual(before); expect(exercise.expectedAttacks).toHaveLength(before.measures.slice(1).flatMap(m => m.events).length);
  });
});
