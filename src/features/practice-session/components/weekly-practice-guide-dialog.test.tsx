import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWeeklyPracticeLlmSpecification } from "../import/weekly-practice-specification";
import WeeklyPracticeGuideDialog from "./weekly-practice-guide-dialog";

afterEach(cleanup);

describe("Weekly Practice AI guide dialog", () => {
  it("copies the canonical generated guide repeatedly and announces success without closing", async () => {
    const writeText = vi.fn(async () => undefined); const onClose = vi.fn();
    render(<WeeklyPracticeGuideDialog onClose={onClose} writeText={writeText} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Generate a plan with AI" }));
    const copy = screen.getByRole("button", { name: "Copy for AI" }); fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(createWeeklyPracticeLlmSpecification()));
    expect(screen.getByRole("status").textContent).toContain("paste this into your AI chat"); expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(copy); await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2)); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the exact guide available for manual copying after failure and permits retry", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce(undefined);
    render(<WeeklyPracticeGuideDialog onClose={vi.fn()} writeText={writeText} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
    const fallback = await screen.findByRole("textbox", { name: "Prelude generation guide" }) as HTMLTextAreaElement;
    expect(fallback.value).toBe(createWeeklyPracticeLlmSpecification()); expect(document.activeElement).toBe(fallback); expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy()); expect(writeText).toHaveBeenCalledTimes(2); expect(screen.queryByRole("textbox", { name: "Prelude generation guide" })).toBeNull();
  });

  it("contains focus in both directions and preserves Escape cancellation", () => {
    const onClose = vi.fn(); render(<WeeklyPracticeGuideDialog onClose={onClose} writeText={vi.fn(async () => undefined)} />);
    const heading = screen.getByRole("heading", { name: "Generate a plan with AI" }); const copy = screen.getByRole("button", { name: "Copy for AI" }); const close = screen.getByRole("button", { name: "Close" });
    fireEvent.keyDown(heading, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab" }); expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(copy, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(close);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); expect(onClose).toHaveBeenCalledOnce();
  });
});
