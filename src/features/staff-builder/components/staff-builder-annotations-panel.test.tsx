import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_STAFF_BUILDER_ANNOTATION_LAYERS, type StaffBuilderAnnotationLayer } from "../staff-builder-annotation-layers";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderAnnotationsPanel } from "./staff-builder-annotations-panel";

afterEach(cleanup);

function initialScore(): StaffBuilderScore {
  return {
    schemaVersion: 2, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], annotations: [],
    measures: [{ id: "measure", events: [{ id: "event", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" } }] }],
  };
}

function twoEventScore(): StaffBuilderScore {
  const score = initialScore();
  return { ...score, measures: [{ ...score.measures[0], events: [score.measures[0].events[0], { ...score.measures[0].events[0], id: "event-b", startTick: 480 }] }] };
}

function Harness({ selectedEventId = "event", source = initialScore(), onScore = vi.fn() }: Readonly<{ selectedEventId?: string | null; source?: StaffBuilderScore; onScore?: (score: StaffBuilderScore) => void }>) {
  const [score, setScore] = useState(source);
  const [visible, setVisible] = useState<ReadonlySet<StaffBuilderAnnotationLayer>>(() => new Set(ALL_STAFF_BUILDER_ANNOTATION_LAYERS));
  return <><StaffBuilderAnnotationsPanel createId={() => `annotation-${score.annotations.length + 1}`} measureIndex={0} now={() => "2026-01-02T00:00:00.000Z"} onLayerVisibilityChange={(layer, shown) => setVisible((current) => { const next = new Set(current); if (shown) next.add(layer); else next.delete(layer); return next; })} onScoreMutation={(next) => { setScore(next); onScore(next); return true; }} score={score} selectedEventId={selectedEventId} visibleLayers={visible} /><output data-testid="annotation-count">{score.annotations.length}</output></>;
}

function openForm() { fireEvent.click(screen.getByRole("button", { name: "Add Annotation" })); }
function form() { return screen.getByRole("group", { name: "Add annotation" }); }

describe("StaffBuilderAnnotationsPanel", () => {
  it("authors a Study Note on the selected event and a Study Note on the current measure", () => {
    const onScore = vi.fn();
    render(<Harness onScore={onScore} />);
    openForm();
    fireEvent.change(within(form()).getByLabelText("Study note"), { target: { value: "Shape the cadence." } });
    fireEvent.click(within(form()).getByRole("button", { name: "Add Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0]).toMatchObject({ kind: "study-note", anchor: { kind: "event", eventId: "event" }, text: "Shape the cadence." });
    expect(screen.getByText("Selected event")).toBeTruthy();
    openForm();
    fireEvent.click(within(form()).getByLabelText("Current measure"));
    fireEvent.change(within(form()).getByLabelText("Study note"), { target: { value: "Review slowly." } });
    fireEvent.click(within(form()).getByRole("button", { name: "Add Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[1]).toMatchObject({ anchor: { kind: "measure", measureId: "measure" } });
  });

  it("authors exact Practice Mark categories and validates Other text", () => {
    const onScore = vi.fn();
    render(<Harness onScore={onScore} />);
    openForm();
    fireEvent.change(within(form()).getByLabelText("Annotation type"), { target: { value: "practice-mark" } });
    const category = within(form()).getByLabelText("Practice mark") as HTMLSelectElement;
    expect([...category.options].map(({ value }) => value)).toEqual(["needs-work", "rhythm", "hands-separate", "check-fingering", "other"]);
    fireEvent.change(category, { target: { value: "other" } });
    fireEvent.click(within(form()).getByRole("button", { name: "Add Annotation" }));
    expect(screen.getByText("Describe the other practice mark.")).toBeTruthy();
    expect(onScore).not.toHaveBeenCalled();
    fireEvent.change(within(form()).getByLabelText("Other practice mark"), { target: { value: "Even tone" } });
    fireEvent.click(within(form()).getByRole("button", { name: "Add Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0]).toMatchObject({ kind: "practice-mark", category: "other", text: "Even tone" });
  });

  it("authors exact categorized Bookmarks", () => {
    const onScore = vi.fn();
    render(<Harness onScore={onScore} />);
    openForm();
    fireEvent.change(within(form()).getByLabelText("Annotation type"), { target: { value: "bookmark" } });
    const category = within(form()).getByLabelText("Bookmark category") as HTMLSelectElement;
    expect([...category.options].map(({ value }) => value)).toEqual(["interesting", "needs-work", "question", "revisit"]);
    fireEvent.change(category, { target: { value: "question" } });
    fireEvent.click(within(form()).getByRole("button", { name: "Add Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0]).toMatchObject({ kind: "bookmark", category: "question" });
    expect(screen.getByText("Question")).toBeTruthy();
  });

  it("offers only the current measure when no event is selected", () => {
    render(<Harness selectedEventId={null} />);
    expect(screen.getByText(/No event selected/)).toBeTruthy();
    openForm();
    expect(within(form()).queryByLabelText("Selected event")).toBeNull();
    expect((within(form()).getByLabelText("Current measure") as HTMLInputElement).checked).toBe(true);
  });

  it("edits, cancels without mutation, and deletes through the supplied score boundary", () => {
    const source = { ...initialScore(), annotations: [{ id: "note", kind: "study-note" as const, anchor: { kind: "event" as const, eventId: "event" }, text: "Original" }] };
    const onScore = vi.fn();
    render(<Harness onScore={onScore} source={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Study Note: Original" }));
    fireEvent.change(screen.getByLabelText("Study note"), { target: { value: "Discarded" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onScore).not.toHaveBeenCalled();
    expect(screen.getByText("Original")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Study Note: Original" }));
    fireEvent.change(screen.getByLabelText("Study note"), { target: { value: "Revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0].text).toBe("Revised");
    fireEvent.click(screen.getByRole("button", { name: "Delete Study Note: Revised" }));
    expect(onScore.mock.lastCall?.[0].annotations).toEqual([]);
  });

  it("preserves Event A when Event B is selected and the target is not changed", () => {
    const source = { ...twoEventScore(), annotations: [{ id: "note", kind: "study-note" as const, anchor: { kind: "event" as const, eventId: "event" }, text: "Original" }] };
    const onScore = vi.fn();
    render(<Harness onScore={onScore} selectedEventId="event-b" source={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Study Note: Original" }));
    expect((screen.getByLabelText("Existing event") as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText("Study note"), { target: { value: "Revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0].anchor).toEqual({ kind: "event", eventId: "event" });
  });

  it("preserves an existing event anchor when no event is selected", () => {
    const source = { ...initialScore(), annotations: [{ id: "note", kind: "study-note" as const, anchor: { kind: "event" as const, eventId: "event" }, text: "Original" }] };
    const onScore = vi.fn();
    render(<Harness onScore={onScore} selectedEventId={null} source={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Study Note: Original" }));
    fireEvent.change(screen.getByLabelText("Study note"), { target: { value: "Revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0]).toMatchObject({ anchor: { kind: "event", eventId: "event" }, text: "Revised" });
  });

  it("re-anchors Event A only when Selected event is explicitly chosen", () => {
    const source = { ...twoEventScore(), annotations: [{ id: "note", kind: "study-note" as const, anchor: { kind: "event" as const, eventId: "event" }, text: "Original" }] };
    const onScore = vi.fn();
    render(<Harness onScore={onScore} selectedEventId="event-b" source={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Study Note: Original" }));
    fireEvent.click(screen.getByLabelText("Selected event"));
    fireEvent.click(screen.getByRole("button", { name: "Save Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0].anchor).toEqual({ kind: "event", eventId: "event-b" });
  });

  it("preserves an existing measure anchor when its target is not changed", () => {
    const source = { ...initialScore(), annotations: [{ id: "note", kind: "study-note" as const, anchor: { kind: "measure" as const, measureId: "measure" }, text: "Original" }] };
    const onScore = vi.fn();
    render(<Harness onScore={onScore} source={source} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Study Note: Original" }));
    fireEvent.change(screen.getByLabelText("Study note"), { target: { value: "Revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Annotation" }));
    expect(onScore.mock.lastCall?.[0].annotations[0].anchor).toEqual({ kind: "measure", measureId: "measure" });
  });

  it("keeps hidden-layer annotations manageable and leaves canonical data unchanged", () => {
    const source = { ...initialScore(), annotations: [{ id: "note", kind: "study-note" as const, anchor: { kind: "measure" as const, measureId: "measure" }, text: "Still here" }] };
    const onScore = vi.fn();
    render(<Harness onScore={onScore} source={source} />);
    fireEvent.click(screen.getByLabelText("Study Notes"));
    expect(screen.getByText("Still here")).toBeTruthy();
    expect(screen.getByTestId("annotation-count").textContent).toBe("1");
    expect(onScore).not.toHaveBeenCalled();
  });

  it("starts with all presentation layers visible and toggles each independently", () => {
    render(<Harness />);
    const studyNotes = screen.getByLabelText("Study Notes") as HTMLInputElement;
    const practiceMarks = screen.getByLabelText("Practice Marks") as HTMLInputElement;
    const bookmarks = screen.getByLabelText("Bookmarks") as HTMLInputElement;
    expect([studyNotes.checked, practiceMarks.checked, bookmarks.checked]).toEqual([true, true, true]);
    fireEvent.click(studyNotes);
    expect([studyNotes.checked, practiceMarks.checked, bookmarks.checked]).toEqual([false, true, true]);
    fireEvent.click(practiceMarks);
    expect([studyNotes.checked, practiceMarks.checked, bookmarks.checked]).toEqual([false, false, true]);
    fireEvent.click(bookmarks);
    expect([studyNotes.checked, practiceMarks.checked, bookmarks.checked]).toEqual([false, false, false]);
  });
});
