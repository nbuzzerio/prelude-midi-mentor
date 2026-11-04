import { describe, expect, it } from "vitest";
import { rolodexSuggestions } from "./rolodex-suggestions";
import { createPiecePracticeRun, parsePiecePracticeRun, PiecePracticeRunWriteCoordinator } from "../persistence/piece-practice-runs";
import { parseEntry } from "./rolodex-model";
import { createPiecePracticeSession, getCurrentPiecePracticeTarget, submitPiecePracticeAttempt, skipCurrentPiecePracticeTarget, restartCurrentPiecePracticeMeasure } from "../piece-practice-session";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { testScore } from "../continuous/continuous-test-fixtures";

describe("optional retained-run suggestions", () => {
  function observed(signal: "mistake" | "skip" | "restart" | "slow") {
    const score = testScore("4/4", 2);
    const projection = projectStaffBuilderPieceForPractice(score);
    if (!projection.ok) throw Error("fixture");
    const created = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!created.ok) throw Error("fixture");
    let state = created.state;
    const play = (midi: number, atMs: number) => {
      const target = getCurrentPiecePracticeTarget(projection.piece, state)!;
      state = submitPiecePracticeAttempt(projection.piece, state, {
        targetId: target.id, attempt: { attackMidiNumbers: [midi] }, atMs,
      }).state;
    };
    play(60, 100);
    if (signal === "mistake") play(61, 200);
    if (signal === "restart") state = restartCurrentPiecePracticeMeasure(projection.piece, state, 200);
    if (signal === "skip") state = skipCurrentPiecePracticeTarget(projection.piece, state, 300).state;
    else play(62, signal === "slow" ? 10000 : 300);
    expect(state.status).toBe("piece-complete");
    const record = { ...createPiecePracticeRun(score, state, 10001), runId: signal };
    expect(parsePiecePracticeRun(record).ok).toBe(true);
    return record;
  }

  it.each([
    ["mistake", "skip"], ["skip", "restart"], ["restart", "slow"],
  ] as const)("ranks durable %s evidence ahead of %s evidence in either input order", (higher, lower) => {
    const high = observed(higher), low = observed(lower);
    const reasons = {
      mistake: "1 mistakes, 0 skipped targets, 0 restarts, 0 recorded slow responses",
      skip: "0 mistakes, 1 skipped targets, 0 restarts, 0 recorded slow responses",
      restart: "0 mistakes, 0 skipped targets, 1 restarts, 0 recorded slow responses",
      slow: "0 mistakes, 0 skipped targets, 0 restarts, 1 recorded slow responses",
    };
    for (const records of [[low, high], [high, low]]) {
      const entries = rolodexSuggestions(JSON.parse(JSON.stringify(records)));
      expect(entries).toHaveLength(1);
      expect(entries[0].evidence).toEqual({ runId: higher, measureIndex: 1, reasons: reasons[higher] });
      expect(entries[0].score).toEqual(high.sourceScore);
      expect(entries[0].measureIds).toEqual([high.sourceScore.measures[1].id]);
    }
  });

  it("rejects stale source identities and evidence referring to a different source measure", () => {
    const record = observed("mistake");
    const stale = { ...record, sourceScoreUpdatedAt: "2000-01-01T00:00:00.000Z" };
    const mismatched = { ...record, checkpoint: { ...record.checkpoint,
      mistakeEvidence: record.checkpoint.mistakeEvidence.map(item => ({ ...item, sourceMeasureId: "removed-measure" })),
    } };
    for (const invalid of [stale, mismatched]) {
      expect(parsePiecePracticeRun(invalid).ok).toBe(false);
      expect(rolodexSuggestions([invalid])).toEqual([]);
      expect(rolodexSuggestions([invalid, record])[0].evidence?.runId).toBe("mistake");
    }
  });

  function retained(runId: string, restarts: readonly number[], score = testScore("4/4", restarts.length)) {
    const projection = projectStaffBuilderPieceForPractice(score);
    if (!projection.ok) throw Error("fixture");
    const created = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!created.ok) throw Error("fixture");
    let state = created.state;
    let time = 0;
    for (const count of restarts) {
      for (let i = 0; i < count; i++) state = restartCurrentPiecePracticeMeasure(projection.piece, state, ++time);
      state = skipCurrentPiecePracticeTarget(projection.piece, state, ++time).state;
    }
    return { ...createPiecePracticeRun(score, state, time + 1), runId };
  }

  it("ranks all durable candidates before capping, independently of input order", () => {
    const weak = retained("weak", [0, 0, 0, 0]);
    const strong = retained("strong", [0, 0, 1, 3]);
    for (const records of [[weak, strong], [strong, weak]]) {
      const suggestions = rolodexSuggestions(JSON.parse(JSON.stringify(records)));
      expect(suggestions.map(e => e.start)).toEqual([3, 2, 0]);
      expect(suggestions[0].evidence).toEqual({ runId: "strong", measureIndex: 3,
        reasons: "0 mistakes, 1 skipped targets, 3 restarts, 0 recorded slow responses" });
      expect(suggestions[0].score).toEqual(strong.sourceScore);
      expect(suggestions[0].measureIds).toEqual([strong.sourceScore.measures[3].id]);
    }
  });

  it("deduplicates source measures without adding counts and breaks run ties stably", () => {
    const a = retained("a", [1, 0]);
    const b = retained("b", [1, 0]);
    for (const records of [[b, a, a], [a, b]]) {
      const suggestions = rolodexSuggestions(records);
      expect(suggestions.map(e => [e.start, e.evidence?.runId])).toEqual([[0, "a"], [1, "a"]]);
      expect(suggestions[0].evidence?.reasons).toContain("1 restarts");
    }
  });

  it("keeps distinct frozen source snapshots and their measure references", () => {
    const original = retained("original", [0]);
    const changed = retained("changed", [0], { ...original.sourceScore, title: "Revised source", updatedAt: "2026-10-21T12:00:00.000Z" });
    const suggestions = rolodexSuggestions([original, changed]);
    expect(suggestions).toHaveLength(2);
    for (const record of [original, changed]) {
      const entry = suggestions.find(e => e.evidence?.runId === record.runId)!;
      expect(entry.score).toEqual(record.sourceScore);
      expect(entry.sourceUpdatedAt).toBe(record.sourceScore.updatedAt);
      expect(entry.measureIds).toEqual([record.sourceScore.measures[0].id]);
    }
  });

  it("preserves ranked provenance through durable run storage and entry serialization", async () => {
    const records = new Map<string, unknown>();
    const store = new PiecePracticeRunWriteCoordinator({
      list: async () => [...records.values()],
      put: async record => { records.set(record.runId, JSON.parse(JSON.stringify(record))); },
      discard: async id => { records.delete(id); },
    });
    await store.save(retained("weak", [0, 0]));
    const strong = retained("strong", [0, 2]);
    await store.save(strong);
    const [suggestion] = rolodexSuggestions(await store.list());
    const reloaded = parseEntry(JSON.parse(JSON.stringify(suggestion)));
    expect(reloaded.evidence).toEqual({ runId: "strong", measureIndex: 1,
      reasons: "0 mistakes, 1 skipped targets, 2 restarts, 0 recorded slow responses" });
    expect(reloaded.score).toEqual(strong.sourceScore);
    expect(reloaded.measureIds).toEqual(["m1"]);
  });
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
  it("does not fabricate difficulty for a completed clean performance", () => {
    const score = testScore("4/4", 1);
    const projection = projectStaffBuilderPieceForPractice(score);
    if (!projection.ok) throw Error("fixture");
    const created = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!created.ok) throw Error("fixture");
    const target = getCurrentPiecePracticeTarget(projection.piece, created.state)!;
    const result = submitPiecePracticeAttempt(projection.piece, created.state, {
      targetId: target.id, attempt: { attackMidiNumbers: [60] }, atMs: 100,
    });
    expect(result.state.status).toBe("piece-complete");
    expect(rolodexSuggestions([createPiecePracticeRun(score, result.state, 100)])).toEqual([]);
  });
  it("does not suggest difficulty from an unfinished run or from silence without evidence", () => {
    const score = testScore(), projection = projectStaffBuilderPieceForPractice(score);
    if (!projection.ok) throw Error("fixture");
    const state = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!state.ok) throw Error("fixture");
    expect(rolodexSuggestions([createPiecePracticeRun(score, state.state, 0)])).toEqual([]);
  });
});
