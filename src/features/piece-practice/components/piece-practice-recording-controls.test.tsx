import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { exportPreferences } from "@/lib/files/export-preferences";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PiecePracticeRecordingControls, PiecePracticeRecordingNotice } from "./piece-practice-recording-controls";
import type { RecordingSegment, RecordingSnapshot } from "../piece-practice-recording";

afterEach(() => { cleanup(); if (vi.isFakeTimers()) vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
const segment: RecordingSegment = {
  ownerInstanceId: "owner", runId: "run", analysisSessionId: "analysis", sequence: 1, captureGeneration: 2, source: "room-microphone",
  startedAt: "2026-10-09T14:30:00.000Z", startedAtMs: 1000, endedAtMs: 5000, durationMs: 4000,
  size: 5000, mimeType: "audio/webm;codecs=opus", filename: "prelude-violin-run-segment-001.webm",
  blob: new Blob(["audio"]), url: "blob:test",
};
const recording = (changes: Partial<RecordingSnapshot> = {}) => ({
  enabled: false, phase: "off" as const, message: "Performance recording off.", elapsedMs: 0,
  segments: [] as RecordingSegment[], retainedBytes: 0, limitReached: false, setEnabled: vi.fn(), ...changes,
});

describe("performance recording controls", () => {
  it("native saving retains the exact temporary segment and preview while reporting Saved", async () => {
    const directory={kind:"directory" as const,name:"Music",queryPermission:vi.fn().mockResolvedValue("granted"),requestPermission:vi.fn().mockResolvedValue("granted")};
    const writable={write:vi.fn().mockResolvedValue(undefined),close:vi.fn().mockResolvedValue(undefined),abort:vi.fn().mockResolvedValue(undefined)};
    vi.stubGlobal("isSecureContext",true);vi.stubGlobal("showDirectoryPicker",vi.fn().mockResolvedValue(directory));
    vi.stubGlobal("showSaveFilePicker",vi.fn().mockResolvedValue({name:"performance_audio_001.webm",createWritable:async()=>writable}));
    try {
      await exportPreferences.choose();const control=recording({phase:"stopped",segments:[segment]});
      render(<PiecePracticeRecordingControls listening={false} recording={control} />);fireEvent.click(screen.getByText("Performance Recordings (1)"));
      fireEvent.click(screen.getByRole("button",{name:"Download segment 1"}));fireEvent.click(await screen.findByRole("button",{name:"Save As…"}));
      await screen.findByText(/Saved: performance_audio_001.webm/);expect(writable.write).toHaveBeenCalledExactlyOnceWith(segment.blob);
      expect(control.segments[0]).toBe(segment);expect(screen.getByLabelText("Play recording segment 1").getAttribute("src")).toBe(segment.url);
    } finally { cleanup();await act(async()=>{await exportPreferences.forget();});vi.unstubAllGlobals(); }
  });
  it.each([["audio/webm;codecs=opus", "webm"], ["audio/mp4", "m4a"], ["audio/ogg;codecs=opus", "ogg"]])("delivers unchanged %s audio with manual naming independent of Segment 8", async (mimeType, extension) => {
    vi.useFakeTimers();
    const blob = new Blob([new Uint8Array([0, 255, 1, 2])], { type: mimeType });
    const captured = { ...segment, sequence: 8, mimeType, blob };
    const control = recording({ phase: "stopped", segments: [captured] });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) { expect(this.download).toBe(`étude_023.${extension}`); });
    render(<PiecePracticeRecordingControls pieceTitle="Étude" listening={false} recording={control} />);
    fireEvent.click(screen.getByText("Performance Recordings (1)"));
    fireEvent.click(screen.getByRole("button", { name: "Download segment 8" }));
    expect(screen.getByLabelText("Filename preview").textContent).toBe(`étude_001.${extension}`);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download segment 8" }));
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "23" } });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(create).toHaveBeenCalledExactlyOnceWith(blob); expect(control.segments[0]).toBe(captured);
    expect(screen.getByLabelText("Play recording segment 8").getAttribute("src")).toBe(segment.url);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([0, 255, 1, 2]));
    expect(revoke).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:download");
  });
  it.each(["starting", "recording", "finalizing", "limited", "unsupported", "error", "armed", "stopped"] as const)("keeps a compact %s notice separate from recording controls and numeric announcements", (phase) => {
    const view = render(<PiecePracticeRecordingNotice recording={recording({ phase, segments: phase === "stopped" ? [segment] : [] })} />);
    const notice = screen.getByLabelText("Performance audio notice");
    expect(notice.querySelector("[aria-live], [role=status]")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    if (["starting", "recording", "finalizing", "stopped"].includes(phase)) expect(notice.textContent).toContain("Temporary audio");
    view.rerender(<PiecePracticeRecordingNotice recording={recording()} />);
    expect(screen.queryByLabelText("Performance audio notice")).toBeNull();
  });
  it("starts with opt-in Off and keeps the disclosure collapsed", () => {
    const control = recording();
    render(<PiecePracticeRecordingControls listening={false} recording={control} />);
    expect((screen.getByRole("checkbox", { name: "Record performance audio" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Performance Recordings (0)").closest("details")!.open).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Record performance audio" }));
    expect(control.setEnabled).toHaveBeenCalledWith(true);
  });

  it("shows recording status and unsaved warning outside the collapsed disclosure", () => {
    render(<PiecePracticeRecordingControls listening recording={recording({ enabled: true, phase: "recording", elapsedMs: 65_000 })} />);
    const details = screen.getByText("Performance Recordings (0)").closest("details")!;
    expect(details.open).toBe(false);
    expect(screen.getByText("● Recording performance audio").closest("details")).toBeNull();
    expect(screen.getByText(/Audio is temporary/).closest("details")).toBeNull();
    expect(screen.getByLabelText("Captured audio time").textContent).toBe("1:05");
    expect(screen.getByLabelText("Captured audio time").closest("[aria-live]")).toBeNull();
  });

  it("offers separate playback and download after stopping listening", () => {
    const control = recording({ phase: "stopped", segments: [segment] });
    const view = render(<PiecePracticeRecordingControls listening recording={control} />);
    expect(screen.queryByLabelText("Play recording segment 1")).toBeNull();
    expect(screen.getByText("Stop Listening to play back without feeding playback into the microphone.")).toBeTruthy();
    view.rerender(<PiecePracticeRecordingControls listening={false} recording={control} />);
    fireEvent.click(screen.getByText("Performance Recordings (1)"));
    expect(screen.getByLabelText("Play recording segment 1")).toBeTruthy();
    const download = screen.getByRole("button", { name: "Download segment 1" });
    fireEvent.click(download);
    expect(screen.getByLabelText("Filename preview").textContent).toBe("performance_audio_001.webm");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Play recording segment 1").getAttribute("src")).toBe(segment.url);
    expect(control.segments[0]).toBe(segment);
  });

  it("labels piano room audio and headphones limits without invented acoustic analysis", () => {
    render(<PiecePracticeRecordingControls listening={false} recording={recording({ phase: "stopped", segments: [{ ...segment, analysisSessionId: null }] })}
      keyboard={{ status: { state: "idle", message: "Microphone off" }, canRecord: true, resume: vi.fn() }} />);
    expect(screen.getByText(/Recording captures the piano sound heard by your microphone/)).toBeTruthy();
    expect(screen.getByText(/headphones/)).toBeTruthy();
    expect(screen.getByText(/Room microphone/)).toBeTruthy();
    expect(screen.queryByText(/Analysis null/)).toBeNull();
    expect(screen.getByText(/this run.s recording timeline/)).toBeTruthy();
    expect(screen.getByText("Performance Recordings (1)").closest("details")!.open).toBe(false);
  });
});
