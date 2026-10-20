import { describe, expect, it } from "vitest";
import { rolodexSuggestions } from "./rolodex-suggestions";
import { createPiecePracticeRun } from "../persistence/piece-practice-runs";
import { createPiecePracticeSession, skipCurrentPiecePracticeTarget } from "../piece-practice-session";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { testScore } from "../continuous/continuous-test-fixtures";

describe("optional retained-run suggestions", () => {
  it("caps suggestions at three and retains the exact completed run score and factual skips", () => {
    const score = testScore("4/4", 4), projection = projectStaffBuilderPieceForPractice(score);
    if (!projection.ok) throw Error("fixture");
    const created = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!created.ok) throw Error("fixture");
    let state = created.state;
    for (let i = 0; i < 4; i++) state = skipCurrentPiecePracticeTarget(projection.piece, state, 100 + i * 100).state;
    expect(state.status).toBe("piece-complete");
    const record = createPiecePracticeRun(score, state, 500);
    const suggestions = rolodexSuggestions([record]);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map(e => e.start)).toEqual([0, 1, 2]);
    expect(suggestions[0]).toMatchObject({ score, sourceInstrument: "unknown", origin: "evidence-suggested", evidence: { runId: record.runId, reasons: "0 mistakes, 1 skipped targets, 0 restarts, 0 recorded slow responses" } });
  });
  it("ignores unavailable, corrupt and unsupported evidence", () => {
    expect(rolodexSuggestions([null, {}, { schemaVersion: 99 }])).toEqual([]);
  });
  it("does not suggest difficulty from an unfinished run or from silence without evidence", () => {
    const score = testScore(), projection = projectStaffBuilderPieceForPractice(score);
    if (!projection.ok) throw Error("fixture");
    const state = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!state.ok) throw Error("fixture");
    expect(rolodexSuggestions([createPiecePracticeRun(score, state.state, 0)])).toEqual([]);
  });
});
