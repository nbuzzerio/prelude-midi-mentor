import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderLibrary } from "./staff-builder-library";
import { testScore } from "@/features/piece-practice/continuous/continuous-test-fixtures";

const piece: StaffBuilderScore = { schemaVersion: 4, annotations: [], id: "saved", title: "Saved Piece", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: [{ id: "m1", events: [] }] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function libraryProps(pieces: readonly StaffBuilderScore[]) {
  return {
    activePieceId: null,
    pieces,
    practiceMetadataByPieceId: {},
    onDelete: vi.fn(), onDownload: vi.fn(), onDuplicate: vi.fn(), onImportFile: vi.fn(),
    onOpen: vi.fn(), onStudy: vi.fn(), onPractice: vi.fn(), onPrint: vi.fn(),
    onRename: vi.fn(), onSavePassage: vi.fn(),
  };
}

const eveningStudy = { ...piece, id: "evening", title: "Evening Study", updatedAt: "2026-03-01T00:00:00.000Z" };
const morningStudy = { ...piece, id: "morning", title: "Morning study", updatedAt: "2026-02-01T00:00:00.000Z" };

function UpdatingLibrary({ initialPieces, beforeChange }: Readonly<{ initialPieces: readonly StaffBuilderScore[]; beforeChange?: () => void }>) {
  const [pieces, setPieces] = useState(initialPieces);
  return <><button type="button">Other action</button><StaffBuilderLibrary {...libraryProps(pieces)}
    onRename={(id, title) => {
      beforeChange?.();
      setPieces(current => current.map(value => value.id === id ? { ...value, title } : value));
    }}
    onDelete={id => {
      beforeChange?.();
      setPieces(current => current.filter(value => value.id !== id));
    }}
  /></>;
}

describe("StaffBuilderLibrary", () => {
  it("offers manual passage saving with the exact saved source independently of Practice", () => {
    const source = testScore(), save = vi.fn(), practice = vi.fn();
    render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={vi.fn()} onStudy={vi.fn()} onPractice={practice} onPrint={vi.fn()} onRename={vi.fn()} onSavePassage={save} pieces={[source]} practiceMetadataByPieceId={{}} />);
    fireEvent.click(screen.getByText("Save to Practice Rolodex"));
    expect(save).toHaveBeenCalledWith(source); expect(practice).not.toHaveBeenCalled();
  });
  it("opens Study View by saved ID through an accessible independent action", () => {
    const onStudy = vi.fn();
    const onOpen = vi.fn();
    const onPractice = vi.fn();
    render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={onOpen} onStudy={onStudy} onPractice={onPractice} onPrint={vi.fn()} onRename={vi.fn()} pieces={[piece]} practiceMetadataByPieceId={{}} />);
    const button = screen.getByRole("button", { name: "Study View Saved Piece" });
    fireEvent.click(button);
    expect(onStudy).toHaveBeenCalledWith(piece.id, button);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onPractice).not.toHaveBeenCalled();
  });
  it("places Print / PDF after Download and before Duplicate and returns the exact saved score", () => {
    const print = vi.fn();
    const before = JSON.stringify(piece);
    const { container } = render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={vi.fn()} onStudy={vi.fn()} onPractice={vi.fn()} onPrint={print} onRename={vi.fn()} pieces={[piece]} practiceMetadataByPieceId={{}} />);
    const actions = [...container.querySelectorAll(".staff-builder-library-item button, .staff-builder-library-item summary")].slice(0, 6).map(({ textContent }) => textContent);
    expect(actions).toEqual(["Open", "Study View", "Practice", "Download", "Print / PDF", "Duplicate"]);
    fireEvent.click(screen.getByRole("button", { name: "Print / PDF Saved Piece" }));
    expect(print).toHaveBeenCalledWith(piece);
    expect(JSON.stringify(piece)).toBe(before);
  });

  it("keeps the existing primary and secondary actions available", () => {
    render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={vi.fn()} onStudy={vi.fn()} onPractice={vi.fn()} onPrint={vi.fn()} onRename={vi.fn()} pieces={[piece]} practiceMetadataByPieceId={{}} />);
    expect(screen.getByRole("button", { name: "Open Saved Piece" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Practice Saved Piece" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download Saved Piece" })).toBeTruthy();
    expect(screen.getByLabelText("Duplicate Saved Piece")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rename Saved Piece" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Saved Piece" })).toBeTruthy();
  });

  it("offers an accessible sort control and changes the rendered order", () => {
    const later = { ...piece, id: "later", title: "Alpha", updatedAt: "2026-02-01T00:00:00.000Z" };
    render(<StaffBuilderLibrary activePieceId={null} onDelete={vi.fn()} onDownload={vi.fn()} onDuplicate={vi.fn()} onImportFile={vi.fn()} onOpen={vi.fn()} onStudy={vi.fn()} onPractice={vi.fn()} onPrint={vi.fn()} onRename={vi.fn()} pieces={[piece, later]} practiceMetadataByPieceId={{ saved: { lastPracticedAt: "2026-03-01T00:00:00.000Z" } }} />);
    const titles = () => screen.getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent);
    expect((screen.getByRole("combobox", { name: "Sort" }) as HTMLSelectElement).value).toBe("recently-played");
    expect(titles()).toEqual(["Saved Piece", "Alpha"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "alphabetical" } });
    expect(titles()).toEqual(["Alpha", "Saved Piece"]);
  });

  it("searches title substrings without case or surrounding-whitespace differences and reports the matching count", () => {
    const props = libraryProps([piece, eveningStudy, morningStudy]);
    render(<StaffBuilderLibrary {...props} />);
    const search = screen.getByRole("searchbox", { name: "Search pieces" }) as HTMLInputElement;
    expect(search.type).toBe("search");
    expect(screen.getByText("3 pieces")).toBeTruthy();

    fireEvent.change(search, { target: { value: "  STUD  " } });

    expect(screen.getByText("2 of 3 pieces")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Evening Study" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Morning study" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Saved Piece" })).toBeNull();
    expect(props.onOpen).not.toHaveBeenCalled();
    expect(props.onRename).not.toHaveBeenCalled();

    fireEvent.change(search, { target: { value: "   " } });
    expect(screen.getByText("3 pieces")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Saved Piece" })).toBeTruthy();
  });

  it("distinguishes an empty library from no search matches and restores results and focus when cleared", () => {
    const props = libraryProps([piece]);
    const view = render(<StaffBuilderLibrary {...props} />);
    const search = screen.getByRole("searchbox", { name: "Search pieces" }) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "absent title" } });
    expect(screen.getByText(/No matching pieces/i)).toBeTruthy();
    expect(screen.queryByText("No Staff Builder pieces yet.")).toBeNull();
    expect(screen.getByText(/0 of 1 piece/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import Piece" })).toBeTruthy();

    const clear = screen.getByRole("button", { name: "Clear search" });
    clear.focus();
    fireEvent.click(clear);
    expect(search.value).toBe("");
    expect(document.activeElement).toBe(search);
    expect(screen.getByRole("button", { name: "Open Saved Piece" })).toBeTruthy();
    expect(screen.queryByText(/No matching pieces/i)).toBeNull();

    view.rerender(<StaffBuilderLibrary {...props} pieces={[]} />);
    expect(screen.getByText("No Staff Builder pieces yet.")).toBeTruthy();
    expect(screen.queryByText(/No matching pieces/i)).toBeNull();
  });

  it("preserves the selected sort among matches and after clearing the search", () => {
    const recentlyUpdatedMorning = { ...morningStudy, updatedAt: "2026-04-01T00:00:00.000Z" };
    render(<StaffBuilderLibrary {...libraryProps([piece, recentlyUpdatedMorning, eveningStudy])} />);
    const sort = screen.getByRole("combobox", { name: "Sort" }) as HTMLSelectElement;
    const visibleOpenNames = () => screen.getAllByRole("button", { name: /^Open / }).map(button => button.getAttribute("aria-label"));
    fireEvent.change(sort, { target: { value: "alphabetical" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pieces" }), { target: { value: "study" } });
    expect(sort.value).toBe("alphabetical");
    expect(visibleOpenNames()).toEqual(["Open Evening Study", "Open Morning study"]);

    fireEvent.change(sort, { target: { value: "recently-updated" } });
    expect(visibleOpenNames()).toEqual(["Open Morning study", "Open Evening Study"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(sort.value).toBe("recently-updated");
    expect(visibleOpenNames()).toEqual(["Open Morning study", "Open Evening Study", "Open Saved Piece"]);
  });

  it("passes the exact original saved piece to actions while results are filtered", () => {
    const source = { ...testScore(), id: "target", title: "Target Study" };
    const props = libraryProps([piece, source]);
    render(<StaffBuilderLibrary {...props} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pieces" }), { target: { value: "target" } });
    const study = screen.getByRole("button", { name: "Study View Target Study" });
    fireEvent.click(study);
    fireEvent.click(screen.getByRole("button", { name: "Practice Target Study" }));
    fireEvent.click(screen.getByRole("button", { name: "Download Target Study" }));
    fireEvent.click(screen.getByRole("button", { name: "Save passage from Target Study" }));

    expect(props.onStudy).toHaveBeenCalledWith(source.id, study);
    expect(props.onPractice.mock.calls[0][0]).toBe(source);
    expect(props.onDownload.mock.calls[0][0]).toBe(source);
    expect(props.onSavePassage.mock.calls[0][0]).toBe(source);
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it("re-evaluates current search results when incoming pieces are renamed, imported, or deleted", () => {
    const props = libraryProps([piece, eveningStudy]);
    const view = render(<StaffBuilderLibrary {...props} />);
    const search = screen.getByRole("searchbox", { name: "Search pieces" }) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "study" } });
    expect(screen.getByText("1 of 2 pieces")).toBeTruthy();

    const renamed = { ...eveningStudy, title: "Evening Prelude" };
    view.rerender(<StaffBuilderLibrary {...props} pieces={[piece, renamed]} />);
    expect(search.value).toBe("study");
    expect(screen.getByText("0 of 2 pieces")).toBeTruthy();
    expect(screen.getByText(/No matching pieces/i)).toBeTruthy();

    view.rerender(<StaffBuilderLibrary {...props} pieces={[piece, renamed, morningStudy]} />);
    expect(screen.getByText("1 of 3 pieces")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Morning study" })).toBeTruthy();

    view.rerender(<StaffBuilderLibrary {...props} pieces={[piece, renamed]} />);
    expect(screen.getByText("0 of 2 pieces")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Morning study" })).toBeNull();
  });

  it("returns focus to search when a confirmed rename removes the focused result", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Evening Prelude");
    render(<UpdatingLibrary initialPieces={[piece, eveningStudy, morningStudy]} />);
    const search = screen.getByRole("searchbox", { name: "Search pieces" });
    fireEvent.change(search, { target: { value: "study" } });
    const rename = screen.getByRole("button", { name: "Rename Evening Study" });
    rename.focus();
    fireEvent.click(rename);

    expect(screen.queryByRole("button", { name: "Rename Evening Study" })).toBeNull();
    expect(document.activeElement).toBe(search);
    expect(screen.getByRole("button", { name: "Open Morning study" })).toBeTruthy();
  });

  it("returns focus to search after confirming deletion of the only matching result", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<UpdatingLibrary initialPieces={[piece, eveningStudy]} />);
    const search = screen.getByRole("searchbox", { name: "Search pieces" });
    fireEvent.change(search, { target: { value: "study" } });
    const remove = screen.getByRole("button", { name: "Delete Evening Study" });
    remove.focus();
    fireEvent.click(remove);

    expect(screen.getByText(/No matching pieces/i)).toBeTruthy();
    expect(document.activeElement).toBe(search);
    expect(screen.getByText(/0 of 1 piece/)).toBeTruthy();
  });

  it("keeps action focus when a renamed piece still matches or a rename or deletion is canceled", () => {
    vi.spyOn(window, "prompt").mockReturnValueOnce("Evening Study Revised").mockReturnValueOnce(null);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<UpdatingLibrary initialPieces={[piece, eveningStudy]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pieces" }), { target: { value: "study" } });
    const rename = screen.getByRole("button", { name: "Rename Evening Study" });
    rename.focus();
    fireEvent.click(rename);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rename Evening Study Revised" }));
    fireEvent.click(rename);
    expect(document.activeElement).toBe(rename);
    expect(screen.getByRole("button", { name: "Open Evening Study Revised" })).toBeTruthy();

    const remove = screen.getByRole("button", { name: "Delete Evening Study Revised" });
    remove.focus();
    fireEvent.click(remove);
    expect(document.activeElement).toBe(remove);
    expect(screen.getByRole("button", { name: "Open Evening Study Revised" })).toBeTruthy();
  });

  it("does not steal deliberately moved focus when a confirmed rename removes a result", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Evening Prelude");
    render(<UpdatingLibrary initialPieces={[piece, eveningStudy]} beforeChange={() => screen.getByRole("button", { name: "Other action" }).focus()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pieces" }), { target: { value: "study" } });
    const rename = screen.getByRole("button", { name: "Rename Evening Study" });
    rename.focus();
    const other = screen.getByRole("button", { name: "Other action" });
    fireEvent.click(rename);

    expect(screen.getByText(/No matching pieces/i)).toBeTruthy();
    expect(document.activeElement).toBe(other);
  });
});
