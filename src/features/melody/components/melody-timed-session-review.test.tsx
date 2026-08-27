import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendMelodyContinuousTrialRetry,
  createMelodyContinuousDiagnosticTrial,
} from "../melody-continuous-practice";
import { generateMelodyExercise } from "../melody-generator";
import type { MelodyPerformedAttack } from "../melody-performance";
import { evaluateMelodyAttempt } from "../melody-scoring";
import { getMelodyTimedExpectedAttacks } from "../melody-timing";
import { DEFAULT_MELODY_SETTINGS } from "../melody-types";
import {
  MelodyTimedSessionReview,
  type MelodyReviewFilter,
  type MelodyReviewResultView,
} from "./melody-timed-session-review";

vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({
  StaffBuilderScoreView: ({ measureIndex }: Readonly<{ measureIndex: number }>) =>
    <div>Score measure {measureIndex + 1}</div>,
}));

afterEach(cleanup);

const exercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "review-test");

function result(perfect: boolean) {
  const performed: MelodyPerformedAttack[] = perfect
    ? getMelodyTimedExpectedAttacks(exercise).map((attack, index) => ({
      id: `performed-${index}`,
      midiNumber: attack.midiNumber,
      source: "midi",
      audioTimeSeconds: attack.expectedTimeSeconds,
      relativeTimeMs: attack.expectedTimeMs,
      sequenceIndex: index,
    }))
    : [];
  return evaluateMelodyAttempt(exercise, performed);
}

const perfectResult = result(true);
const failedResult = result(false);
const firstWeak = createMelodyContinuousDiagnosticTrial(1, exercise, failedResult);
const secondPerfect = createMelodyContinuousDiagnosticTrial(2, exercise, perfectResult);
const thirdWeak = createMelodyContinuousDiagnosticTrial(3, exercise, failedResult);

function renderReview(options: Partial<Readonly<{
  filter: MelodyReviewFilter;
  interrupted: boolean;
  pinnedTrialId: string | null;
  resultView: MelodyReviewResultView;
  selectedTrialId: string | null;
  trials: readonly typeof firstWeak[];
}>> = {}) {
  const callbacks = {
    onFilterChange: vi.fn(),
    onNewTimedSession: vi.fn(),
    onNextNeedsReview: vi.fn(),
    onResultViewChange: vi.fn(),
    onRetryTrial: vi.fn(),
    onReviewMistakes: vi.fn(),
    onSelectTrial: vi.fn(),
    onSettings: vi.fn(),
  };
  render(<MelodyTimedSessionReview
    durationMinutes={1}
    filter={options.filter ?? "all"}
    interrupted={options.interrupted ?? false}
    pinnedTrialId={options.pinnedTrialId ?? null}
    resultView={options.resultView ?? "original"}
    selectedTrialId={options.selectedTrialId === undefined ? firstWeak.id : options.selectedTrialId}
    trials={options.trials ?? [firstWeak, secondPerfect, thirdWeak]}
    {...callbacks}
  />);
  return callbacks;
}

describe("MelodyTimedSessionReview", () => {
  it("renders completion heading, original overview metrics, and trial identity", () => {
    renderReview();
    expect(screen.getByRole("heading", { name: "Timed Melody Session Review" })).toBeTruthy();
    expect(screen.getByText("Diagnostic trial 1 of 3")).toBeTruthy();
    expect(screen.getByText("Needs Review", { selector: "p" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Original Pitch average" }).nextElementSibling?.textContent).toBe("33%");
    expect(screen.getByRole("heading", { name: "Currently mastered" }).nextElementSibling?.textContent).toBe("1");
    expect(screen.getAllByLabelText("Melody pitch result score")).toHaveLength(1);
  });

  it("renders interrupted history and a safe zero-trial empty state", () => {
    renderReview({ interrupted: true, selectedTrialId: null, trials: [] });
    expect(screen.getByRole("heading", { name: "Session interrupted" })).toBeTruthy();
    expect(screen.getByText(/Completed trials were preserved/)).toBeTruthy();
    expect(screen.getByText("No diagnostic trials were completed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous trial" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry This Melody" })).toBeNull();
    expect(screen.getByRole("button", { name: "New Timed Session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });

  it("exposes filters, Review mistakes, and non-wrapping navigation boundaries", () => {
    const callbacks = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Needs Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Review mistakes" }));
    expect(callbacks.onFilterChange).toHaveBeenCalledWith("needs-review");
    expect(callbacks.onReviewMistakes).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Previous trial" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next trial" }));
    expect(callbacks.onSelectTrial).toHaveBeenCalledWith(secondPerfect.id);
  });

  it("navigates only weak candidates and keeps a newly mastered pinned trial visible", () => {
    const masteredFirst = appendMelodyContinuousTrialRetry(
      [firstWeak], firstWeak.id, perfectResult,
    )[0]!;
    const callbacks = renderReview({
      filter: "needs-review",
      pinnedTrialId: masteredFirst.id,
      selectedTrialId: masteredFirst.id,
      trials: [masteredFirst, secondPerfect, thirdWeak],
    });
    expect(screen.getByText("Mastered", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(/Repair complete/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous trial" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next trial" }));
    expect(callbacks.onSelectTrial).toHaveBeenCalledWith(thirdWeak.id);
  });

  it("keeps original diagnostic numbering while filtering Needs Review", () => {
    const callbacks = renderReview({
      filter: "needs-review",
      selectedTrialId: thirdWeak.id,
    });
    expect(screen.getByText("Diagnostic trial 3 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous trial" }));
    expect(callbacks.onSelectTrial).toHaveBeenCalledWith(firstWeak.id);
  });

  it("compares Original and Latest, switches detail, and lists compact retry history", () => {
    const retried = appendMelodyContinuousTrialRetry(
      appendMelodyContinuousTrialRetry([firstWeak], firstWeak.id, failedResult),
      firstWeak.id,
      perfectResult,
    )[0]!;
    const callbacks = renderReview({ selectedTrialId: retried.id, trials: [retried] });
    expect(screen.getByRole("heading", { level: 4, name: "Original Sight Read" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "Latest Retry" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 5, name: /Pitch|Movement|Timing/ })).toHaveLength(6);
    expect(screen.getByText("Original + 2 retries")).toBeTruthy();
    expect(screen.getByText(/Retry 1 — Pitch 0%/)).toBeTruthy();
    expect(screen.getByText(/Retry 2 — Pitch 100%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Latest" }));
    expect(callbacks.onResultViewChange).toHaveBeenCalledWith("latest");
    expect(screen.getAllByLabelText("Melody pitch result score")).toHaveLength(1);
  });

  it("routes retry and next-needs-review actions by stable trial ID", () => {
    const callbacks = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Retry This Melody" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Needs Review" }));
    expect(callbacks.onRetryTrial).toHaveBeenCalledWith(firstWeak.id);
    expect(callbacks.onNextNeedsReview).toHaveBeenCalledWith(firstWeak.id);
  });

  it("shows all-mastered state while retaining browsing and retry actions", () => {
    renderReview({ selectedTrialId: secondPerfect.id, trials: [secondPerfect] });
    expect(screen.getByText("All diagnostic trials mastered")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review mistakes" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retry This Melody" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next Needs Review" }).hasAttribute("disabled")).toBe(true);
  });

  it("places primary Sight Read interval analytics between overview and trial review", () => {
    const callbacks = renderReview({ trials: [firstWeak] });
    const overview = screen.getByRole("heading", { level: 3, name: "Session overview" }).closest("section")!;
    const intervalTrouble = screen.getByRole("heading", { level: 3, name: "Interval Trouble" }).closest("section")!;
    const trialReview = screen.getByText("Diagnostic trial 1 of 1").closest("section")!;
    expect(overview.compareDocumentPosition(intervalTrouble) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(intervalTrouble.compareDocumentPosition(trialReview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "Sight Read" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 5, name: "Needs Attention" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Repair" })).toBeNull();
    const intervalRow = intervalTrouble.querySelector("li[aria-label]")!;
    expect(intervalRow.getAttribute("aria-label")).toMatch(/(Ascending|Descending|Repeated pitch).+error.+opportunit.+percent error rate/i);
    fireEvent.click(intervalRow);
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText("Melody pitch result score")).toHaveLength(1);
  });

  it("keeps Sight Read errors after successful repair and counts every retry opportunity", () => {
    const retried = appendMelodyContinuousTrialRetry(
      appendMelodyContinuousTrialRetry([firstWeak], firstWeak.id, failedResult),
      firstWeak.id,
      perfectResult,
    )[0]!;
    renderReview({ selectedTrialId: retried.id, trials: [retried] });
    const sightRead = screen.getByRole("heading", { level: 4, name: "Sight Read" }).closest("section")!;
    const repair = screen.getByRole("heading", { level: 4, name: "Repair" }).closest("section")!;
    expect(within(sightRead).getAllByLabelText(/1 error out of 1 opportunities. 100 percent error rate/i).length).toBeGreaterThan(0);
    expect(within(repair).getAllByLabelText(/1 error out of 2 retry opportunities. 50 percent error rate/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Original + 2 retries")).toBeTruthy();
  });

  it("shows no-error messages and compact Strong disclosures", () => {
    const repairedPerfectly = appendMelodyContinuousTrialRetry(
      [secondPerfect], secondPerfect.id, perfectResult,
    )[0]!;
    renderReview({ selectedTrialId: repairedPerfectly.id, trials: [repairedPerfectly] });
    expect(screen.getByText("No sight-read interval errors.")).toBeTruthy();
    expect(screen.getByText("No repair interval errors.")).toBeTruthy();
    expect(screen.getByText("Strong Sight Read intervals")).toBeTruthy();
    expect(screen.getByText("Strong Repair intervals")).toBeTruthy();
  });

  it("limits initial attention to three rows and discloses the remainder", () => {
    const variedTrials = Array.from({ length: 20 }, (_, index) => {
      const variedExercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, `interval-review-${index}`);
      return createMelodyContinuousDiagnosticTrial(
        index + 1,
        variedExercise,
        evaluateMelodyAttempt(variedExercise, []),
      );
    });
    renderReview({ selectedTrialId: variedTrials[0]!.id, trials: variedTrials });
    const sightRead = screen.getByRole("heading", { level: 4, name: "Sight Read" }).closest("section")!;
    const firstList = sightRead.querySelector("h5 + ul")!;
    expect(firstList.children).toHaveLength(3);
    expect(within(sightRead).getByText("Show all")).toBeTruthy();
    expect(sightRead.querySelector("details ul")!.children.length).toBeGreaterThan(0);
  });
});
