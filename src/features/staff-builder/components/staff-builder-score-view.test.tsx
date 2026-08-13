import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderEventSelection } from "../staff-builder-rhythm";
import type { StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderScoreDetails, StaffBuilderScoreView } from "./staff-builder-score-view";

const { renderMeasure } = vi.hoisted(() => ({ renderMeasure: vi.fn((container: unknown, renderedScore: unknown, measureIndex: number, options?: unknown) => {
  void container;
  void renderedScore;
  void measureIndex;
  void options;
  const authoritativeEvents = new Map([
    ["treble-note", { eventId: "treble-note", staff: "treble", startTick: 0, onsetX: 160, x: 155, y: 60, width: 20, height: 40 }],
    ["treble-chord", { eventId: "treble-chord", staff: "treble", startTick: 480, onsetX: 280, x: 275, y: 55, width: 24, height: 48 }],
    ["bass-rest", { eventId: "bass-rest", staff: "bass", startTick: 960, onsetX: 400, x: 395, y: 170, width: 20, height: 24 }],
    ["overlap-note", { eventId: "overlap-note", staff: "treble", startTick: 120, onsetX: 180, x: 176, y: 64, width: 8, height: 12 }],
    ["time-padding-event", { eventId: "time-padding-event", staff: "treble", startTick: 240, onsetX: 113, x: 110, y: 76, width: 6, height: 12 }],
    ["key-padding-event", { eventId: "key-padding-event", staff: "treble", startTick: 240, onsetX: 83, x: 82.5, y: 76, width: 1, height: 12 }],
    ["grand-padding-event", { eventId: "grand-padding-event", staff: "bass", startTick: 240, onsetX: 28, x: 25, y: 126, width: 6, height: 12 }],
  ]);
  const events = new Map([...authoritativeEvents, ["__staff-builder-preview", { eventId: "__staff-builder-preview", staff: "treble", startTick: 240, onsetX: 220, x: 215, y: 60, width: 20, height: 40 }]]);
  return { anchors: { events, authoritativeEvents, notationControls: {
    trebleClef: { x: 20, y: 45, width: 35, height: 70 },
    grandStaff: { x: 2, y: 105, width: 18, height: 90 },
    bassClef: { x: 20, y: 145, width: 35, height: 70 },
    keySignature: { x: 58, y: 45, width: 24, height: 170 },
    timeSignature: { x: 84, y: 45, width: 24, height: 170 },
  }, timeline: { rhythmicStartX: 150, rhythmicEndX: 630, y: 40, height: 220, capacityTicks: 1920 }, positions: new Map([
  [0, { tick: 0, x: 150, y: 40, width: 30, height: 220 }],
  [120, { tick: 120, x: 180, y: 40, width: 30, height: 220 }],
  [240, { tick: 240, x: 210, y: 40, width: 30, height: 220 }],
  [360, { tick: 360, x: 240, y: 40, width: 30, height: 220 }],
  ]) }, projection: {}, width: 760, height: 300, coordinateSpace: { width: 760, height: 300 } };
}) }));
vi.mock("../notation/render-staff-builder-measure", () => ({ renderStaffBuilderMeasure: renderMeasure }));

function score(): StaffBuilderScore {
  return {
    schemaVersion: 2, annotations: [], id: "score", title: "Navigation", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: [
      { id: "m1", events: [{ id: "treble-note", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "unresolved" }, pitches: [{ id: "pitch", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] }] },
      { id: "m2", keySignatureChange: "g-major", timeSignatureChange: "6/8", events: [{ id: "bass-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "quarter" } }] },
    ],
  };
}

function interactiveScore(): StaffBuilderScore {
  const current = score();
  return { ...current, measures: [{ ...current.measures[0]!, events: [
    current.measures[0]!.events[0]!,
    { id: "treble-chord", kind: "notes", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "half" }, pitches: [
      { id: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 },
      { id: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 },
    ] },
    { id: "bass-rest", kind: "rest", staff: "bass", startTick: 960, rhythm: { status: "final", duration: "quarter" } },
    { id: "overlap-note", kind: "notes", staff: "treble", startTick: 120, rhythm: { status: "final", duration: "sixteenth" }, pitches: [{ id: "d", midiNumber: 62, letter: "D", accidental: "natural", octave: 4 }] },
  ] }, current.measures[1]!] };
}

function priorityScore(): StaffBuilderScore {
  const current = score();
  return { ...current, measures: [{ ...current.measures[0]!, events: [
    { id: "time-padding-event", kind: "notes", staff: "treble", startTick: 240, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "time-pitch", midiNumber: 72, letter: "C", accidental: "natural", octave: 5 }] },
    { id: "key-padding-event", kind: "notes", staff: "treble", startTick: 240, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "key-pitch", midiNumber: 71, letter: "B", accidental: "natural", octave: 4 }] },
    { id: "grand-padding-event", kind: "notes", staff: "bass", startTick: 240, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "grand-pitch", midiNumber: 48, letter: "C", accidental: "natural", octave: 3 }] },
  ] }, current.measures[1]! ] };
}

afterEach(() => { cleanup(); renderMeasure.mockClear(); vi.unstubAllGlobals(); });

describe("StaffBuilderScoreView", () => {
  it("shows aggregated measure and event indicators only for visible annotation layers", async () => {
    const current = { ...score(), annotations: [
      { id: "m-note-1", kind: "study-note" as const, anchor: { kind: "measure" as const, measureId: "m1" }, text: "First" },
      { id: "m-note-2", kind: "study-note" as const, anchor: { kind: "measure" as const, measureId: "m1" }, text: "Second" },
      { id: "event-practice", kind: "practice-mark" as const, anchor: { kind: "event" as const, eventId: "treble-note" }, category: "rhythm" as const },
      { id: "event-bookmark", kind: "bookmark" as const, anchor: { kind: "event" as const, eventId: "treble-note" }, category: "question" as const },
    ] };
    const { container, rerender } = render(<StaffBuilderScoreView measureIndex={0} score={current} />);
    await waitFor(() => expect(container.querySelector('[data-annotation-layer="practice-marks"]')).toBeTruthy());
    expect(screen.getByText("Study Note ×2")).toBeTruthy();
    expect(screen.getByLabelText("Practice Mark, 1 annotation, event in measure 1")).toBeTruthy();
    expect(screen.getByLabelText("Bookmark, 1 annotation, event in measure 1")).toBeTruthy();
    expect(container.querySelectorAll(".staff-builder-notation-canvas")).toHaveLength(1);
    rerender(<StaffBuilderScoreView measureIndex={0} score={current} visibleAnnotationLayers={new Set(["bookmarks"])} />);
    await waitFor(() => expect(screen.queryByText("Study Note ×2")).toBeNull());
    expect(screen.queryByLabelText(/Practice Mark, 1 annotation/)).toBeNull();
    expect(screen.getByLabelText("Bookmark, 1 annotation, event in measure 1")).toBeTruthy();
    expect(current.annotations).toHaveLength(4);
  });

  it("renders generic read-only highlights from authoritative event anchors only", async () => {
    render(<StaffBuilderScoreView eventHighlights={[
      { eventId: "treble-note", status: "current" },
      { eventId: "treble-chord", status: "incorrect" },
      { eventId: "__staff-builder-preview", status: "correct" },
    ]} measureIndex={0} score={interactiveScore()} />);
    await waitFor(() => expect(screen.getAllByTestId("staff-builder-event-highlight")).toHaveLength(2));
    const highlights = screen.getAllByTestId("staff-builder-event-highlight");
    expect(highlights.map(({ dataset }) => [dataset.eventId, dataset.highlightStatus])).toEqual([
      ["treble-note", "current"], ["treble-chord", "incorrect"],
    ]);
    expect(screen.queryByRole("button", { name: /chord/i })).toBeNull();
  });
  it("supports generic missed and wrong-pitch read-only highlight semantics", async () => {
    render(<StaffBuilderScoreView eventHighlights={[{ eventId: "treble-note", status: "missed" }, { eventId: "treble-chord", status: "wrong-pitch" }]} measureIndex={0} score={interactiveScore()} />);
    await waitFor(() => expect(screen.getAllByTestId("staff-builder-event-highlight")).toHaveLength(2));
    expect(screen.getAllByTestId("staff-builder-event-highlight").map(({ dataset }) => dataset.highlightStatus)).toEqual(["missed", "wrong-pitch"]);
  });
  it("owns five direct notation controls with routing state and opens effective Key/Time wheels", async () => {
    const route = vi.fn(); const key = vi.fn(); const time = vi.fn();
    render(<StaffBuilderScoreView inputMode="grand" measureIndex={0} onInputModeChange={route} onKeyChange={key} onTimeChange={time} score={score()} />);
    const treble = screen.getByRole("button", { name: "Use treble staff" });
    const grand = screen.getByRole("button", { name: "Use grand staff" });
    const bass = screen.getByRole("button", { name: "Use bass staff" });
    expect(grand.getAttribute("aria-pressed")).toBe("true");
    expect(treble.title).toBe("Use treble staff"); expect(bass.title).toBe("Use bass staff");
    fireEvent.click(treble); fireEvent.click(grand); fireEvent.click(bass);
    expect(route.mock.calls.map(([mode]) => mode)).toEqual(["treble", "grand", "bass"]);
    const keyTrigger = screen.getByRole("button", { name: "Key signature: C major. Change key signature." });
    expect(keyTrigger.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(keyTrigger, { detail: 0 });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Key signature choices" })).toBeTruthy());
    expect(screen.getByRole("radio", { name: "C major" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "A minor" }), { detail: 0 });
    expect(key).toHaveBeenCalledWith(0, "a-minor");
    fireEvent.click(screen.getByRole("button", { name: "Time signature: 4/4. Change time signature." }), { detail: 0 });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Time signature choices" })).toBeTruthy());
    fireEvent.click(screen.getByRole("radio", { name: "Time signature 3/4" }), { detail: 0 });
    expect(time).toHaveBeenCalledWith(0, "3/4");
  });

  it("does not expose routing notation controls outside Capture Notes", () => {
    render(<StaffBuilderScoreView measureIndex={0} onKeyChange={vi.fn()} onTimeChange={vi.fn()} score={score()} />);
    expect(screen.queryByRole("button", { name: "Use treble staff" })).toBeNull();
    expect(screen.getByRole("button", { name: /Key signature: C major/ })).toBeTruthy();
  });

  it("resolves notation taps once while horizontal, vertical, and cancelled gestures activate nothing", async () => {
    const route = vi.fn(); const key = vi.fn(); const time = vi.fn();
    const { container } = render(<StaffBuilderScoreView inputMode="grand" measureIndex={0} onInputModeChange={route} onKeyChange={key} onTimeChange={time} score={score()} />);
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { pointerId: 30, clientX: 37, clientY: 75 });
    fireEvent.pointerUp(canvas, { pointerId: 30, clientX: 37, clientY: 75 });
    expect(route).toHaveBeenCalledTimes(1); expect(route).toHaveBeenLastCalledWith("treble");
    fireEvent.pointerDown(canvas, { pointerId: 31, clientX: 64, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 31, clientX: 90, clientY: 80 });
    fireEvent.pointerDown(canvas, { pointerId: 32, clientX: 81, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 32, clientX: 81, clientY: 105 });
    fireEvent.pointerDown(canvas, { pointerId: 33, clientX: 64, clientY: 80 });
    fireEvent.pointerCancel(canvas, { pointerId: 33 });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(key).not.toHaveBeenCalled(); expect(time).not.toHaveBeenCalled();
    fireEvent.pointerDown(canvas, { pointerId: 34, clientX: 64, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 34, clientX: 64, clientY: 80 });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Key signature choices" })).toBeTruthy());
    fireEvent.click(screen.getByRole("radio", { name: "A minor" }), { detail: 1 });
    expect(key).not.toHaveBeenCalled();
  });

  it("composes original notation, actual events, expanded notation, then Capture positions", async () => {
    const select = vi.fn((selection: StaffBuilderEventSelection) => { void selection; return true; }); const route = vi.fn(); const position = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration: "quarter" }} inputMode="grand" measureIndex={0} onEventSelect={select} onInputModeChange={route} onKeyChange={vi.fn()} onPositionSelect={position} onTimeChange={vi.fn()} score={priorityScore()} />);
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    const keyControl = screen.getByRole("button", { name: /Key signature: C major/ });
    const timeControl = screen.getByRole("button", { name: /Time signature: 4\/4/ });
    const grandControl = screen.getByRole("button", { name: "Use grand staff" });
    fireEvent.pointerMove(canvas, { clientX: 95, clientY: 80, pointerType: "mouse" });
    expect(timeControl.getAttribute("data-hovered")).toBe("true");
    expect(canvas.title).toBe("Change time signature");
    fireEvent.pointerMove(canvas, { clientX: 64, clientY: 80, pointerType: "mouse" });
    expect(keyControl.getAttribute("data-hovered")).toBe("true");
    expect(canvas.title).toBe("Change key signature");
    fireEvent.pointerMove(canvas, { clientX: 113, clientY: 80, pointerType: "mouse" });
    expect(timeControl.getAttribute("data-hovered")).toBeNull();
    expect(canvas.title).toBe("");
    fireEvent.pointerMove(canvas, { clientX: 83, clientY: 80, pointerType: "mouse" });
    expect(keyControl.getAttribute("data-hovered")).toBeNull();
    fireEvent.pointerMove(canvas, { clientX: 118, clientY: 100, pointerType: "mouse" });
    expect(timeControl.getAttribute("data-hovered")).toBe("true");
    fireEvent.pointerMove(canvas, { clientX: 28, clientY: 130, pointerType: "mouse" });
    expect(grandControl.getAttribute("data-hovered")).toBeNull();
    const tap = (pointerId: number, clientX: number, clientY: number) => {
      fireEvent.pointerDown(canvas, { pointerId, clientX, clientY });
      fireEvent.pointerUp(canvas, { pointerId, clientX, clientY });
    };
    tap(40, 113, 80);
    tap(41, 83, 80);
    tap(42, 28, 130);
    expect(select.mock.calls.map(([selection]) => selection.eventId)).toEqual(["time-padding-event", "key-padding-event", "grand-padding-event"]);
    expect(route).not.toHaveBeenCalled();

    tap(43, 95, 80);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Time signature choices" })).toBeTruthy());
    expect(select).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    tap(44, 64, 80);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Key signature choices" })).toBeTruthy());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    tap(45, 118, 100);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Time signature choices" })).toBeTruthy());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    tap(46, 225, 200);
    expect(position).toHaveBeenCalledWith({ measureIndex: 0, offsetTicks: 0 });
  });

  it("renders a controlled measure with a semantic summary", () => {
    render(<StaffBuilderScoreView measureIndex={0} score={score()} />);
    expect(screen.getByRole("heading", { name: "Measure 1 of 2" })).toBeTruthy();
    expect(screen.getByLabelText(/Effective key: C major/)).toBeTruthy();
    expect(screen.getByLabelText(/unresolved rhythm note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByLabelText(/Bass: No events/)).toBeTruthy();
    expect(renderMeasure).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ id: "score" }), 0, expect.any(Object));
  });

  it("renders the requested changed measure", () => {
    render(<StaffBuilderScoreView measureIndex={1} score={score()} />);
    expect(screen.getByRole("heading", { name: "Measure 2 of 2" })).toBeTruthy();
    expect(screen.getByLabelText(/Effective key: G major/)).toBeTruthy();
    expect(screen.getByLabelText(/Effective time signature: 6\/8/)).toBeTruthy();
    expect(screen.getByLabelText(/quarter rest at tick 0/)).toBeTruthy();
    expect(renderMeasure).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ id: "score" }), 1, expect.any(Object));
  });

  it("keeps technical narration out of the staff card and reveals it in collapsed Score details", () => {
    const { container } = render(<><StaffBuilderScoreView measureIndex={0} score={score()} /><StaffBuilderScoreDetails measureIndex={0} score={score()} /></>);
    expect(container.querySelector(".staff-builder-score-view .staff-builder-measure-summary")).toBeNull();
    const details = screen.getByText("Score details").parentElement as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector(".staff-builder-measure-summary")?.textContent).toContain("unresolved rhythm note C4 at tick 0");
    expect(details.querySelector(".staff-builder-measure-summary")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("#staff-builder-score-semantics")?.getAttribute("aria-label")).toContain("unresolved rhythm note C4 at tick 0");
    fireEvent.click(screen.getByText("Score details"));
    expect(details.open).toBe(true);
  });

  it("includes invalid timing once in accessible score semantics while keeping visible details aria-hidden", () => {
    const current = score();
    const invalid = { ...current, measures: [{ ...current.measures[0]!, events: [{ ...current.measures[0]!.events[0]!, startTick: 2040 }] }, current.measures[1]!] };
    const { container } = render(<><StaffBuilderScoreView measureIndex={0} score={invalid} /><StaffBuilderScoreDetails measureIndex={0} score={invalid} /></>);
    const message = "Invalid timing: 1 event(s) begin outside this measure and are indicated at the boundary.";
    const semantics = container.querySelector("#staff-builder-score-semantics")!;
    expect(semantics.getAttribute("aria-label")).toContain(message);
    const detailsCopy = container.querySelector(".staff-builder-score-details .staff-builder-measure-summary")!;
    expect(detailsCopy.textContent).toContain(message);
    expect(detailsCopy.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll(`[aria-label*="${message}"]`)).toHaveLength(1);
    fireEvent.click(screen.getByText("Score details"));
    expect((screen.getByText("Score details").parentElement as HTMLDetailsElement).open).toBe(true);
  });

  it("uses the deterministic timeline for cursor position and duration width", () => {
    const { rerender } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration: "quarter" }} measureIndex={0} score={score()} />);
    const cursor = screen.getByTestId("staff-builder-capture-cursor");
    expect(cursor.style.left).toBe("150px");
    expect(cursor.style.width).toBe("120px");
    expect(cursor.style.height).toBe("220px");
    rerender(<StaffBuilderScoreView cursor={{ offsetTicks: 360, stepDuration: "quarter" }} measureIndex={0} score={score()} />);
    expect(screen.getByTestId("staff-builder-capture-cursor").style.width).toBe("120px");
  });

  it("places an interpolated playback highlight in the shared internal coordinate plane", () => {
    const { rerender } = render(<StaffBuilderScoreView measureIndex={0} playbackPosition={{ offsetTicks: 60 }} score={score()} />);
    const highlight = screen.getByTestId("staff-builder-playback-highlight");
    expect(highlight.getAttribute("aria-hidden")).toBe("true");
    expect(highlight.style.left).toBe("165px");
    expect(highlight.style.top).toBe("40px");
    expect(highlight.style.width).toBe("30px");
    expect(highlight.style.height).toBe("220px");
    expect(highlight.parentElement?.classList.contains("staff-builder-notation-canvas")).toBe(true);
    rerender(<StaffBuilderScoreView measureIndex={0} score={score()} />);
    expect(screen.queryByTestId("staff-builder-playback-highlight")).toBeNull();
  });

  it("renders treble and bass pending previews while keeping committed semantic output separate", () => {
    render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration: "quarter" }} measureIndex={0} pendingPreview={{ treble: [64], bass: [48, 52] }} score={score()} />);
    const renderScore = renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScore;
    const events = renderScore.measures[0]?.events ?? [];
    expect(events.find(({ staff }) => staff === "treble")).toMatchObject({ id: expect.stringContaining("__staff-builder-preview"), startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ midiNumber: 64 }] });
    expect(events.find(({ staff }) => staff === "bass")).toMatchObject({ startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ midiNumber: 48 }, { midiNumber: 52 }] });
    expect(events.some(({ id }) => id === "treble-note")).toBe(false);
    expect(screen.getByLabelText(/unresolved rhythm note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByLabelText(/Pending treble preview: note E4 at tick 0/)).toBeTruthy();
    expect(screen.getByLabelText(/Pending bass preview: chord C3, E3 at tick 0/)).toBeTruthy();
  });

  it("updates and removes pending preview immediately without mutating the source score", () => {
    const current = score();
    const before = JSON.stringify(current);
    const { rerender } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 240, stepDuration: "eighth" }} measureIndex={0} pendingPreview={{ treble: [66], bass: [] }} score={current} />);
    expect((renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScore).measures[0]?.events.find(({ id }) => id.includes("preview"))).toMatchObject({ startTick: 240, pitches: [{ midiNumber: 66 }] });
    rerender(<StaffBuilderScoreView cursor={{ offsetTicks: 240, stepDuration: "eighth" }} measureIndex={0} pendingPreview={{ treble: [], bass: [] }} score={current} />);
    expect((renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScore).measures[0]?.events.some(({ id }) => id.includes("preview"))).toBe(false);
    expect(screen.getByLabelText(/Pending treble preview: none/)).toBeTruthy();
    expect(JSON.stringify(current)).toBe(before);
  });

  it.each(["quarter", "eighth", "sixteenth"] as const)("keeps pending notation at quarter duration with %s cursor movement", (stepDuration) => {
    render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration }} measureIndex={0} pendingPreview={{ treble: [60], bass: [] }} score={score()} />);
    const renderScore = renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScore;
    expect(renderScore.measures[0]?.events.find(({ id }) => id.includes("preview"))?.rhythm).toEqual({ status: "final", duration: "quarter" });
    const options = renderMeasure.mock.calls.at(-1)?.[3] as { layoutDurationTicksByEventId: ReadonlyMap<string, number>; excludedEventIds: ReadonlySet<string> };
    expect([...options.layoutDurationTicksByEventId.values()]).toEqual([{ quarter: 480, eighth: 240, sixteenth: 120 }[stepDuration]]);
    expect([...options.excludedEventIds].every((id) => id.includes("preview"))).toBe(true);
  });

  it("draws a padded selection outline from the public event anchor without a capture cursor", () => {
    render(<StaffBuilderScoreView measureIndex={0} score={score()} selectedEventId="treble-note" />);
    const outline = screen.getByTestId("staff-builder-selection-outline");
    expect(outline.style.left).toBe("150px");
    expect(outline.style.top).toBe("55px");
    expect(outline.style.width).toBe("30px");
    expect(outline.style.height).toBe("50px");
    expect(screen.queryByTestId("staff-builder-capture-cursor")).toBeNull();
  });

  it("draws a non-color-only issue overlay from public anchors", () => {
    render(<StaffBuilderScoreView issue={{ id: "issue", code: "unresolved-rhythm", severity: "error", target: { measureIndex: 0, staff: "treble", eventId: "treble-note", positionTicks: 0 }, message: "Needs rhythm", corrections: [] }} measureIndex={0} score={score()} />);
    expect(screen.getByTestId("staff-builder-issue-outline").textContent).toBe("!");
  });

  it("exposes authoritative note, chord, and rest targets but never preview targets", () => {
    const select = vi.fn(() => true);
    render(<StaffBuilderScoreView measureIndex={0} onEventSelect={select} score={interactiveScore()} />);
    expect(screen.getByRole("button", { name: /Unresolved-duration note C4, treble staff, measure 1/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /half-note chord C4 and E4, treble staff, measure 1/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /quarter rest, bass staff, measure 1/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /preview/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /half-note chord/i }));
    expect(select).toHaveBeenCalledWith({ measureIndex: 0, eventId: "treble-chord" });
  });

  it("synchronizes selection and opens a duration palette that closes after a successful edit", () => {
    const assign = vi.fn((duration: StaffBuilderDuration) => { void duration; return true; });
    function Harness() {
      const [selection, setSelection] = useState<StaffBuilderEventSelection | null>(null);
      return <StaffBuilderScoreView measureIndex={0} onAssignDuration={(duration: StaffBuilderDuration) => assign(duration)} onEventSelect={(next) => { setSelection(next); return true; }} score={interactiveScore()} selectedEventId={selection?.eventId} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /half-note chord/i }));
    expect(screen.getByTestId("staff-builder-selection-outline")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    fireEvent.click(screen.getByRole("radio", { name: "Eighth-note duration" }));
    expect(assign).toHaveBeenCalledWith("eighth");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("routes wheel center actions through Rhythm conversion and Capture-at-rest orchestration", () => {
    const convert = vi.fn(() => true);
    const capture = vi.fn(() => true);
    function Harness() {
      const [selection, setSelection] = useState<StaffBuilderEventSelection | null>(null);
      return <StaffBuilderScoreView measureIndex={0} onAssignDuration={() => true} onCaptureRestAsNote={capture} onConvertToRest={convert} onEventSelect={(next) => { setSelection(next); return true; }} score={interactiveScore()} selectedEventId={selection?.eventId} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /half-note chord/i }));
    fireEvent.click(screen.getByRole("button", { name: "Convert note or chord to rest" }));
    expect(convert).toHaveBeenCalledWith("half");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /quarter rest/i }));
    fireEvent.click(screen.getByRole("button", { name: "Replace rest with notes" }));
    expect(capture).toHaveBeenCalledWith({ measureIndex: 0, eventId: "bass-rest" });
  });

  it("does not open direct editing when editor orchestration rejects selection", () => {
    render(<StaffBuilderScoreView measureIndex={0} onAssignDuration={vi.fn(() => true)} onEventSelect={() => false} score={interactiveScore()} />);
    fireEvent.click(screen.getByRole("button", { name: /Unresolved-duration note/i }));
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("selects once for a tap while horizontal and vertical drags remain native scrolling gestures", () => {
    const select = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView measureIndex={0} onEventSelect={select} score={interactiveScore()} />);
    const target = screen.getByRole("button", { name: /Unresolved-duration note C4/ });
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    fireEvent.pointerDown(target, { pointerId: 1, clientX: 160, clientY: 70 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 163, clientY: 72 });
    fireEvent.click(target, { detail: 1 });
    expect(select).toHaveBeenCalledTimes(1);
    select.mockClear();
    fireEvent.pointerDown(target, { pointerId: 2, clientX: 160, clientY: 70 });
    fireEvent.pointerUp(target, { pointerId: 2, clientX: 180, clientY: 70 });
    expect(select).not.toHaveBeenCalled();
    fireEvent.pointerDown(target, { pointerId: 3, clientX: 160, clientY: 70 });
    fireEvent.pointerUp(target, { pointerId: 3, clientX: 160, clientY: 90 });
    expect(select).not.toHaveBeenCalled();
  });

  it("cancels pointer gestures without suppressing the next real mouse or keyboard click", async () => {
    const select = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView measureIndex={0} onEventSelect={select} score={interactiveScore()} />);
    const target = screen.getByRole("button", { name: /Unresolved-duration note C4/ });
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    fireEvent.pointerDown(target, { pointerId: 4, clientX: 160, clientY: 70 });
    fireEvent.pointerCancel(target, { pointerId: 4 });
    fireEvent.pointerUp(target, { pointerId: 4, clientX: 160, clientY: 70 });
    expect(select).not.toHaveBeenCalled();
    fireEvent.pointerDown(target, { pointerId: 5, clientX: 160, clientY: 70 });
    fireEvent.pointerUp(target, { pointerId: 5, clientX: 180, clientY: 70 });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.click(target);
    expect(select).toHaveBeenCalledOnce();
    fireEvent.click(target);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("suppresses the DOM-origin click when overlap resolution selects a different event", async () => {
    const select = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView measureIndex={0} onEventSelect={select} score={interactiveScore()} />);
    const domOrigin = screen.getByRole("button", { name: /Unresolved-duration note C4/ });
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    fireEvent.pointerDown(domOrigin, { pointerId: 6, clientX: 178, clientY: 70 });
    fireEvent.pointerUp(domOrigin, { pointerId: 6, clientX: 178, clientY: 70 });
    fireEvent.click(domOrigin, { detail: 1 });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith({ measureIndex: 0, eventId: "overlap-note" });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.click(domOrigin, { detail: 1 });
    fireEvent.click(domOrigin, { detail: 0 });
    expect(select).toHaveBeenNthCalledWith(2, { measureIndex: 0, eventId: "treble-note" });
    expect(select).toHaveBeenNthCalledWith(3, { measureIndex: 0, eventId: "treble-note" });
  });

  it("returns focus to the selected event after Escape closes the palette", async () => {
    function Harness() {
      const [selection, setSelection] = useState<StaffBuilderEventSelection | null>(null);
      return <StaffBuilderScoreView measureIndex={0} onAssignDuration={() => true} onEventSelect={(next) => { setSelection(next); return true; }} score={interactiveScore()} selectedEventId={selection?.eventId} />;
    }
    render(<Harness />);
    const eventTarget = screen.getByRole("button", { name: /half-note chord/i });
    fireEvent.click(eventTarget);
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Half-note duration" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(eventTarget));
  });

  it("resets palette focus to the newly selected event without mutating duration", () => {
    const assign = vi.fn(() => true);
    function Harness() {
      const [selection, setSelection] = useState<StaffBuilderEventSelection | null>(null);
      return <StaffBuilderScoreView measureIndex={0} onAssignDuration={assign} onEventSelect={(next) => { setSelection(next); return true; }} score={interactiveScore()} selectedEventId={selection?.eventId} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /half-note chord/i }));
    const half = screen.getByRole("radio", { name: "Half-note duration" });
    expect(document.activeElement).toBe(half);
    expect(half.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /quarter rest/i }));
    const quarter = screen.getByRole("radio", { name: "Quarter-rest duration" });
    expect(document.activeElement).toBe(quarter);
    expect(quarter.getAttribute("aria-checked")).toBe("true");
    expect(assign).not.toHaveBeenCalled();
  });

  it("moves to empty sixteenth-grid positions without creating tabbable position controls", () => {
    const position = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration: "quarter" }} measureIndex={0} onPositionSelect={position} score={interactiveScore()} />);
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { pointerId: 20, clientX: 225, clientY: 200 });
    fireEvent.pointerUp(canvas, { pointerId: 20, clientX: 226, clientY: 201 });
    expect(position).toHaveBeenCalledOnce();
    expect(position).toHaveBeenCalledWith({ measureIndex: 0, offsetTicks: 0 });
    expect(screen.queryByRole("button", { name: /position at/i })).toBeNull();
  });

  it.each([
    ["quarter", 0], ["eighth", 0], ["sixteenth", 120],
  ] as const)("resolves direct taps through active %s Step regions", (stepDuration, expectedTick) => {
    const position = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration }} measureIndex={0} onPositionSelect={position} score={interactiveScore()} />);
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { pointerId: 28, clientX: 195, clientY: 200 });
    fireEvent.pointerUp(canvas, { pointerId: 28, clientX: 195, clientY: 200 });
    expect(position).toHaveBeenCalledWith({ measureIndex: 0, offsetTicks: expectedTick });
  });

  it("keeps empty-position taps aligned when the coordinate plane is scaled and scrolled", () => {
    const position = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration: "quarter" }} measureIndex={0} onPositionSelect={position} score={interactiveScore()} />);
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: -100, y: 20, left: -100, top: 20, right: 280, bottom: 170, width: 380, height: 150, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { pointerId: 21, clientX: 12.5, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 21, clientX: 12.5, clientY: 120 });
    expect(position).toHaveBeenCalledWith({ measureIndex: 0, offsetTicks: 0 });
  });

  it("keeps event selection in the scaled plane while owning duration UI outside the notation canvas", () => {
    const select = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView measureIndex={0} onAssignDuration={() => true} onEventSelect={select} playbackPosition={{ offsetTicks: 60 }} score={interactiveScore()} selectedEventId="treble-note" />);
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: -20, y: 10, left: -20, top: 10, right: 360, bottom: 160, width: 380, height: 150, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { pointerId: 26, clientX: 60, clientY: 45 });
    fireEvent.pointerUp(canvas, { pointerId: 26, clientX: 60, clientY: 45 });
    expect(select).toHaveBeenCalledWith({ measureIndex: 0, eventId: "treble-note" });
    expect(container.querySelector(".staff-builder-duration-wheel")?.parentElement).toBe(container.querySelector(".staff-builder-score-view"));
    expect(container.querySelector(".staff-builder-selection-outline")?.parentElement).toBe(canvas);
  });

  it("routes contextual Delete through the selected-event mutation", () => {
    const remove = vi.fn(() => true);
    render(<StaffBuilderScoreView measureIndex={0} onAssignDuration={() => true} onDeleteEvent={remove} onEventSelect={() => true} score={interactiveScore()} selectedEventId="bass-rest" />);
    fireEvent.click(screen.getByRole("button", { name: /quarter rest, bass staff/ }), { detail: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Delete selected rest" }), { detail: 0 });
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "Duration choices" })).toBeNull();
  });

  it("compensates displayed event targets and hit testing at the minimum score scale", () => {
    let resize: (() => void) | undefined;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() { /* test trigger controls timing */ }
      disconnect() { /* no resources */ }
    });
    const select = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView measureIndex={0} onAssignDuration={() => true} onEventSelect={select} playbackPosition={{ offsetTicks: 60 }} score={interactiveScore()} selectedEventId="treble-note" />);
    const scroll = container.querySelector(".staff-builder-notation-scroll") as HTMLDivElement;
    Object.defineProperty(scroll, "clientWidth", { configurable: true, value: 480 });
    act(() => resize?.());
    const scale = 480 / 760;
    const target = screen.getByRole("button", { name: /Unresolved-duration note C4/ });
    expect(Number.parseFloat(target.style.width) * scale).toBeCloseTo(44);
    expect(Number.parseFloat(target.style.height) * scale).toBeGreaterThanOrEqual(44);

    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 480, bottom: 300 * scale, width: 480, height: 300 * scale, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { pointerId: 27, clientX: 135 * scale, clientY: 70 * scale });
    fireEvent.pointerUp(canvas, { pointerId: 27, clientX: 135 * scale, clientY: 70 * scale });
    expect(select).toHaveBeenCalledWith({ measureIndex: 0, eventId: "treble-note" });
    const wheel = container.querySelector(".staff-builder-duration-wheel") as HTMLElement;
    expect(wheel.style.transform).toBe("");
    expect(Number.parseFloat(wheel.style.top)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(wheel.style.top) + 268).toBeLessThanOrEqual(window.innerHeight - 8);
    expect(screen.getAllByRole("radio").every((radio) => Number.parseFloat((radio as HTMLElement).style.width) >= 44)).toBe(true);
    expect(container.querySelector(".staff-builder-playback-highlight")?.parentElement).toBe(canvas);
  });

  it("retains the 44px internal event-target minimum at presentation scale one", () => {
    render(<StaffBuilderScoreView measureIndex={0} onEventSelect={() => true} score={interactiveScore()} />);
    const target = screen.getByRole("button", { name: /Unresolved-duration note C4/ });
    expect(target.style.width).toBe("44px");
    expect(target.style.height).toBe("44px");
  });

  it("gives authoritative events precedence over positions and rejects drag or cancelled position gestures", () => {
    const select = vi.fn(() => true);
    const position = vi.fn(() => true);
    const { container } = render(<StaffBuilderScoreView measureIndex={0} onEventSelect={select} onPositionSelect={position} score={interactiveScore()} />);
    const canvas = container.querySelector(".staff-builder-notation-canvas") as HTMLDivElement;
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 760, bottom: 300, width: 760, height: 300, toJSON: () => ({}) });
    const event = screen.getByRole("button", { name: /Unresolved-duration note C4/ });
    fireEvent.pointerDown(event, { pointerId: 22, clientX: 160, clientY: 70 });
    fireEvent.pointerUp(event, { pointerId: 22, clientX: 160, clientY: 70 });
    expect(select).toHaveBeenCalledOnce();
    expect(position).not.toHaveBeenCalled();
    fireEvent.pointerDown(canvas, { pointerId: 23, clientX: 225, clientY: 200 });
    fireEvent.pointerUp(canvas, { pointerId: 23, clientX: 250, clientY: 200 });
    fireEvent.pointerDown(canvas, { pointerId: 24, clientX: 225, clientY: 200 });
    fireEvent.pointerUp(canvas, { pointerId: 24, clientX: 225, clientY: 225 });
    fireEvent.pointerDown(canvas, { pointerId: 25, clientX: 225, clientY: 200 });
    fireEvent.pointerCancel(canvas, { pointerId: 25 });
    fireEvent.pointerUp(canvas, { pointerId: 25, clientX: 225, clientY: 200 });
    expect(position).not.toHaveBeenCalled();
  });
});
