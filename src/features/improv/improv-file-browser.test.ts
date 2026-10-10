import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadImprovBlob } from "./improv-file-browser";

const revoke = vi.fn();
beforeEach(() => {
  vi.useFakeTimers(); let id = 0;
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => `blob:take-${++id}`), revokeObjectURL: revoke });
  revoke.mockClear(); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Improv download resources", () => {
  it("preserves the filename and removes the anchor while leaving the URL valid for one second", () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("original take.mid"); expect(this.href).toBe("blob:take-1"); expect(this.isConnected).toBe(true);
    });
    downloadImprovBlob(new Blob(), "original take.mid");
    expect(document.querySelector("a[download]")).toBeNull(); expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999); expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:take-1"); expect(vi.getTimerCount()).toBe(0);
  });
  it("immediately releases the URL and removes the anchor when clicking throws", () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => { throw new Error("click failed"); });
    expect(() => downloadImprovBlob(new Blob(), "take.mid")).toThrow("click failed");
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:take-1"); expect(document.querySelector("a[download]")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("releases the URL when anchor creation fails", () => {
    vi.spyOn(document, "createElement").mockImplementation(() => { throw new Error("DOM failed"); });
    expect(() => downloadImprovBlob(new Blob(), "take.mid")).toThrow("DOM failed");
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:take-1"); expect(vi.getTimerCount()).toBe(0);
  });
  it("releases every repeated download exactly once without retaining timers", () => {
    for (let i = 0; i < 20; i++) { downloadImprovBlob(new Blob(), `take-${i}.mid`); vi.advanceTimersByTime(10); }
    expect(revoke).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledTimes(20); expect(new Set(revoke.mock.calls.map(([url]) => url)).size).toBe(20);
    expect(vi.getTimerCount()).toBe(0); expect(document.querySelector("a[download]")).toBeNull();
  });
  it("finishes cleanup after the initiating component unmounts", () => {
    const view = render(createElement("button", { onClick: () => downloadImprovBlob(new Blob(), "take.mid") }, "Download"));
    fireEvent.click(view.getByRole("button")); view.unmount(); expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:take-1"); expect(vi.getTimerCount()).toBe(0);
  });
});
