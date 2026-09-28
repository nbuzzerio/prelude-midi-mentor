import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderLlmSpecification } from "../staff-builder-llm-specification";
import { StaffBuilderGuideDialog, StaffBuilderGuideHelp } from "./staff-builder-guide-dialog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(navigator, "clipboard"); });

describe("Staff Builder AI Authoring Guide dialog", () => {
  it("copies exactly the guide repeatedly and distinguishes current-score copying", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<StaffBuilderGuideDialog onClose={vi.fn()} writeText={writeText} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Staff Builder AI Authoring Guide" }));
    expect(screen.getByText(/Copy Score for AI copies your current piece/)).toBeTruthy();
    const copy = screen.getByRole("button", { name: "Copy for AI" });
    fireEvent.click(copy);
    await screen.findByText("Authoring guide copied.");
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText.mock.calls).toEqual([[createStaffBuilderLlmSpecification()], [createStaffBuilderLlmSpecification()]]);
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("shows exact focused selected read-only fallback, reselects on failure, and retries", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockRejectedValueOnce(new Error("Denied again")).mockResolvedValue(undefined);
    render(<StaffBuilderGuideDialog onClose={vi.fn()} writeText={writeText} />);
    const copy = screen.getByRole("button", { name: "Copy for AI" });
    fireEvent.click(copy);
    const text = await screen.findByRole("textbox", { name: "Staff Builder AI authoring guide text" }) as HTMLTextAreaElement;
    expect(text.value).toBe(createStaffBuilderLlmSpecification());
    expect(text.readOnly).toBe(true);
    expect(document.activeElement).toBe(text);
    expect(text.selectionStart).toBe(0); expect(text.selectionEnd).toBe(text.value.length);
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox")));
    fireEvent.click(copy);
    await screen.findByText("Authoring guide copied.");
    expect(screen.queryByRole("textbox")).toBeNull();
    for (const call of writeText.mock.calls) expect(call).toEqual([createStaffBuilderLlmSpecification()]);
  });

  it("uses manual copying when clipboard API is unavailable", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    render(<StaffBuilderGuideDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(createStaffBuilderLlmSpecification());
  });

  it("prevents concurrent clipboard writes", async () => {
    let resolve!: () => void;
    const writeText = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    render(<StaffBuilderGuideDialog onClose={vi.fn()} writeText={writeText} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
    const copying = screen.getByRole("button", { name: "Copying…" }) as HTMLButtonElement;
    expect(copying.disabled).toBe(true); fireEvent.click(copying);
    expect(writeText).toHaveBeenCalledOnce();
    await act(async () => resolve());
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("contains focus and supports Escape, Close, and focus restoration", () => {
    render(<StaffBuilderGuideHelp />);
    const trigger = screen.getByRole("button", { name: "Staff Builder AI authoring guide" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Staff Builder AI Authoring Guide" });
    const heading = screen.getByRole("heading", { name: "Staff Builder AI Authoring Guide" });
    const preview = screen.getByText("Read the authoring guide");
    const close = screen.getByRole("button", { name: "Close" });
    fireEvent.keyDown(heading, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab" }); expect(document.activeElement).toBe(preview);
    fireEvent.keyDown(preview, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: "Escape" }); expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
});
