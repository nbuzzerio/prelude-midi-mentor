import { afterEach, describe, expect, it, vi } from "vitest";
import { requestBrowserDownload } from "./browser-download";

afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("normal browser Blob delivery", () => {
  it.each(["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/midi", "application/json"])("delivers unchanged bytes and MIME %s", async type => {
    vi.useFakeTimers();
    const bytes = new Uint8Array([0, 255, 77, 84, 104, 100, 10]);
    const blob = new Blob([bytes], { type });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("étude_007.mid"); expect(this.isConnected).toBe(true);
    });
    requestBrowserDownload(blob, "étude_007.mid");
    expect(create).toHaveBeenCalledExactlyOnceWith(blob);
    expect(blob.type).toBe(type); expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
    expect(document.querySelector("a[download]")).toBeNull(); expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:export");
  });
  it("releases a URL even if appending the anchor fails", () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:failed");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document.body, "append").mockImplementation(() => { throw Error("blocked"); });
    expect(() => requestBrowserDownload(new Blob(), "backup_001.json")).toThrow("blocked");
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:failed"); expect(vi.getTimerCount()).toBe(0);
  });
});
