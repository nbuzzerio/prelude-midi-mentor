import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StaffBuilderStudyAnnotations } from "./staff-builder-study-annotations";

afterEach(cleanup);
const records = [
  { annotation: { id: "n", kind: "study-note" as const, anchor: { kind: "event" as const, eventId: "e" }, text: "A long study note" }, annotationIndex: 0, measureIndex: 0, measureNumber: 1, eventStartTick: 0, eventStaff: "treble" as const, content: "A long study note", kindLabel: "Study Note", locationLabel: "Event in Measure 1" },
  { annotation: { id: "p", kind: "practice-mark" as const, anchor: { kind: "measure" as const, measureId: "m" }, category: "rhythm" as const }, annotationIndex: 1, measureIndex: 0, measureNumber: 1, content: "Rhythm", kindLabel: "Practice Mark", locationLabel: "Measure 1" },
];
const projection = { records, markers: [{ key: "event:e:study-note", kind: "study-note" as const, label: "N" as const, count: 2, bounds: { x: 10, y: 20, width: 28, height: 28 }, records: [records[0]!], accessibleName: "Study Notes, 2 annotations, Measure 1, event" }] };

describe("StaffBuilderStudyAnnotations", () => {
  it("renders compact markers and complete read-only content with selection", () => {
    let selected: string | null = null;
    const { rerender } = render(<StaffBuilderStudyAnnotations onSelect={(key) => { selected = key; }} projection={projection} selectedKey={selected} />);
    fireEvent.click(screen.getByRole("button", { name: /Study Notes, 2 annotations/ }));
    expect(selected).toBe("event:e:study-note");
    rerender(<StaffBuilderStudyAnnotations onSelect={() => undefined} projection={projection} selectedKey={selected} />);
    expect(screen.getByText("N2").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("A long study note")).toBeTruthy();
    expect(screen.getByText("Rhythm")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit|delete|add/i })).toBeNull();
  });
});
