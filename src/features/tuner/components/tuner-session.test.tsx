import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureStatus } from "../microphone-capture";
import type { TunerSnapshot } from "../pitch-stabilizer";
import TunerSession from "./tuner-session";

const mock = vi.hoisted(() => ({ status: { state: "idle", message: "Microphone off." } as CaptureStatus,
  reading: { state: "listening", pitch: null, fresh: false, ageMs: null } as TunerSnapshot, start: vi.fn(), stop: vi.fn() }));
vi.mock("../hooks/use-tuner", () => ({ useTuner: () => mock }));
beforeEach(() => { mock.status = { state: "idle", message: "Microphone off." }; mock.reading = { state: "listening", pitch: null, fresh: false, ageMs: null }; vi.clearAllMocks(); });
afterEach(cleanup);
describe("chromatic tuner presentation", () => {
  it("offers Start and never claims an idle pitch", () => {
    render(<TunerSession />); fireEvent.click(screen.getByRole("button", { name: "Start Listening" }));
    expect(mock.start).toHaveBeenCalledOnce(); expect(screen.getByText("No credible pitch yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop Listening" }).hasAttribute("disabled")).toBe(true);
  });
  it("keeps Stop available while permission is pending", () => {
    mock.status = { state: "requesting", message: "Stop Listening cancels Prelude's pending startup; the browser permission prompt may remain visible." }; render(<TunerSession />);
    expect(screen.getByRole("status").textContent).toContain("Prelude's pending startup");
    expect(screen.getByRole("status").textContent).toContain("browser permission prompt may remain visible");
    fireEvent.click(screen.getByRole("button", { name: "Stop Listening" })); expect(mock.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Start Listening" }).hasAttribute("disabled")).toBe(true);
  });
  it("shows stable A4, Hz, signed cents and an accessible meter without live numeric announcements", () => {
    mock.status = { state: "listening", message: "Microphone active." };
    mock.reading = { state: "stable", pitch: { semitone: 69, frequencyHz: 442 }, fresh: true, ageMs: 10 };
    render(<TunerSession />); expect(screen.getByText("Stable")).toBeTruthy(); expect(screen.getByText("A4")).toBeTruthy();
    expect(screen.getByText("442.0 Hz")).toBeTruthy(); expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toContain("Sharp");
    expect(screen.getByRole("meter").closest('[aria-live]')).toBeNull();
  });
  it("labels retained pitch uncertain and clears its numerical display", () => {
    mock.status = { state: "listening", message: "Microphone active." };
    mock.reading = { state: "uncertain", pitch: { semitone: 69, frequencyHz: 438 }, fresh: false, ageMs: 140 };
    const view = render(<TunerSession />); expect(screen.getByText("Uncertain — last reading")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toContain("uncertain last reading");
    mock.reading = { ...mock.reading, pitch: null }; view.rerender(<TunerSession />); expect(screen.queryByText("A4")).toBeNull();
  });
  it("shows permission guidance and leaves retry available", () => {
    mock.status = { state: "denied", message: "Allow microphone access in browser settings." }; render(<TunerSession />);
    expect(screen.getByRole("status").textContent).toContain("browser settings"); expect(screen.getByRole("button", { name: "Start Listening" }).hasAttribute("disabled")).toBe(false);
  });
  it("blocks listening during an active Practice Session", () => {
    render(<TunerSession available={false} />); expect(screen.getByText("End the active Practice Session before listening.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Listening" }).hasAttribute("disabled")).toBe(true);
  });
});
