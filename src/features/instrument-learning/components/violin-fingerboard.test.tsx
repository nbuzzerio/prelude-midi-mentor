import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { describeFrequency, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { InstrumentPitchContext } from "../instrument-pitch-context";
import { ViolinFingerboard } from "./violin-fingerboard";

afterEach(cleanup);
const frame = (midi = 62, label = "D4", detected = 64): InstrumentPitchContext => ({ expected: { semitone: midi, label },
  live: { state: "live", pitch: describeFrequency(equalTemperedFrequency(detected)) },
  pitchLabels: { 55: "G3", 60: "C4", 61: "D♭4", 62: label, 63: "E♭4", 64: "E4", 65: "F4", 76: "E5" } });
const marker = (container: HTMLElement, kind: string) => container.querySelector(`[data-violin-marker="${kind}"]`);

describe("advisory violin fingerboard", () => {
  it("identifies continuous strings, orientation, default suggestion and distinct expected/live shapes", () => {
    const { container } = render(<ViolinFingerboard context={frame()} />);
    expect(screen.getByRole("img", { name: /Advisory violin first-position fingerboard/ })).toBeTruthy();
    for (const note of ["G3", "D4", "A4", "E5"]) expect(container.querySelector("svg")!.textContent).toContain(note);
    expect(screen.getByText("Nut · open strings")).toBeTruthy(); expect(screen.getByText(/Bridge · pitch rises/)).toBeTruthy();
    expect(screen.getByLabelText("Diagram string assumption").textContent).toBe("Suggested string: D");
    expect(marker(container, "expected")?.querySelector("path")).toBeTruthy(); expect(marker(container, "live")?.querySelector("circle")).toBeTruthy();
    expect(container.querySelectorAll("[data-violin-sticker]")).toHaveLength(32);
    expect(container.querySelectorAll("[aria-live], [role=status]")).toHaveLength(0);
  });
  it("switches to a supported fourth-finger alternate and preserves explicit selection across targets", () => {
    const s = render(<ViolinFingerboard context={frame()} />);
    fireEvent.click(screen.getByRole("button", { name: "Use G string · finger 4" }));
    expect(screen.getByLabelText("Diagram string assumption").textContent).toBe("User-selected string: G");
    expect(marker(s.container, "expected")?.getAttribute("data-string")).toBe("G");
    s.rerender(<ViolinFingerboard context={frame(76, "E5")} />);
    expect(marker(s.container, "expected")).toBeNull();
    expect(screen.getByText(/Selected G string cannot produce this pitch/)).toBeTruthy();
    expect((screen.getByLabelText("String for diagram") as HTMLSelectElement).value).toBe("G");
  });
  it("preserves authored enharmonics for the expected marker, live label and stickers", () => {
    const s = render(<ViolinFingerboard context={frame(63, "E♭4", 63)} />);
    expect(screen.getByLabelText("Expected fingerboard position").textContent).toContain("Expected: E♭4");
    expect(screen.getByLabelText("Live fingerboard position").textContent).toContain("Live pitch: E♭4");
    expect(s.container.querySelector('[data-violin-sticker="D:1"]')!.textContent).toBe("E♭4");
    expect(marker(s.container, "expected")!.textContent).toContain("E♭4");
    fireEvent.click(screen.getByRole("checkbox", { name: "Show pitch-name stickers" }));
    expect(s.container.querySelectorAll("[data-violin-sticker]")).toHaveLength(0);
    expect(marker(s.container, "expected")).not.toBeNull();
  });
  it.each([
    [58, "B♭3", "G:3"], [61, "D♭4", "G:6"], [63, "E♭4", "D:1"],
    [70, "B♭4", "A:1"], [75, "E♭5", "A:6"], [82, "B♭5", "E:6"],
  ] as const)("uses context spelling %s / %s throughout the diagram", (midi, label, sticker) => {
    const context = frame(midi, label, midi);
    const s = render(<ViolinFingerboard context={{ ...context, pitchLabels: { ...context.pitchLabels, [midi]: label } }} />);
    expect(screen.getByLabelText("Expected fingerboard position").textContent).toContain(label);
    expect(screen.getByLabelText("Live fingerboard position").textContent).toContain(label);
    expect(s.container.querySelector(`[data-violin-sticker="${sticker}"]`)?.textContent).toBe(label);
  });
  it.each(["uncertain", "stale", "absent"] as const)("removes the live marker for %s while preserving the expected marker", (state) => {
    const s = render(<ViolinFingerboard context={frame()} />);
    s.rerender(<ViolinFingerboard context={{ ...frame(), live: { state, pitch: frame().live.pitch } }} />);
    expect(marker(s.container, "live")).toBeNull(); expect(marker(s.container, "expected")).not.toBeNull();
    expect(screen.getByLabelText("Live fingerboard position").textContent).toContain("no live position shown");
  });
  it("keeps live detection independent from expected position with no acceptance acknowledgment", () => {
    const s = render(<ViolinFingerboard context={frame()} />); const expected = marker(s.container, "expected")!.getAttribute("transform");
    s.rerender(<ViolinFingerboard context={frame(62, "D4", 65)} />);
    expect(marker(s.container, "expected")!.getAttribute("transform")).toBe(expected);
    expect(marker(s.container, "live")!.getAttribute("data-midi")).toBe("65");
    expect(screen.queryByText(/✓.*accepted/)).toBeNull();
    expect(screen.getByText(/microphone cannot identify your actual string or finger/)).toBeTruthy();
  });
  it("shows unsupported target/selected string and possible harmonic honestly", () => {
    const s = render(<ViolinFingerboard context={frame(84, "C6", 83)} />);
    expect(screen.getByText(/outside the modeled first-position guide/)).toBeTruthy(); expect(marker(s.container, "expected")).toBeNull();
    s.rerender(<ViolinFingerboard context={frame(76, "E5", 64)} />);
    fireEvent.change(screen.getByLabelText("String for diagram"), { target: { value: "D" } });
    expect(screen.getByText(/Possible harmonic or different note/)).toBeTruthy(); expect(marker(s.container, "live")).toBeNull();
    expect(screen.getByText(/Selected D string cannot produce/)).toBeTruthy();
  });
});
