import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { createPiecePracticeRun, IndexedDbPiecePracticeRunStore, parsePiecePracticeRun } from "../persistence/piece-practice-runs";
import { createPiecePracticeSession, getCurrentPiecePracticeTarget, submitPiecePracticeAttempt } from "../piece-practice-session";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { testScore } from "../continuous/continuous-test-fixtures";
import { rolodexStore } from "./rolodex-store";
import { PostPracticeRecommendations } from "./post-practice-recommendations";

vi.mock("../continuous/continuous-score", () => ({ ContinuousScore: () => <div>Score preview</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function completed(clean = false) {
  const score = testScore("4/4", 2), projection = projectStaffBuilderPieceForPractice(score);
  if (!projection.ok) throw Error("projection");
  const created = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, startedAtMs: 0 });
  if (!created.ok) throw Error("session");
  let state = created.state;
  for (const [midi, atMs] of clean ? [[60, 100], [62, 300]] : [[60, 100], [61, 200], [62, 300]]) {
    state = submitPiecePracticeAttempt(projection.piece, state, {
      targetId: getCurrentPiecePracticeTarget(projection.piece, state)!.id,
      attempt: { attackMidiNumbers: [midi] }, atMs,
    }).state;
  }
  expect(state.status).toBe("piece-complete");
  return createPiecePracticeRun(score, state, 400);
}
let runStore: IndexedDbPiecePracticeRunStore;
async function setup(clean = false) {
  runStore = new IndexedDbPiecePracticeRunStore();
  vi.stubGlobal("indexedDB", new FakeImprovIndexedDb().factory);
  const run = completed(clean);
  await runStore.save(run);
  const restored = (await runStore.list())[0];
  expect(restored).toEqual(run);
  return { run, view: render(<PostPracticeRecommendations run={run} runStore={runStore} />) };
}

it("durable completion to inspection to explicit manual save preserves the original result and provenance on reload", async () => {
  const { run, view } = await setup();
  const inspect = await screen.findByRole("button", { name: /Inspect measure 2/ });
  expect(screen.getByText(/Evidence: 1 mistakes/)).toBeTruthy();
  expect((await rolodexStore.list()).entries).toEqual([]);
  fireEvent.click(inspect);
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Save to Practice Rolodex" }));
  expect((screen.getByText("Save Passage") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/I confirm/));
  fireEvent.click(screen.getByText("Save Passage"));
  await screen.findByText("Passage saved to Rolodex. Your results are unchanged.");
  const saved = (await rolodexStore.list()).entries;
  expect(saved).toHaveLength(1);
  expect(saved[0].score).toEqual(run.sourceScore);
  expect(saved[0].evidence).toEqual({ runId: run.runId, measureIndex: 1, reasons: "1 mistakes, 0 skipped targets, 0 restarts, 0 recorded slow responses" });
  expect(saved[0].measureIds).toEqual([run.sourceScore.measures[1].id]);
  expect(await runStore.list()).toEqual([run]);
  view.unmount();
  runStore = new IndexedDbPiecePracticeRunStore();
  const parsed = parsePiecePracticeRun((await runStore.list())[0]);
  if (!parsed.ok) throw Error("reload failed native validation");
  const reloadedRun = parsed.record;
  expect(reloadedRun).toEqual(run);
  expect((await rolodexStore.list()).entries).toEqual(saved);
  const duplicate = await rolodexStore.save(saved[0], null);
  expect(duplicate.entry).toEqual(saved[0]);
  expect((await rolodexStore.list()).entries).toHaveLength(1);
  render(<PostPracticeRecommendations run={reloadedRun} runStore={runStore} />);
  await screen.findByText(/No remaining recommendations/);
  expect(screen.queryByRole("button", { name: /Inspect/ })).toBeNull();
});

it("cancel, return and decline keep durable results and never save; focus returns to the recommendations heading", async () => {
  const { run } = await setup();
  fireEvent.click(await screen.findByRole("button", { name: /Inspect measure/ }));
  fireEvent.click(screen.getByText("Cancel"));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Recommended next practice" })));
  fireEvent.click(screen.getByText("Return to results"));
  expect(screen.queryByRole("button", { name: /Inspect/ })).toBeNull();
  fireEvent.click(screen.getByText("Review recommendations"));
  fireEvent.click(screen.getByText("Decline measure 2"));
  expect(screen.getByText(/No remaining recommendations/)).toBeTruthy();
  expect((await rolodexStore.list()).entries).toEqual([]);
  expect(await runStore.list()).toEqual([run]);
});

it("shows an honest empty state for clean completion", async () => {
  await setup(true);
  await screen.findByText(/No remaining recommendations/);
  expect(screen.queryByRole("button", { name: /Inspect/ })).toBeNull();
});

it.each(["missing", "unfinished", "cancelled", "fabricated", "stale", "read failure", "unreadable Rolodex"])("offers nothing for %s durable evidence", async kind => {
  const run = completed();
  const list = vi.fn(async () => kind === "missing" ? [] : [{ ...run, ...(kind === "unfinished" ? { status: "active" } : kind === "cancelled" ? { status: "ended-incomplete" } : kind === "stale" ? { revision: run.revision + 1 } : kind === "unreadable Rolodex" ? {} : { checkpoint: {} }) }]);
  if (kind === "read failure") list.mockRejectedValue(Error("read"));
  render(<PostPracticeRecommendations run={run} runStore={{ list, save: vi.fn(), discard: vi.fn() }} store={{ ...rolodexStore, list: async () => ({ entries: [], unavailableCount: kind === "unreadable Rolodex" ? 1 : 0 }) }} />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: /Inspect/ })).toBeNull();
});

it("revalidates removed evidence before saving and preserves the completed result on a write failure and retry", async () => {
  const { run } = await setup();
  fireEvent.click(await screen.findByRole("button", { name: /Inspect/ }));
  fireEvent.click(screen.getByLabelText(/I confirm/));
  const list = vi.spyOn(runStore, "list").mockResolvedValueOnce([]);
  const save = vi.spyOn(rolodexStore, "save").mockRejectedValueOnce(Error("write failed"));
  fireEvent.click(screen.getByText("Save Passage"));
  await screen.findByRole("alert");
  expect(save).not.toHaveBeenCalled();
  list.mockRestore();
  fireEvent.click(screen.getByText("Retry Save Passage"));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("write failed"));
  expect(await runStore.list()).toEqual([run]);
  fireEvent.click(screen.getByText("Retry Save Passage"));
  await screen.findByText(/Passage saved to Rolodex/);
  expect((await rolodexStore.list()).entries).toHaveLength(1);
  expect(await runStore.list()).toEqual([run]);
});

