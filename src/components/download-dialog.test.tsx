import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadDialog } from "./download-dialog";
import type { DownloadSnapshot } from "@/lib/files/browser-download";

afterEach(cleanup);
const snapshot: DownloadSnapshot = Object.freeze({ name: "Bells of Notre Dame", blob: new Blob(["original evidence"], { type: "audio/midi" }),
  extension: "mid", fallback: "improv", format: "MIDI file", detail: "Take 8. Original-first identity is unchanged." });

describe("shared download dialog", () => {
  it("focuses Name, fixes the format, and starts at 001 independently of Take 8", () => {
    render(<StrictMode><DownloadDialog snapshot={snapshot} onCancel={vi.fn()} onRequested={vi.fn()} /></StrictMode>);
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect((screen.getByLabelText("Number") as HTMLInputElement).value).toBe("001");
    expect((screen.getByLabelText("Format") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByLabelText("Filename preview").textContent).toBe("bells_of_notre_dame_001.mid");
    expect(screen.getByText(/Take 8/)).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });
  it("delivers the exact captured Blob after name/number edits and parent changes", () => {
    const deliver = vi.fn(), requested = vi.fn(), replacementDelivery = vi.fn(), replacementRequested = vi.fn();
    const view = render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={vi.fn()} onRequested={requested} />);
    view.rerender(<DownloadDialog snapshot={{ ...snapshot, name: "replacement", blob: new Blob(["later take"]) }} deliver={replacementDelivery} onCancel={vi.fn()} onRequested={replacementRequested} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Étude / 日本語" } });
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(deliver).toHaveBeenCalledExactlyOnceWith(snapshot.blob, "étude_日本語_007.mid");
    expect(requested).toHaveBeenCalledExactlyOnceWith("étude_日本語_007.mid");
    expect(replacementDelivery).not.toHaveBeenCalled(); expect(replacementRequested).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download" })); expect(deliver).toHaveBeenCalledOnce();
  });
  it("blocks 000 and invalid input, allows an empty name fallback, and uses a fixed extension", () => {
    const deliver = vi.fn(); render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={vi.fn()} onRequested={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "000" } });
    expect((screen.getByRole("button", { name: "Download" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!); expect(deliver).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "999" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } });
    expect(screen.getByLabelText("Filename preview").textContent).toBe("improv_999.mid");
  });
  it("cancel, Escape and unmount perform no delivery or object-URL creation and restore focus", () => {
    const opener = document.createElement("button"); document.body.append(opener); opener.focus();
    const deliver = vi.fn(), cancel = vi.fn();
    const view = render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={cancel} onRequested={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Escape" });
    expect(cancel).toHaveBeenCalledTimes(2); expect(deliver).not.toHaveBeenCalled();
    view.unmount(); expect(document.activeElement).toBe(opener); opener.remove();
  });
  it("retains the frozen export on delivery failure and allows retry", () => {
    const deliver = vi.fn().mockImplementationOnce(() => { throw Error("blocked"); }), requested = vi.fn();
    render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={vi.fn()} onRequested={requested} />);
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(screen.getByRole("alert").textContent).toMatch(/original export is retained/); expect(requested).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(deliver).toHaveBeenLastCalledWith(snapshot.blob, "bells_of_notre_dame_001.mid"); expect(requested).toHaveBeenCalledOnce();
  });
});
