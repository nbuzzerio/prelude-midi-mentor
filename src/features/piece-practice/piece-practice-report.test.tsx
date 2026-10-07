import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { PiecePracticeResults } from "./components/piece-practice-results";
import { formatPiecePracticeReport, formatPiecePracticeAttackEvidence, formatAcousticHeardPitch, mistakeText } from "./piece-practice-report";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { PiecePracticeExpectedPitchSnapshot } from "./piece-practice-evidence";
import type { PiecePracticeAcousticEvidence } from "./piece-practice-evidence";
import { createPiecePracticeSession, recordPiecePracticeMidiAttack, restartCurrentPiecePracticeMeasure, restartPiecePractice, skipCurrentPiecePracticeTarget, submitPiecePracticeAttempt, type PiecePracticeSessionState } from "./piece-practice-session";
import type { PiecePracticePiece } from "./piece-practice-types";

vi.mock("@/hooks/use-browser-print", () => ({ useBrowserPrint: vi.fn() }));
vi.mock("@/features/staff-builder/components/staff-builder-print-score", () => ({ StaffBuilderPrintScore: () => <div /> }));
vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({ StaffBuilderScoreView: () => <div /> }));

const piece: PiecePracticePiece = {
  sourceScoreId: "score", sourceScoreUpdatedAt: "now", title: "Study", tempoBpm: 96,
  measures: [{ measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920,
    keySignatureId: "c-major", timeSignature: "4/4", clefs: { treble: "treble", bass: "bass" }, sourceEvents: [], restEventIds: [],
    targets: [{ id: "target", measureIndex: 0, sourceMeasureId: "m1", startTick: 0, absoluteStartTick: 0,
      sourceEventIds: [], expectedMidiNumbers: [60], attackedPitches: [],
      checks: [{ id: "check", kind: "normal", sourceEventIds: [], expectedMidiNumbers: [60], attackedPitches: [] }] }],
  }],
};

function initial() {
  const result = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0 });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function completed() {
  const withEvidence = recordPiecePracticeMidiAttack(piece, initial(), 60, 91, 100);
  return submitPiecePracticeAttempt(piece, withEvidence, { targetId: "target", attempt: { attackMidiNumbers: [60] }, atMs: 200 }).state;
}
const report = (state: PiecePracticeSessionState, includeAttackStrength = false) => formatPiecePracticeReport({ title: "Study", rangeText: "Measure 1", state, includeAttackStrength });
const view = (state = completed()) => <PiecePracticeResults displayScore={{} as StaffBuilderScore} rangeText="Measure 1" state={state} title="Study" />;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Piece Practice note-name-first results and reports", () => {
  it.each([0, 0.049, -0.049])("renders %s cents as centered when rounded to zero", (cents) => {
    const text = formatAcousticHeardPitch({ nearestSemitone: 64, expectedPitches: [],
      frequencyHz: equalTemperedFrequency(64) * 2 ** (cents / 1200) });
    expect(text).toBe("E4 · centered");
    expect(text).not.toContain("sharp");
    expect(text).not.toContain("flat");
  });
  it.each([[0.051, "sharp"], [31, "sharp"], [-0.051, "flat"], [-31, "flat"]] as const)("preserves %s cents as %s", (cents, direction) => {
    const text = formatAcousticHeardPitch({ nearestSemitone: 64, expectedPitches: [],
      frequencyHz: equalTemperedFrequency(64) * 2 ** (cents / 1200) });
    expect(text).toBe(`E4 · ${Math.abs(cents).toFixed(1)}¢ ${direction} of E4`);
  });
  it("keeps accepted acoustic pitch evidence and authored spelling in screen, copy and print", async () => {
    const expected = { sourceEventId: "event", sourcePitchId: "pitch", staff: "treble" as const, midiNumber: 66, letter: "G" as const, accidental: "flat" as const, octave: 4 };
    const attack: PiecePracticeAcousticEvidence = { source: "microphone", sequence: 0, measureIndex: 0, sourceMeasureId: "m1", targetId: "target", checkId: "check", occurredAtActiveMs: 200,
      expectedPitches: [expected], expectedSemitone: 66, nearestSemitone: 66, frequencyHz: 440 * 2 ** (-3 / 12) * 2 ** (31 / 1200), centsFromExpected: 31,
      pitchToleranceCents: 40, accepted: true, rejection: null, articulation: "after-quiet", confirmationDelayMs: 80 };
    const state = { ...completed(), inputConfiguration: { mode: "microphone" as const, instrument: "ocarina" as const, pitchToleranceCents: 40 }, acousticEvidence: [attack] };
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(view(state));
    expect(screen.getByRole("heading", { name: "Microphone pitch attacks" })).toBeTruthy();
    expect(screen.getByText(/Expected G♭4; heard G♭4/)).toBeTruthy();
    expect(screen.queryByLabelText("Include MIDI attack strength")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" })); await screen.findByText("Report copied.");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Accepted within ±40¢"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Microphone pitch attacks"));
    expect(writeText.mock.calls[0][0]).not.toContain("physical MIDI attacks");
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" })); fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    const printed = within(screen.getByLabelText("Study practice report"));
    expect(printed.getByRole("heading", { name: "Microphone pitch attacks" })).toBeTruthy();
    expect(printed.getByText(/observation confirmation delay 80 ms/)).toBeTruthy();
  });
  it("shares two deliberate restarts across Copy Report and default problem-scope PDF without counting mistakes", async () => {
    const restarted = restartCurrentPiecePracticeMeasure(piece, restartCurrentPiecePracticeMeasure(piece, initial(), 100), 200);
    const finished = submitPiecePracticeAttempt(piece, restarted, { targetId: "target", attempt: { attackMidiNumbers: [60] }, atMs: 300 }).state;
    expect(finished.restartEvidence).toMatchObject([{ sequence: 0, occurredAtActiveMs: 100 }, { sequence: 1, occurredAtActiveMs: 200 }]);
    expect(finished.mistakeEvidence).toHaveLength(0);
    expect(finished.skipEvidence).toHaveLength(0);
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(view(finished));
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied.");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Restarts: 2"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Problem measures: 1"));
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    expect((screen.getByLabelText("Problem measures only") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    const printed = within(screen.getByLabelText("Study practice report"));
    expect(printed.getByRole("heading", { name: "Measure 1" })).toBeTruthy();
    expect(printed.getByText(/Restarts: 2/)).toBeTruthy();
  });

  it("does not turn a normal target retry into restart evidence", () => {
    const failed = submitPiecePracticeAttempt(piece, initial(), { targetId: "target", attempt: { attackMidiNumbers: [61] }, atMs: 100 }).state;
    const retried = submitPiecePracticeAttempt(piece, failed, { targetId: "target", attempt: { attackMidiNumbers: [60] }, atMs: 200 }).state;
    expect(retried.restartEvidence).toEqual([]);
    expect(report(retried)).not.toContain("Restarts:");
  });
  it("labels completed results, Copy Report, and print from run assessment state", async () => {
    const state = { ...completed(), assessmentFocus: "lower" as const };
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(view(state));
    expect(screen.getByText("Assessment: Lower Staff")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied.");
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining("Assessment: Lower Staff"));
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(within(screen.getByLabelText("Study practice report")).getByText("Assessment: Lower Staff")).toBeTruthy();
    expect(report(completed())).toContain("Assessment: Both Staves");
  });

  it("describes a skipped, unarmed first target as not timed in Copy Report and print", () => {
    const skipped = skipCurrentPiecePracticeTarget(piece, initial(), 8_000);
    if (!skipped.skipped) throw new Error("Expected the first target to be skipped");
    expect(skipped.state.targetTimings[0]).toMatchObject({ timingBasis: "unarmed-skip", activatedAtActiveMs: null, responseDurationMs: null, isHesitation: false });
    expect(report(skipped.state)).toContain("Skipped before first attempt; response not timed.");
    render(view(skipped.state));
    expect(screen.getByText("Skipped before first attempt; response not timed.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(within(screen.getByLabelText("Study practice report")).getByText("Skipped before first attempt; response not timed.")).toBeTruthy();
  });

  function mistakes() {
    const state = recordPiecePracticeMidiAttack(piece, initial(), 77, 54, 100);
    const failed = submitPiecePracticeAttempt(piece, state, { targetId: "target", attempt: { attackMidiNumbers: [77, 81, 86], heldMidiNumbers: [77, 81, 86] }, atMs: 200 }).state;
    return submitPiecePracticeAttempt(piece, failed, { targetId: "target", attempt: { attackMidiNumbers: [60] }, atMs: 300 }).state;
  }

  it("copies note-name-first mistakes by default and adds numeric details to results and reports only when selected", async () => {
    const state = mistakes(); const before = JSON.stringify(state); const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } }); render(view(state));
    expect((screen.getByLabelText("Show MIDI details") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Played: F5, A5, D6")).toBeTruthy();
    expect(screen.getByText("Extra: F5, A5, D6")).toBeTruthy();
    expect(screen.getByText("Unexpected held: F5, A5, D6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" })); await screen.findByText("Report copied.");
    expect(writeText.mock.calls[0]![0]).toContain("Played: F5, A5, D6"); expect(writeText.mock.calls[0]![0]).not.toContain("MIDI 77");
    fireEvent.click(screen.getByLabelText("Show MIDI details"));
    expect(screen.getByText("Played: F5 (MIDI 77), A5 (MIDI 81), D6 (MIDI 86)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" })); await screen.findByText("Report copied.");
    expect(writeText.mock.calls[1]![0]).toContain("Played: F5 (MIDI 77), A5 (MIDI 81), D6 (MIDI 86)");
    expect(JSON.stringify(state)).toBe(before);
    expect(state.mistakeEvidence[0]).toMatchObject({ receivedMidiNumbers: [77, 81, 86], extraMidiNumbers: [77, 81, 86], unexpectedHeldMidiNumbers: [77, 81, 86] });
  });

  it.each([false, true])("uses the same note-name-first formatting in print/PDF, MIDI details %s", (details) => {
    render(view(mistakes()));
    fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    if (details) fireEvent.click(screen.getByLabelText("Show MIDI details"));
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    const printed = within(screen.getByLabelText("Study practice report"));
    expect(printed.getByText(details ? "Played: F5 (MIDI 77), A5 (MIDI 81), D6 (MIDI 86)" : "Played: F5, A5, D6")).toBeTruthy();
    expect(printed.getByText(new RegExp(details ? "F5 \\(MIDI 77\\), velocity 54" : "F5, velocity 54"))).toBeTruthy();
  });

  it.each([
    { strength: false, details: false }, { strength: true, details: false },
    { strength: false, details: true }, { strength: true, details: true },
  ])("keeps velocity inclusion and MIDI detail independent: $strength / $details", ({ strength, details }) => {
    const text = formatPiecePracticeReport({ title: "Study", rangeText: "Measure 1", state: mistakes(), includeAttackStrength: strength, showMidiDetails: details });
    expect(text.includes("velocity 54")).toBe(strength); expect(text.includes("MIDI 77")).toBe(details);
    expect(text).toContain(details ? "Played: F5 (MIDI 77)" : "Played: F5");
  });

  it("preserves target and predecessor authored spelling and uses the relevant measure key for unknown pitches", () => {
    const bFlat: PiecePracticeExpectedPitchSnapshot = { sourceEventId: "bb", sourcePitchId: "bb", staff: "treble", midiNumber: 70, letter: "B", accidental: "flat", octave: 4 };
    const state = mistakes(); const mistake = state.mistakeEvidence[0]!;
    if (mistake.kind !== "normal-attempt") throw new Error("Expected normal evidence");
    const item = { ...mistake, expectedPitches: [bFlat], receivedMidiNumbers: [70, 82], extraMidiNumbers: [82], missingMidiNumbers: [], unexpectedHeldMidiNumbers: [61], predecessorPitches: [{ ...bFlat, midiNumber: 61, letter: "D" as const }] };
    const contextualPiece = { ...piece, measures: [{ ...piece.measures[0]!, keySignatureId: "f-major" as const }] };
    const text = mistakeText(item, { piece: contextualPiece });
    expect(text).toMatchObject({ expected: "B♭4", played: "B♭4, B♭5", extra: ["B♭5"], held: ["D♭4"] });
    const attack = { sequence: 0, measureIndex: 0, sourceMeasureId: "m1", targetId: "target", midiNumber: 70, attackVelocity: 66, occurredAtActiveMs: 5065 };
    expect(formatPiecePracticeAttackEvidence(attack, { piece: contextualPiece })).toContain("5.065s: B♭4, velocity 66");
    expect(formatPiecePracticeAttackEvidence({ ...attack, midiNumber: 79 }, { piece: contextualPiece, showMidiDetails: true })).toContain("5.065s: G5 (MIDI 79), velocity 66");
  });

  it("does not borrow authored spelling from another unrelated target", () => {
    const base = piece.measures[0]!.targets[0]!;
    const unrelated = { ...base, id: "unrelated", attackedPitches: [{ sourceEventId: "bb", sourcePitchId: "bb", staff: "treble" as const, midiNumber: 70, letter: "B" as const, accidental: "flat" as const, octave: 4, duration: "quarter" as const, durationTicks: 480, incomingTieIds: [], outgoingTieIds: [] }] };
    const source = { ...piece, measures: [{ ...piece.measures[0]!, keySignatureId: "g-major" as const, targets: [base, unrelated] }] };
    const attack = { sequence: 0, measureIndex: 0, sourceMeasureId: "m1", targetId: "target", midiNumber: 70, attackVelocity: 66, occurredAtActiveMs: 100 };
    expect(formatPiecePracticeAttackEvidence(attack, { piece: source })).toContain("A♯4, velocity 66");
  });

  it("preserves each authored spelling in expected and slow summaries when staves share a MIDI pitch", () => {
    const dFlat: PiecePracticeExpectedPitchSnapshot = { sourceEventId: "db", sourcePitchId: "db", staff: "treble", midiNumber: 61, letter: "D", accidental: "flat", octave: 4 };
    const cSharp = { ...dFlat, sourceEventId: "cs", sourcePitchId: "cs", letter: "C" as const, accidental: "sharp" as const };
    const state = mistakes(); const item = state.mistakeEvidence[0]!;
    const reportState = { ...state, mistakeEvidence: [{ ...item, expectedPitches: [dFlat, cSharp] }],
      targetTimings: [{ ...state.targetTimings[0]!, expectedPitches: [dFlat, cSharp], isHesitation: true }] };
    expect(report(reportState)).toContain("Expected: D♭4, C♯4");
    expect(report(reportState)).toContain("Slow response: D♭4, C♯4");
  });
});

describe("Piece Practice report attack strength", () => {
  it("keeps the OFF report identical with or without velocity evidence", () => {
    const state = completed(); const without = { ...state }; delete without.attackEvidence;
    expect(report(state)).toBe(report(without));
    expect(report(state)).not.toMatch(/velocity|attack strength/i);
    expect(report(state)).toContain("Mistakes: 0");
  });
  it("includes exact per-attack evidence and range deterministically only when enabled", () => {
    let state = recordPiecePracticeMidiAttack(piece, initial(), 60, 54, 100);
    state = recordPiecePracticeMidiAttack(piece, state, 60, 107, 150);
    state = submitPiecePracticeAttempt(piece, state, { targetId: "target", attempt: { attackMidiNumbers: [60] }, atMs: 200 }).state;
    const before = JSON.stringify(state);
    expect(report(state, true)).toContain("0.100s: C4, velocity 54");
    expect(report(state, true)).toContain("0.150s: C4, velocity 107");
    expect(report(state, true)).toContain("Range: 54-107");
    expect(report(state, true)).toBe(report(state, true));
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each([undefined, 0, 128, -1, 1.5, NaN])("never fabricates evidence for unavailable/invalid velocity %s", (velocity) => {
    const state = initial();
    expect(recordPiecePracticeMidiAttack(piece, state, 60, velocity, 100)).toBe(state);
    expect(report(state, true)).toContain("No MIDI attack velocity evidence available.");
    expect(report(state, true)).not.toContain("Range:");
  });
  it("ignores attacks outside active practice and resets evidence on restart", () => {
    const state = initial();
    expect(recordPiecePracticeMidiAttack(piece, { ...state, clockPaused: true }, 60, 91, 100).attackEvidence).toBeUndefined();
    expect(recordPiecePracticeMidiAttack(piece, completed(), 60, 91, 300)).toEqual(completed());
    expect(restartPiecePractice(piece, completed(), 300).attackEvidence).toBeUndefined();
  });
  it("defaults OFF and copies the exact selected report without mutating the session", async () => {
    const writeText = vi.fn(async () => undefined); vi.stubGlobal("navigator", { clipboard: { writeText } });
    const state = completed(); const before = JSON.stringify(state); render(view(state));
    expect((screen.getByLabelText("Include MIDI attack strength") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied."); expect(writeText).toHaveBeenLastCalledWith(report(state));
    fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied."); expect(writeText).toHaveBeenLastCalledWith(report(state, true));
    expect(JSON.stringify(state)).toBe(before);
  });
  it("freezes exact failed-copy text, selects it, and retries using current state/options", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("blocked")).mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const state = completed(); const rendered = render(view(state));
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    const textarea = await screen.findByLabelText("Piece Practice report") as HTMLTextAreaElement;
    expect(textarea.value).toBe(report(state)); expect(textarea.readOnly).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(textarea)); expect(textarea.selectionEnd).toBe(textarea.value.length);
    const changed = { ...state, activeElapsedMs: 500, completedAtActiveMs: 500 };
    rendered.rerender(view(changed)); fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    expect(textarea.value).toBe(report(state));
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied."); expect(writeText).toHaveBeenLastCalledWith(report(changed, true));
    expect(screen.queryByLabelText("Piece Practice report")).toBeNull();
  });
  it("adds velocities to print/PDF only when the report toggle is ON", () => {
    render(view()); fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(screen.getByLabelText("Study practice report").textContent).toContain("velocity 91");
  });
});
