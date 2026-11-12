import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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


describe("Weekly Practice draft preservation", () => {
  const draft = JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE);
  const input = () => screen.getByRole("textbox", { name: "Weekly Practice JSON" }) as HTMLTextAreaElement;
  const choose = (file: File) => fireEvent.change(screen.getByLabelText("Choose .json file"), { target: { files: [file] } });
  const setup = () => {
    const onImport = vi.fn();
    const view = render(<WeeklyPracticeImportDialog createId={factory()} library={library} onCancel={vi.fn()} onImport={onImport} />);
    fireEvent.change(input(), { target: { value: draft } });
    return { ...view, onImport };
  };
  it.each(["oversized", "rejected read", "throwing read", "invalid JSON", "invalid plan"])("keeps the previous draft after %s and identifies the rejected file", async kind => {
    const { onImport } = setup();
    const file = new File([kind === "oversized" ? "x".repeat(262145) : "{}"], "rejected-week.json");
    const text = vi.fn(() => {
      if (kind === "throwing read") throw Error("read failed");
      if (kind === "rejected read") return Promise.reject(Error("read failed"));
      return Promise.resolve(kind === "invalid JSON" ? "{" : "{}");
    });
    Object.defineProperty(file, "text", { value: text });
    choose(file);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain('"rejected-week.json"'));
    expect(screen.getByRole("alert").textContent).toContain("Your existing draft has been kept.");
    expect(input().value).toBe(draft);
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Import weekly plan" })).toBeNull();
    if (kind === "oversized") { expect(text).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain("262144 bytes"); }
    fireEvent.click(screen.getByRole("button", { name: "Validate and preview" }));
    expect(screen.getByRole("region", { name: "Weekly plan preview" })).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
  });
  it("retains edited invalid pasted text after validation", () => {
    const { onImport } = setup();
    fireEvent.change(input(), { target: { value: "my unfinished draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate and preview" }));
    expect(input().value).toBe("my unfinished draft");
    expect(screen.getByRole("heading", { name: "Could not validate this weekly plan" })).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
  });
  it.each(["edit", "new file", "close"])("ignores a delayed read after %s", async action => {
    const view = setup();
    let resolve!: (text: string) => void;
    const file = new File([""], "old.json");
    Object.defineProperty(file, "text", { value: () => new Promise<string>(done => { resolve = done; }) });
    choose(file);
    if (action === "edit") fireEvent.change(input(), { target: { value: "newer edited draft" } });
    if (action === "new file") choose(new File(["x".repeat(262145)], "new.json"));
    if (action === "close") {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      view.unmount();
      render(<WeeklyPracticeImportDialog createId={factory()} library={library} onCancel={vi.fn()} onImport={view.onImport} />);
    }
    await act(async () => resolve(draft));
    expect(input().value).toBe(action === "edit" ? "newer edited draft" : action === "close" ? "" : draft);
    if (action === "new file") expect(screen.getByRole("alert").textContent).toContain('"new.json"');
    expect(view.onImport).not.toHaveBeenCalled();
  });
  it("accepts a valid file at the exact byte limit without importing", async () => {
    const { onImport } = setup();
    const content = draft + " ".repeat(262144 - new Blob([draft]).size);
    const file = new File([content], "limit.json");
    Object.defineProperty(file, "text", { value: async () => content });
    choose(file);
    await waitFor(() => expect(input().value).toBe(content));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
  });
});
