import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { evaluateMelodyAttempt, type MelodyAttemptResult } from "../melody-scoring";
import { generateMelodyExercise } from "../melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "../melody-types";
import { MelodyResultDetail, MelodyResultMetrics } from "./melody-result-detail";
import { MelodyResults } from "./melody-results";

vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({
  StaffBuilderScoreView: ({ eventHighlights, measureIndex }: Readonly<{
    eventHighlights: readonly unknown[];
    measureIndex: number;
  }>) => <div data-highlight-count={eventHighlights.length}>Score measure {measureIndex + 1}</div>,
}));

const exercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "result-detail-test");
const detailedResult = evaluateMelodyAttempt(exercise, [{
  id: "late-extra",
  midiNumber: 72,
  source: "midi",
  audioTimeSeconds: 100,
  relativeTimeMs: 100_000,
  sequenceIndex: 0,
}]);

const metricResult = {
  ...detailedResult,
  pitchScorePercent: 67,
  movementScorePercent: null,
  timingScorePercent: 74,
} satisfies MelodyAttemptResult;

afterEach(cleanup);

describe("Melody reusable result presentation", () => {
  it("renders Pitch, Movement, and Timing metrics", () => {
    render(<MelodyResultMetrics result={metricResult} />);
    expect(screen.getByRole("heading", { level: 3, name: "Pitch" }).nextElementSibling?.textContent).toBe("67%");
    expect(screen.getByRole("heading", { level: 3, name: "Movement" }).nextElementSibling?.textContent).toBe("Not enough notes");
    expect(screen.getByRole("heading", { level: 3, name: "Timing" }).nextElementSibling?.textContent).toBe("74%");
  });

  it("supports subordinate metric headings for embedded result sections", () => {
    render(<MelodyResultMetrics headingLevel={5} result={metricResult} />);
    expect(screen.getByRole("heading", { level: 5, name: "Pitch" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 5, name: "Movement" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 5, name: "Timing" })).toBeTruthy();
  });

  it("renders one highlighted score, attack details, and missed/extra counts", () => {
    render(<MelodyResultDetail exercise={exercise} result={detailedResult} />);
    expect(screen.getAllByText("Score measure 1")).toHaveLength(1);
    expect(screen.getByLabelText("Melody pitch result score").tabIndex).toBe(0);
    expect(screen.getByLabelText("Pitch result details").children).toHaveLength(exercise.expectedAttacks.length);
    expect(screen.getByText(`Missed: ${exercise.expectedAttacks.length} · Extra: 1`)).toBeTruthy();
  });

  it("uses unique labelled-section IDs when details coexist", () => {
    const { container } = render(<>
      <MelodyResultDetail exercise={exercise} result={detailedResult} />
      <MelodyResultDetail exercise={exercise} result={detailedResult} />
    </>);
    const sections = [...container.querySelectorAll("section[aria-labelledby]")];
    const labelledBy = sections.map((section) => section.getAttribute("aria-labelledby"));
    expect(new Set(labelledBy).size).toBe(2);
    for (const id of labelledBy) {
      expect(id).toBeTruthy();
      expect(container.querySelector(`[id="${id}"]`)?.textContent).toBe("Pitch results on the staff");
    }
  });
});

describe("MelodyResults workflow wrapper", () => {
  it("preserves singular normal result actions and one result staff", () => {
    const retry = vi.fn();
    const another = vi.fn();
    const settings = vi.fn();
    render(<MelodyResults
      exercise={exercise}
      onRetrySame={retry}
      onSettings={settings}
      onTryAnother={another}
      result={detailedResult}
    />);
    expect(screen.getAllByLabelText("Melody pitch result score")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(another).toHaveBeenCalledOnce();
    expect(settings).toHaveBeenCalledOnce();
  });

  it("preserves timed diagnostic action behavior when Retry Same is hidden", () => {
    render(<MelodyResults
      continuousProgress="Diagnostic trial 1 complete · Time remaining: 0:30"
      exercise={exercise}
      onRetrySame={vi.fn()}
      onSettings={vi.fn()}
      onTryAnother={vi.fn()}
      result={detailedResult}
      showRetrySame={false}
    />);
    expect(screen.queryByRole("button", { name: "Retry Same" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Try Another" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Settings" })).toHaveLength(1);
    expect(screen.getByText(/Time remaining: 0:30/)).toBeTruthy();
  });
});
