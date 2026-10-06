import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsNewModal } from "./whats-new-modal";
import type { AppUpdate } from "../app-updates";

const updates: readonly AppUpdate[] = [3, 2].map((sequence) => ({ id: `update-${sequence}`, sequence, title: `Update ${sequence}`, date: "2026-10-05", changes: [`Change ${sequence}`] }));
beforeEach(() => {
  // jsdom has no native top-layer dialog support; device/browser QA verifies it.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.setAttribute("open", ""); }) });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.removeAttribute("open"); }) });
});
afterEach(() => { cleanup(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); vi.restoreAllMocks(); });

function Fixture({ acknowledge }: { acknowledge: () => void }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} type="button">Show updates</button>{open && <WhatsNewModal updates={updates} onAcknowledge={() => { acknowledge(); setOpen(false); }} />}</>;
}
function open(acknowledge = vi.fn()) {
  render(<Fixture acknowledge={acknowledge} />);
  const trigger = screen.getByRole("button", { name: "Show updates" }); trigger.focus(); fireEvent.click(trigger);
  return { acknowledge, trigger, dialog: screen.getByRole("dialog", { name: "What's New in Prelude" }) };
}

describe("What's New modal", () => {
  it("uses a labelled native modal, focuses its heading and shows multiple sections newest first", () => {
    const { acknowledge, dialog } = open();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "What's New in Prelude" }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Update 3", "Update 2"]);
    expect(acknowledge).not.toHaveBeenCalled();
  });
  it("contains Tab and Shift+Tab across initial heading and actions", () => {
    const { dialog } = open();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Got it" }));
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close What's New" }));
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Got it" }));
  });
  it.each(["Got it", "Close What's New", "Escape"])("acknowledges through %s and restores previous focus", (action) => {
    const { acknowledge, trigger, dialog } = open();
    if (action === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: action }));
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it("does not acknowledge a click on the dialog/backdrop area", () => {
    const { acknowledge, dialog } = open();
    fireEvent.click(dialog); expect(acknowledge).not.toHaveBeenCalled(); expect(dialog.hasAttribute("open")).toBe(true);
  });
  it("acknowledges a native cancel event", () => {
    const { acknowledge, dialog } = open();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(acknowledge).toHaveBeenCalledOnce();
  });
  it("keeps window shortcuts from interacting with background features", () => {
    const listener = vi.fn(); window.addEventListener("keydown", listener);
    try {
      const { dialog } = open();
      fireEvent.keyDown(dialog, { key: "f" });
      expect(listener).not.toHaveBeenCalled();
    } finally { window.removeEventListener("keydown", listener); }
  });
});
