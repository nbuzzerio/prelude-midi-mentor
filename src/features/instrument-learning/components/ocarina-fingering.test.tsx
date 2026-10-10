import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OcarinaFingeringGuide } from "./ocarina-fingering";
import { OCARINA_HOLES, OCARINA_PROFILE } from "../ocarina-fingering";
import type { InstrumentPitchContext } from "../instrument-pitch-context";
import { describeFrequency, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";

const frame = (midi = 76, label = "E5", detected = 74): InstrumentPitchContext => ({ expected: { semitone: midi, label },
  live: { state: "live", pitch: describeFrequency(equalTemperedFrequency(detected)) }, pitchLabels: { 74: "D5", 75: "E♭5", 76: "E5", 77: "F5" } });
afterEach(cleanup);

describe("advisory ocarina fingering diagrams", () => {
  it("exposes readable FRONT/BACK states, hand orientation, subholes and a non-color legend", () => {
    const { container } = render(<OcarinaFingeringGuide context={frame()} />);
    const front = screen.getByRole("img", { name: /Front ocarina fingering/ }), back = screen.getByRole("img", { name: /Back ocarina thumb holes/ });
    expect(front.querySelectorAll("[data-ocarina-hole]")).toHaveLength(10);
    expect(back.querySelectorAll("[data-ocarina-hole]")).toHaveLength(2);
    expect(front.textContent).toContain("left index: cover"); expect(front.textContent).toContain("right ring: open");
    expect(back.textContent).toContain("left thumb: cover"); expect(back.textContent).toContain("right thumb: cover");
    expect(screen.getByText(/Player’s hand order/).textContent).toContain("left on left in both");
    expect(screen.getByText(/Filled = cover/)).toBeTruthy();
    expect(container.querySelector('[data-ocarina-hole="LI"] circle')?.getAttribute("fill")).toBe("#fafafa");
    expect(container.querySelector('[data-ocarina-hole="RR"] circle')?.getAttribute("fill")).toBe("#18181b");
    expect(Number(container.querySelector('[data-ocarina-hole="SL"] circle')?.getAttribute("r"))).toBeLessThan(Number(container.querySelector('[data-ocarina-hole="LM"] circle')?.getAttribute("r")));
    expect(screen.getByLabelText("Expected hole states").textContent).toContain("Open: RR, RP, SL, SR");
    expect(screen.getByLabelText("Expected ocarina fingering").textContent).toContain("ring and pinky");
    expect(screen.getByText("Fingering profile and details").closest("details")!.open).toBe(false);
    expect(screen.getByText(/Pitch only: the microphone cannot identify your actual covered holes/)).toBeTruthy();
    expect(container.querySelectorAll('[role="status"], [aria-live]')).toHaveLength(0);
  });
  it.each(OCARINA_PROFILE.fingerings)("renders every logical hole state for $note", (fingering) => {
    const { container } = render(<OcarinaFingeringGuide context={frame(fingering.semitone, fingering.note)} />);
    for (const { id } of OCARINA_HOLES) expect(container.querySelector(`[data-ocarina-hole="${id}"]`)?.getAttribute("data-state")).toBe(fingering.covered[id] ? "cover" : "open");
  });
  it("shows unsupported authored accidentals normally without an invented diagram or transposition", () => {
    const { container } = render(<OcarinaFingeringGuide context={frame(75, "E♭5", 75)} />);
    expect(screen.getByLabelText("Expected ocarina fingering").textContent).toContain("Expected E♭5");
    expect(screen.getByText(/Your written target is unchanged/)).toBeTruthy();
    expect(container.querySelectorAll('[data-state="unavailable"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-state="cover"], [data-state="open"]')).toHaveLength(0);
    expect(screen.queryByLabelText("Expected hole states")).toBeNull();
    expect(screen.getByLabelText("Live ocarina fingering suggestion").textContent).toContain("E♭5");
    expect(screen.getByLabelText("Live ocarina fingering suggestion").hasAttribute("data-ocarina-live")).toBe(false);
  });
  it("keeps expected state stable as live pitch changes, with authored enharmonic labels", () => {
    const s = render(<OcarinaFingeringGuide context={frame(76, "F♭5")} />);
    const before = screen.getByLabelText("Expected hole states").textContent;
    s.rerender(<OcarinaFingeringGuide context={{ ...frame(76, "F♭5", 77), pitchLabels: { 77: "E♯5" } }} />);
    expect(screen.getByLabelText("Expected hole states").textContent).toBe(before);
    expect(screen.getByLabelText("Expected ocarina fingering").textContent).toContain("F♭5");
    expect(screen.getByLabelText("Live ocarina fingering suggestion").textContent).toContain("E♯5");
    expect(screen.queryByLabelText("Accepted pitch/attack")).toBeNull();
  });
  it.each(["stale", "uncertain", "absent"] as const)("removes %s live suggestions while preserving expected coverage", (state) => {
    const s = render(<OcarinaFingeringGuide context={frame()} />);
    s.rerender(<OcarinaFingeringGuide context={{ ...frame(), live: { ...frame().live, state } }} />);
    expect(screen.getByLabelText("Live ocarina fingering suggestion").hasAttribute("data-ocarina-live")).toBe(false);
    expect(screen.getByLabelText("Live ocarina fingering suggestion").textContent).toContain("no live fingering");
    expect(screen.getByLabelText("Expected ocarina fingering").getAttribute("data-ocarina-expected")).toBe("76");
  });
  it("does not imply a fingering when a rest measure has no target", () => {
    render(<OcarinaFingeringGuide context={{ ...frame(), expected: null }} />);
    expect(screen.getByText(/No current target/)).toBeTruthy();
    expect(screen.queryByLabelText("Expected hole states")).toBeNull();
  });
});
