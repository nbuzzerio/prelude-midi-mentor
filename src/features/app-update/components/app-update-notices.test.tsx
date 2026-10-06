import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PwaUpdateController, PwaUpdateSnapshot } from "@/lib/pwa/register-service-worker";
import { AppUpdateNotices } from "./app-update-notices";
import { APP_UPDATES } from "../app-updates";

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => { cleanup(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); });

function pwa() {
  let snapshot: PwaUpdateSnapshot = { updateId: 0, available: false, activated: false, updating: false, error: null };
  const listeners = new Set<() => void>();
  const controller: PwaUpdateController = { getSnapshot: () => snapshot, subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, requestReload: vi.fn(async () => {}), checkForUpdates: vi.fn(async () => {}), dispose: vi.fn() };
  return { controller, publish(patch: Partial<PwaUpdateSnapshot>) { act(() => { snapshot = { ...snapshot, ...patch }; listeners.forEach((listener) => listener()); }); } };
}

describe("app update notices", () => {
  it("notifies without stealing focus, and Later retains a reachable choice without requesting activation", () => {
    const { controller, publish } = pwa();
    render(<><button type="button">Practice control</button><AppUpdateNotices controller={controller} updates={[]} storage={null} /></>);
    const practice = screen.getByRole("button", { name: "Practice control" }); practice.focus();
    publish({ updateId: 1, available: true });
    expect(document.activeElement).toBe(practice);
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
    const deferred = screen.getByRole("button", { name: "Update ready" });
    expect(document.activeElement).toBe(deferred);
    expect(controller.requestReload).not.toHaveBeenCalled();
    publish({ activated: true });
    expect(screen.getByRole("button", { name: "Update ready" })).toBe(deferred);
    expect(controller.requestReload).not.toHaveBeenCalled();
    fireEvent.click(deferred);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reload" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(controller.requestReload).toHaveBeenCalledOnce();
  });
  it("opens notes for first use and acknowledges only after dismissal", () => {
    const storage = { getItem: () => null, setItem: vi.fn() };
    render(<AppUpdateNotices storage={storage} />);
    expect(screen.getByRole("dialog", { name: "What's New in Prelude" })).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(storage.setItem).toHaveBeenCalledOnce();
  });
  it("does not open notes for an acknowledged update", () => {
    render(<AppUpdateNotices storage={{ getItem: () => JSON.stringify({ id: APP_UPDATES[0]!.id, sequence: 1 }), setItem: vi.fn() }} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("shows activation failure without hiding the user-controlled retry", () => {
    const { controller, publish } = pwa(); render(<AppUpdateNotices controller={controller} updates={[]} storage={null} />);
    publish({ updateId: 1, available: true, error: "Could not activate. Try again." });
    expect(screen.getByRole("alert").textContent).toContain("Try again");
    expect((screen.getByRole("button", { name: "Reload" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
