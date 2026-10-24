import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ContinuousInputDiagnostic } from "./continuous-input-diagnostic";
import { ContinuousResults } from "./continuous-workspace";
import { projectContinuousPassage } from "./continuous-projection";
import { assessContinuous } from "./continuous-assessment";
import { attack, testScore, TEST_DATE, TEST_INPUT } from "./continuous-test-fixtures";
import type { ContinuousAttempt } from "./continuous-types";
afterEach(cleanup);
const passage = projectContinuousPassage(testScore(), 0, 1, 60);
function attempt(attacks: ContinuousAttempt["attacks"] = []): ContinuousAttempt {
  return { version: 1, id: "saved", revision: 2, passage, input: TEST_INPUT, status: "completed", startedAt: TEST_DATE, endedAt: TEST_DATE,
    performanceStartedAt: TEST_DATE, observedThroughMs: passage.durationMs + passage.tailMs, reason: null, attacks,
    assessment: assessContinuous(passage, attacks), terminalSaveAttempts: 1 };
}
it("explains deliberately silent performances without changing native counts or historical evidence", () => {
  const record = attempt(), before = JSON.stringify(record); render(<ContinuousResults attempt={record} />);
  expect(screen.getByText("No MIDI note attacks were captured during this performance.")).toBeTruthy();
  expect(screen.getByText(/2 expected pitch attacks · 0 pitch matched · 0 wrong · 2 missing · 0 extra/)).toBeTruthy();
  expect(screen.getByText(/may reflect silence/)).toBeTruthy(); expect(JSON.stringify(record)).toBe(before);
});
it("does not call wrong or extra played attacks missing input", () => {
  render(<ContinuousInputDiagnostic attempt={attempt([attack(1, 99, 0)])} />); expect(screen.queryByRole("note")).toBeNull();
});
it("distinguishes a performance that never began from a silent performance", () => {
  render(<ContinuousInputDiagnostic attempt={{ ...attempt(), status: "stopped", performanceStartedAt: null }} />);
  expect(screen.queryByRole("note")).toBeNull();
});
