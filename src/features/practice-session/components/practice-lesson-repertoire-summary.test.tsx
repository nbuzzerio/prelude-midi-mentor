import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PracticeLessonRepertoireSummary } from "./practice-lesson-repertoire-summary";
import { createEntry } from "../../piece-practice/rolodex/rolodex-model";
import { testScore, TEST_INPUT, attack } from "../../piece-practice/continuous/continuous-test-fixtures";
import { assessContinuous } from "../../piece-practice/continuous/continuous-assessment";
import { freezeLessonRepertoire, type RepertoireEvidence } from "../practice-lesson-repertoire";
afterEach(cleanup);
const occurrence = freezeLessonRepertoire(createEntry(testScore(), "piano"));
const evidence: RepertoireEvidence = { occurrence, skipped: false, attempts: [], pending: false, dateFailed: 0, datePending: 0 };
it("distinguishes unperformed, skipped and pending without invented measurements", () => {
  const view = render(<PracticeLessonRepertoireSummary evidence={evidence} />);
  expect(screen.getByText("Not performed.")).toBeTruthy(); expect(screen.queryByText(/Expected attacks:/)).toBeNull();
  view.rerender(<PracticeLessonRepertoireSummary evidence={{ ...evidence, skipped: true }} />); expect(screen.getByText(/Deliberately skipped/)).toBeTruthy();
  view.rerender(<PracticeLessonRepertoireSummary evidence={{ ...evidence, pending: true }} />); expect(screen.getByText(/no acknowledged terminal result/)).toBeTruthy();
});
it("presents only native attack evidence with separate practice-date status", () => {
  const attempts = [{ version: 1 as const, id: "a1-test", revision: 2, passage: occurrence.passage, input: TEST_INPUT, status: "completed" as const, startedAt: "2026-10-20T12:00:00.000Z", endedAt: "2026-10-20T12:01:00.000Z", performanceStartedAt: "2026-10-20T12:00:04.000Z", observedThroughMs: 10000, reason: null, attacks: [attack(1, 60, 0)], assessment: assessContinuous(occurrence.passage, [attack(1, 60, 0)]), terminalSaveAttempts: 1 }];
  render(<PracticeLessonRepertoireSummary evidence={{ ...evidence, attempts, dateFailed: 1 }} />);
  expect(screen.getByText(/Expected attacks: 2 · Correct pitch: 1 · Missing: 1/)).toBeTruthy();
  expect(screen.getByText(/completed · A1 result saved locally/)).toBeTruthy();
  expect(screen.getByText(/practice-date\/progress update failed/)).toBeTruthy();
  expect(screen.getByText(/Physical MIDI · Test physical piano/)).toBeTruthy();
});
