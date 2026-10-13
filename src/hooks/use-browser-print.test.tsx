import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserPrint } from "./use-browser-print";

function Print({ active = true, title = "hallelujah_001", complete = vi.fn() }: { active?: boolean; title?: string; complete?: () => void }) {
  useBrowserPrint(active, complete, title);
  return <div>Feature-owned report</div>;
}
beforeEach(() => { vi.useFakeTimers(); document.title = "Prelude: MIDI Mentor"; vi.stubGlobal("print", vi.fn()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const invoke = () => act(() => vi.advanceTimersByTime(0));

describe("owned temporary browser print titles", () => {
  it("waits for content and applies the title only at print, restoring after cancellation/afterprint", () => {
    const complete = vi.fn();
    vi.mocked(window.print).mockImplementation(() => { expect(document.title).toBe("hallelujah_001"); expect(document.body.textContent).toContain("Feature-owned report"); });
    render(<Print complete={complete} />);
    expect(document.title).toBe("Prelude: MIDI Mentor"); invoke();
    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(document.title).toBe("Prelude: MIDI Mentor"); expect(complete).toHaveBeenCalledOnce();
    act(() => vi.runAllTimers()); expect(complete).toHaveBeenCalledOnce();
  });
  it("does not arm a stale fallback after synchronous afterprint", () => {
    const complete = vi.fn(); vi.mocked(window.print).mockImplementation(() => window.dispatchEvent(new Event("afterprint")));
    render(<Print complete={complete} />); invoke();
    expect(document.title).toBe("Prelude: MIDI Mentor"); expect(complete).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("restores the title and completes once when print throws", () => {
    const complete = vi.fn(); vi.mocked(window.print).mockImplementation(() => { throw new Error("print blocked"); });
    render(<Print complete={complete} />); invoke();
    expect(document.title).toBe("Prelude: MIDI Mentor"); expect(complete).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("restores on the existing fallback and supports another print activation", () => {
    const complete = vi.fn(), view = render(<Print complete={complete} />); invoke();
    expect(document.title).toBe("hallelujah_001"); act(() => vi.advanceTimersByTime(1000));
    expect(document.title).toBe("Prelude: MIDI Mentor"); expect(complete).toHaveBeenCalledOnce();
    view.rerender(<Print active={false} complete={complete} />); view.rerender(<Print title="bells_001" complete={complete} />); invoke();
    expect(document.title).toBe("bells_001"); view.unmount(); expect(document.title).toBe("Prelude: MIDI Mentor"); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([false, true])("cleans Strict Mode unmount before/after print: %s", started => {
    const complete = vi.fn(), view = render(<StrictMode><Print complete={complete} /></StrictMode>);
    if (started) invoke(); view.unmount(); act(() => vi.runAllTimers());
    expect(document.title).toBe("Prelude: MIDI Mentor"); expect(window.print).toHaveBeenCalledTimes(started ? 1 : 0); expect(complete).not.toHaveBeenCalled();
  });
  it.each(["pagehide", "pageshow", "freeze"])("restores on %s and fences later callbacks", event => {
    const complete = vi.fn(); render(<Print complete={complete} />); invoke();
    act(() => (event === "freeze" ? document : window).dispatchEvent(new Event(event)));
    expect(document.title).toBe("Prelude: MIDI Mentor"); act(() => window.dispatchEvent(new Event("afterprint"))); act(() => vi.runAllTimers());
    expect(complete).toHaveBeenCalledOnce();
  });
  it("restores when print media exits and removes its listener", () => {
    const media = new EventTarget(); const remove = vi.spyOn(media, "removeEventListener"); vi.stubGlobal("matchMedia", vi.fn(() => media));
    const complete = vi.fn(), view = render(<Print complete={complete} />); invoke();
    act(() => media.dispatchEvent(Object.assign(new Event("change"), { matches: true })));
    expect(document.title).toBe("hallelujah_001");
    act(() => media.dispatchEvent(Object.assign(new Event("change"), { matches: false })));
    expect(document.title).toBe("Prelude: MIDI Mentor"); expect(complete).toHaveBeenCalledOnce(); view.unmount(); expect(remove).toHaveBeenCalled();
  });
  it("prevents an old cleanup from overwriting a newer owner's title or restoring the old print title", () => {
    const first = render(<Print title="first_001" />); invoke();
    const second = render(<Print title="second_001" />); invoke();
    first.unmount(); expect(document.title).toBe("second_001");
    second.unmount(); expect(document.title).toBe("Prelude: MIDI Mentor");
  });
  it("preserves an independently changed application title", () => {
    const view = render(<Print />); invoke(); document.title = "New application title";
    view.unmount(); expect(document.title).toBe("New application title");
  });
});
