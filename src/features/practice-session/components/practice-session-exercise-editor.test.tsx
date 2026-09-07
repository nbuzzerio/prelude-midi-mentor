import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "../practice-session-builder-options";
import type { PracticeExerciseEntry } from "../practice-session-types";
import PracticeSessionExerciseEditor from "./practice-session-exercise-editor";

afterEach(cleanup);
const entry = (id: string) => PRACTICE_SESSION_BUILDER_OPTIONS.find((option) => option.id === id)!.createEntry(id);
function StatefulEditor({ initial }: { initial: PracticeExerciseEntry }) {
  const [current, setCurrent] = useState(initial);
  return <><PracticeSessionExerciseEditor entry={current} onChange={setCurrent} /><output data-testid="committed-target">{"count" in current.target ? String(current.target.count) : current.target.kind}</output></>;
}

describe("Practice Session exercise editor", () => {
  it("edits Flashcard config and permits a temporary blank target", () => {
    const onChange = vi.fn();
    render(<PracticeSessionExerciseEditor entry={entry("note-recognition")} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mixed" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ config: expect.objectContaining({ mode: "mixed" }) }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Target/ }), { target: { value: "12" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: { kind: "correct-answers", count: 12 } }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Target/ }), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: { kind: "correct-answers", count: null } }));
  });

  it("atomically changes Sequence target families", () => {
    let current = entry("melodic-intervals");
    const onChange = vi.fn((next: PracticeExerciseEntry) => { current = next; });
    const view = render(<PracticeSessionExerciseEditor entry={current} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Scales" }));
    current = onChange.mock.calls.at(-1)![0]; view.rerender(<PracticeSessionExerciseEditor entry={current} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Scale Practice Mode" }), { target: { value: "repertoire-in-order" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ config: expect.objectContaining({ scalePracticeMode: "repertoire-in-order" }), target: { kind: "complete-scale-repertoire" } }));
  });

  it("reuses Ear Training controls", () => {
    const onChange = vi.fn();
    render(<PracticeSessionExerciseEditor entry={entry("ear-intervals")} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Octave"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ enabledIntervals: expect.arrayContaining(["octave"]) }) }));
  });

  it("uses Melody config duration without a second numeric target", () => {
    const onChange = vi.fn();
    render(<PracticeSessionExerciseEditor entry={entry("reading-flow")} onChange={onChange} />);
    expect(screen.queryByRole("spinbutton", { name: "Target" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ continuousDurationMinutes: 3 }), target: { kind: "configured-timed-practice" } }));
  });

  it("restores a blank exercise label from the committed entry on blur", () => {
    render(<StatefulEditor initial={entry("note-recognition")} />);
    const label = screen.getByRole("textbox", { name: "Exercise label" }) as HTMLInputElement;
    fireEvent.change(label, { target: { value: "" } });
    expect(label.value).toBe("");
    fireEvent.blur(label);
    expect(label.value).toBe("Note Recognition");
  });

  it("restores an invalid numeric target from the committed count on blur", () => {
    const initial = { ...entry("note-recognition"), target: { kind: "correct-answers" as const, count: 12 } } as PracticeExerciseEntry;
    render(<StatefulEditor initial={initial} />);
    const target = screen.getByRole("spinbutton", { name: /^Target/ }) as HTMLInputElement;
    fireEvent.change(target, { target: { value: "1.5" } });
    expect(target.value).toBe("1.5");
    fireEvent.blur(target);
    expect(target.value).toBe("12");
  });

  it("keeps an empty numeric target blank and commits null after blur", () => {
    const initial = { ...entry("note-recognition"), target: { kind: "correct-answers" as const, count: 12 } } as PracticeExerciseEntry;
    render(<StatefulEditor initial={initial} />);
    const target = screen.getByRole("spinbutton", { name: /^Target/ }) as HTMLInputElement;
    fireEvent.change(target, { target: { value: "" } });
    fireEvent.blur(target);
    expect(target.value).toBe("");
    expect(screen.getByTestId("committed-target").textContent).toBe("null");
  });
});
