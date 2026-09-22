import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderLibrary } from "./staff-builder-library";

const piece: StaffBuilderScore = { schemaVersion: 3, annotations: [], id: "saved", title: "Saved Piece", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: [{ id: "m1", events: [] }] };
afterEach(cleanup);

describe("StaffBuilderLibrary", () => {
  it("places Print / PDF after Download and before Duplicate and returns the exact saved score", () => {
    const print = vi.fn();
    const before = JSON.stringify(piece);
    const { container } = render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={vi.fn()} onPractice={vi.fn()} onPrint={print} onRename={vi.fn()} pieces={[piece]} practiceMetadataByPieceId={{}} />);
    const actions = [...container.querySelectorAll(".staff-builder-library-item button, .staff-builder-library-item summary")].slice(0, 5).map(({ textContent }) => textContent);
    expect(actions).toEqual(["Open", "Practice", "Download", "Print / PDF", "Duplicate"]);
    fireEvent.click(screen.getByRole("button", { name: "Print / PDF Saved Piece" }));
    expect(print).toHaveBeenCalledWith(piece);
    expect(JSON.stringify(piece)).toBe(before);
  });

  it("keeps the existing primary and secondary actions available", () => {
    render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={vi.fn()} onPractice={vi.fn()} onPrint={vi.fn()} onRename={vi.fn()} pieces={[piece]} practiceMetadataByPieceId={{}} />);
    expect(screen.getByRole("button", { name: "Open Saved Piece" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Practice Saved Piece" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download Saved Piece" })).toBeTruthy();
    expect(screen.getByLabelText("Duplicate Saved Piece")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rename Saved Piece" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Saved Piece" })).toBeTruthy();
  });

  it("offers an accessible sort control and changes the rendered order", () => {
    const later = { ...piece, id: "later", title: "Alpha", updatedAt: "2026-02-01T00:00:00.000Z" };
    render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={vi.fn()} onPractice={vi.fn()} onPrint={vi.fn()} onRename={vi.fn()} pieces={[piece, later]} practiceMetadataByPieceId={{ saved: { lastPracticedAt: "2026-03-01T00:00:00.000Z" } }} />);
    const titles = () => screen.getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent);
    expect((screen.getByRole("combobox", { name: "Sort" }) as HTMLSelectElement).value).toBe("recently-played");
    expect(titles()).toEqual(["Saved Piece", "Alpha"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "alphabetical" } });
    expect(titles()).toEqual(["Alpha", "Saved Piece"]);
  });
});
