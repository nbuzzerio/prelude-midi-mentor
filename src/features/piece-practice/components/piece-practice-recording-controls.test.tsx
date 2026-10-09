import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PiecePracticeRecordingControls } from "./piece-practice-recording-controls";
import type { RecordingSegment, RecordingSnapshot } from "../piece-practice-recording";

afterEach(cleanup);
const segment: RecordingSegment = {
  ownerInstanceId: "owner", runId: "run", analysisSessionId: "analysis", sequence: 1, captureGeneration: 2,
  startedAt: "2026-10-09T14:30:00.000Z", startedAtMs: 1000, endedAtMs: 5000, durationMs: 4000,
  size: 5000, mimeType: "audio/webm;codecs=opus", filename: "prelude-violin-run-segment-001.webm",
  blob: new Blob(["audio"]), url: "blob:test",
};
const recording = (changes: Partial<RecordingSnapshot> = {}) => ({
  enabled: false, phase: "off" as const, message: "Performance recording off.", elapsedMs: 0,
  segments: [] as RecordingSegment[], retainedBytes: 0, limitReached: false, setEnabled: vi.fn(), ...changes,
});

describe("performance recording controls", () => {
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
    const download = screen.getByRole("link", { name: "Download segment 1" }) as HTMLAnchorElement;
    expect(download.download).toBe(segment.filename);
    expect(download.href).toBe(segment.url);
  });
});
