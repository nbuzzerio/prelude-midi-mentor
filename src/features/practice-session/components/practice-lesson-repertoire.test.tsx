import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PracticeLessonRepertoire } from "./practice-lesson-repertoire";
import { createEntry } from "../../piece-practice/rolodex/rolodex-model";
import { testScore, TEST_INPUT } from "../../piece-practice/continuous/continuous-test-fixtures";
import { freezeLessonRepertoire } from "../practice-lesson-repertoire";
import type { RolodexLessonHost } from "../../piece-practice/rolodex/rolodex-practice";
import type { ContinuousAttempt } from "../../piece-practice/continuous/continuous-types";
const capture = vi.hoisted(() => ({ host: null as RolodexLessonHost | null }));
vi.mock("../../piece-practice/rolodex/rolodex-practice", () => ({ RolodexPractice: (props: { lessonHost: RolodexLessonHost; onExit: () => void }) => {
  capture.host = props.lessonHost;
  return <button onClick={props.onExit}>Native finish request</button>;
} }));
afterEach(cleanup);
const occurrence = freezeLessonRepertoire(createEntry(testScore(), "piano"));
const ready = { phase: "ready" as const, elapsedMs: 0, pulse: 0, attempt: null, save: "idle" as const, error: null, midiNote: null };
it("passes manual host presentation without changing the daily default", () => {
  const props = { occurrence, active: true, finished: false, onFinish: vi.fn(), onChange: vi.fn(), onPlaying: vi.fn() };
  const focus = () => true;
  const view = render(<PracticeLessonRepertoire {...props} finishLabel="Finish practice" entryFocusAllowed={focus} />);
  expect(capture.host).toMatchObject({ finishLabel: "Finish practice", entryFocusAllowed: focus });
  view.rerender(<PracticeLessonRepertoire {...props} />); expect(capture.host?.finishLabel).toBeUndefined();
});
it.each(["stopped", "interrupted", "completed"] as const)("retains the acknowledged native %s outcome without fabricating completion", status => {
  const onChange = vi.fn(), attempt = { ...terminal(), status };
  render(<PracticeLessonRepertoire occurrence={occurrence} active finished={false} onFinish={vi.fn()} onChange={onChange} onPlaying={vi.fn()} finishLabel="Finish practice" />);
  act(() => { capture.host!.onAcknowledged(attempt); capture.host!.onView({ ...ready, phase: "results", save: "saved", attempt }); });
  expect(onChange.mock.lastCall![0]).toMatchObject({ attempts: [{ status }], skipped: false, pending: false });
});
function terminal(id = "attempt-one"): ContinuousAttempt {
  return { version: 1, id, revision: 2, passage: occurrence.passage, input: TEST_INPUT, status: "completed", startedAt: "2026-10-20T12:00:00.000Z", endedAt: "2026-10-20T12:01:00.000Z", performanceStartedAt: "2026-10-20T12:00:04.000Z", observedThroughMs: 10000, reason: null, attacks: [], assessment: null, terminalSaveAttempts: 1 };
}
it("holds Finish through pending/failed terminal save, deduplicates acknowledgements and tracks Replay", async () => {
  const onFinish = vi.fn(), onChange = vi.fn(), onPlaying = vi.fn();
  render(<PracticeLessonRepertoire occurrence={occurrence} active finished={false} onFinish={onFinish} onChange={onChange} onPlaying={onPlaying} />);
  const attempt = terminal();
  act(() => capture.host!.onView({ ...ready, phase: "results", attempt, save: "failed" }));
  fireEvent.click(screen.getByText("Native finish request")); expect(onFinish).not.toHaveBeenCalled();
  expect(onChange.mock.lastCall![0]).toMatchObject({ pending: true, attempts: [] });
  act(() => { capture.host!.onAcknowledged(attempt); capture.host!.onAcknowledged(attempt); capture.host!.onView({ ...ready, phase: "results", attempt, save: "saved" }); });
  await waitFor(() => expect(onChange.mock.lastCall![0].pending).toBe(false));
  expect(onChange.mock.lastCall![0].attempts).toHaveLength(1);
  act(() => capture.host!.onView(ready));
  expect(screen.queryByText("Skip Repertoire")).toBeNull();
  act(() => capture.host!.onView({ ...ready, phase: "playing", attempt: { ...terminal("replay"), status: "started", endedAt: null }, save: "saved" }));
  expect(onPlaying).toHaveBeenLastCalledWith(true);
  act(() => { capture.host!.onAcknowledged(terminal("replay")); capture.host!.onView({ ...ready, phase: "results", attempt: terminal("replay"), save: "saved" }); });
  expect(onChange.mock.lastCall![0].attempts).toHaveLength(2);
  fireEvent.click(screen.getByText("Native finish request")); expect(onFinish).toHaveBeenCalledOnce();
});
it("keeps independent date failure visible after Finish without invalidating A1", () => {
  const onChange = vi.fn(), onFinish = vi.fn(), onPlaying = vi.fn();
  const tree = (finished: boolean) => <PracticeLessonRepertoire occurrence={occurrence} active finished={finished} onChange={onChange} onFinish={onFinish} onPlaying={onPlaying} />;
  const view = render(tree(false));
  act(() => { capture.host!.onAcknowledged(terminal()); capture.host!.onView({ ...ready, phase: "results", attempt: terminal(), save: "saved" }); capture.host!.onDates(0, 1); });
  fireEvent.click(screen.getByText("Native finish request")); expect(onFinish).toHaveBeenCalledOnce();
  view.rerender(tree(true)); expect(capture.host!.finished).toBe(true);
  expect(onChange.mock.lastCall![0]).toMatchObject({ pending: false, dateFailed: 1 });
  act(() => capture.host!.onDates(0, 0)); expect(onChange.mock.lastCall![0].attempts).toHaveLength(1);
});
it("distinguishes explicit Skip from unperformed Ready and resets on a new lesson", () => {
  const onChange = vi.fn(), onFinish = vi.fn(() => expect(onChange.mock.lastCall![0].skipped).toBe(true));
  const view = render(<PracticeLessonRepertoire occurrence={occurrence} active finished={false} onChange={onChange} onFinish={onFinish} onPlaying={vi.fn()} />);
  expect(onChange.mock.lastCall![0]).toMatchObject({ skipped: false, attempts: [], pending: false });
  fireEvent.click(screen.getByText("Skip Repertoire")); expect(onFinish).toHaveBeenCalledOnce();
  expect(onChange.mock.lastCall![0].skipped).toBe(true);
  view.unmount();
  render(<PracticeLessonRepertoire occurrence={{ ...occurrence, id: "another-lesson" }} active finished={false} onChange={onChange} onFinish={onFinish} onPlaying={vi.fn()} />);
  expect(onChange.mock.lastCall![0]).toMatchObject({ skipped: false, attempts: [], occurrence: { id: "another-lesson" } });
});
