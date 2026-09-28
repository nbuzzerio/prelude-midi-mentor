import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import type { StaffBuilderScore } from "../staff-builder-types";
import { parseStaffBuilderPieceFileText, serializeStaffBuilderPiece } from "../persistence/staff-builder-piece-file";
import { StaffBuilderCopyScore } from "./staff-builder-copy-score";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function authoredScore(): StaffBuilderScore {
  return {
    ...createStaffBuilderScore({ title: "Current \u00c9tude", tempoBpm: 84, initialKeySignatureId: "c-major", initialTimeSignature: "4/4" }),
    measures: [
      { id: "m1", clefChanges: { bass: "treble" }, events: [
        { id: "chord", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, arpeggiation: "up", pitches: [
          { id: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 },
          { id: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 },
        ] },
        { id: "bass", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "unresolved" }, pitches: [{ id: "low", midiNumber: 48, letter: "C", accidental: "natural", octave: 3 }] },
      ] },
      { id: "m2", clefChanges: { treble: "bass" }, keySignatureChange: "g-major", events: [
        { id: "rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
      ] },
    ],
    annotations: [
      { id: "study", kind: "study-note", anchor: { kind: "measure", measureId: "m1" }, text: "Shape the phrase" },
      { id: "lyric", kind: "lyric-cue", anchor: { kind: "event", eventId: "chord" }, text: "Bells" },
    ],
  };
}

describe("Staff Builder Copy Score for AI", () => {
  it("copies pure canonical JSON and round trips all portable authored content without mutation", async () => {
    const canonical = authoredScore();
    const source = { ...canonical, editorPass: "capture", lastPracticedAt: "2026-09-28T12:00:00.000Z" };
    const before = structuredClone(source);
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<StaffBuilderCopyScore score={source} writeText={writeText} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
    await screen.findByText("Score JSON copied.");
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toBe(serializeStaffBuilderPiece(source));
    expect(text).toContain('\n  "schemaVersion": 4');
    expect(JSON.parse(text)).toEqual(canonical);
    expect(parseStaffBuilderPieceFileText(text)).toEqual({ ok: true, score: canonical });
    expect(source).toEqual(before);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("copies the latest score prop on each activation", async () => {
    const original = authoredScore();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<StaffBuilderCopyScore score={original} writeText={writeText} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
    await screen.findByText("Score JSON copied.");
    const edited = { ...original, title: "Unsaved title", tempoBpm: 112 };
    rerender(<StaffBuilderCopyScore score={edited} writeText={writeText} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(parseStaffBuilderPieceFileText(writeText.mock.calls[1]![0])).toEqual({ ok: true, score: edited });
  });

  it("selects the exact failed snapshot for manual copying and retries with the current score", async () => {
    const original = authoredScore();
    const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValue(undefined);
    const { rerender } = render(<StaffBuilderCopyScore score={original} writeText={writeText} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
    const textarea = await screen.findByRole("textbox", { name: "Staff Builder score JSON" }) as HTMLTextAreaElement;
    expect(textarea.value).toBe(writeText.mock.calls[0]![0]);
    expect(textarea.readOnly).toBe(true);
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
    expect(screen.getByRole("alert").textContent).toContain("manually");
    const edited = { ...original, tempoBpm: 120 };
    rerender(<StaffBuilderCopyScore score={edited} writeText={writeText} />);
    expect(textarea.value).toBe(serializeStaffBuilderPiece(original));
    fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
    await screen.findByText("Score JSON copied.");
    expect(writeText.mock.calls[1]![0]).toBe(serializeStaffBuilderPiece(edited));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("offers manual copy when the browser clipboard API is absent", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => undefined });
    render(<StaffBuilderCopyScore score={authoredScore()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
    try { await screen.findByRole("textbox", { name: "Staff Builder score JSON" }); }
    finally { if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor); else Reflect.deleteProperty(navigator, "clipboard"); }
  });
});
