import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PracticeSessionLibrary } from "../practice-session-types";
import { MINIMAL_WEEKLY_PRACTICE_EXAMPLE, REALISTIC_WEEKLY_PRACTICE_EXAMPLE } from "../import/weekly-practice-examples";
import WeeklyPracticeImportDialog from "./weekly-practice-import-dialog";

afterEach(cleanup);
const library: PracticeSessionLibrary = { schemaVersion: 2, presets: [], curricula: [], lastUsedPresetId: null };
const factory = () => { let value = 0; return () => `id-${value++}`; };

describe("Weekly Practice import dialog", () => {
  it("keeps reverse Tab inside the dialog from the initially focused heading", () => {
    render(<WeeklyPracticeImportDialog createId={factory()} library={library} onCancel={vi.fn()} onImport={vi.fn()} />);
    const dialog = screen.getByRole("dialog"); const heading = screen.getByRole("heading", { name: "Import Weekly Plan" });
    expect(document.activeElement).toBe(heading);
    fireEvent.keyDown(heading, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("uses pasted JSON for a readable practice/rest preview and confirms once", () => {
    const onImport = vi.fn(); render(<WeeklyPracticeImportDialog createId={factory()} library={library} onCancel={vi.fn()} onImport={onImport} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Weekly Practice JSON" }), { target: { value: JSON.stringify(REALISTIC_WEEKLY_PRACTICE_EXAMPLE) } });
    fireEvent.click(screen.getByRole("button", { name: "Validate and preview" }));
    expect(screen.getByRole("heading", { name: "Foundations week" })).toBeTruthy(); expect(screen.getByText("Rest day")).toBeTruthy();
    expect(screen.getByText(/Note Recognition/)).toBeTruthy(); expect(screen.getByText(/Reading Flow/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import weekly plan" }));
    expect(onImport).toHaveBeenCalledOnce(); expect(onImport.mock.calls[0]?.[0].presets).toHaveLength(4);
  });

  it("renders detailed validation issues and resets stale results when source changes", () => {
    render(<WeeklyPracticeImportDialog createId={factory()} library={library} onCancel={vi.fn()} onImport={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Weekly Practice JSON" }); fireEvent.change(input, { target: { value: "{}" } }); fireEvent.click(screen.getByRole("button", { name: "Validate and preview" }));
    expect(screen.getByRole("heading", { name: "Could not validate this weekly plan" })).toBeTruthy();
    fireEvent.change(input, { target: { value: JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE) } }); expect(screen.queryByRole("heading", { name: "Could not validate this weekly plan" })).toBeNull();
  });

  it("loads file text into the same input and supports Escape cancellation", async () => {
    const onCancel = vi.fn(); render(<WeeklyPracticeImportDialog createId={factory()} library={library} onCancel={onCancel} onImport={vi.fn()} />);
    const file = new File([JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE)], "week.json", { type: "application/json" }); Object.defineProperty(file, "text", { value: async () => JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE) });
    fireEvent.change(screen.getByLabelText("Choose .json file"), { target: { files: [file] } });
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Weekly Practice JSON" }) as HTMLTextAreaElement).value).toContain("prelude-weekly-practice"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); expect(onCancel).toHaveBeenCalledOnce();
  });
});
