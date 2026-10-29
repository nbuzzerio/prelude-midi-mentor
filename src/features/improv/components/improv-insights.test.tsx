// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImprovInsights } from "./improv-insights";
import type { ImprovMusicalInsights } from "../insights/improv-musical-insights";
import { analyzeImprovTake } from "../insights/improv-musical-insights";
import { performanceFixture } from "../improv-test-fixture";

afterEach(cleanup);
function fixture(): ImprovMusicalInsights {
  return {
    version: 1,
    overview: { eventCount: 12, noteAttacks: 6, durationMs: 10_000, knownEnd: true, pauseCount: 1, lowestPitch: 60, highestPitch: 67, meanVelocity: 90, minimumVelocity: 90, maximumVelocity: 90, maximumKeyDownPolyphony: 3,
      pairedNoteCount: 6, meanKeyDownDurationMs: 500, pedalEvents: 2, unmatchedReleases: 0, unreleasedAttacks: 0, pauseCutoffAttacks: 0,
      pitchClassDistribution: [{ pitchClass: 0, label: "C", attacks: 3 }, { pitchClass: 4, label: "E", attacks: 2 }, { pitchClass: 7, label: "G", attacks: 1 }],
      velocityDistribution: { soft: 0, medium: 0, strong: 6 }, rhythm: { pairedInterAttackCount: 5, meanInterAttackMs: 300, minimumInterAttackMs: 0, maximumInterAttackMs: 500 },
      sustain: { initialState: "unknown", observedPedalMessages: 2, downMessages: 1, upMessages: 1 } },
    tonal: { status: "ambiguous", hypotheses: [
      { label: "C major", tonicPitchClass: 0, mode: "major", score: 0.8, coverage: 1 },
      { label: "A minor", tonicPitchClass: 9, mode: "minor", score: 0.79, coverage: 1 },
    ], reasons: ["Relative keys share these pitch classes."] },
    harmony: [{ startMs: 2000, endMs: 3000, label: "C major", kind: "held", evidence: ["C, E and G overlap."] }],
    phrases: [{ startMs: 1000, endMs: 4000, noteAttacks: 6, reason: "A gap separates this phrase." }],
    rests: [{ startMs: 4000, endMs: 5000 }],
    motifs: [{ label: "Figure 1", intervals: [2, 2], rhythmRatios: [1, 1], occurrences: [{ startMs: 6000, endMs: 7000, transpositionSemitones: 0 }, { startMs: 8000, endMs: 9000, transpositionSemitones: 5 }], evidence: ["Repeated interval and relative rhythm pattern."] }],
    limitations: ["Timing follows receipt evidence; key releases do not estimate audible decay."],
    caps: { harmony: 64, phrases: 64, rests: 64, motifs: 12, occurrencesPerMotif: 8, truncated: [] },
  };
}
const callbacks = () => ({ selection: null, onSelect: vi.fn(), onReplay: vi.fn(), playing: false, disabled: false });

describe("musical insights review", () => {
  it("makes measured pitch, rhythm, velocity and unknown initial pedal evidence readable", () => {
    render(<ImprovInsights state={{ status: "ready", insights: fixture() }} {...callbacks()} />);
    fireEvent.click(screen.getByText("Pitch, rhythm, velocity, and sustain evidence"));
    const table = screen.getByRole("table", { name: "Observed pitch-class attacks" });
    expect(within(table).getByRole("row", { name: "C 3" })).toBeTruthy();
    expect(screen.getByText(/5 consecutive attack gaps/)).toBeTruthy();
    expect(screen.getByText(/Mean gap 0.3 s; range 0.0 s to 0.5 s/)).toBeTruthy();
    expect(screen.getByText(/1–42: 0 attacks · 43–84: 0 · 85–127: 6/)).toBeTruthy();
    expect(screen.getByText(/Initial pedal state is unknown. 2 observed CC64 messages/)).toBeTruthy();
    expect(screen.queryByText(/Evidence fit \d+%/)).toBeNull();
  });
  it("presents ambiguous tonal alternatives and evidence without claiming a score", () => {
    render(<ImprovInsights state={{ status: "ready", insights: fixture() }} {...callbacks()} />);
    expect(screen.getByText(/Ambiguous tonal evidence/)).toBeTruthy(); expect(screen.getByText("2. A minor")).toBeTruthy();
    fireEvent.click(screen.getByText("Tonal evidence and alternatives"));
    expect(screen.getByText("Relative keys share these pitch classes.")).toBeTruthy();
    fireEvent.click(screen.getByText("Evidence for C major · held harmony")); expect(screen.getByText("C, E and G overlap.")).toBeTruthy();
    expect(screen.getByText(/No observed keys held in this span. Initial held keys are unknown/)).toBeTruthy();
    expect(screen.getByText(/Weighted natural-minor pitch-class coverage/)).toBeTruthy();
    expect(screen.getByText(/Minor candidates use natural minor/)).toBeTruthy();
    expect(screen.getByText(/Transposition: 5 semitones/)).toBeTruthy();
    expect(screen.getByText(/without a score, accuracy grade, or audio analysis/)).toBeTruthy();
  });
  it("orders textual passages chronologically, moves keyboard focus and separates selection from audio", () => {
    const props = callbacks(); const insights = fixture();
    const view = render(<ImprovInsights state={{ status: "ready", insights }} {...props} />);
    const passages = within(screen.getByRole("list", { name: "Musical passages" })).getAllByRole("button");
    expect(passages[0].textContent).toContain("Possible phrase 1"); expect(passages[1].textContent).toContain("C major");
    passages[0].focus(); fireEvent.keyDown(passages[0], { key: "ArrowDown" }); expect(document.activeElement).toBe(passages[1]);
    fireEvent.keyDown(passages[1], { key: "End" }); expect(document.activeElement).toBe(passages.at(-1));
    fireEvent.keyDown(passages.at(-1)!, { key: "Home" }); expect(document.activeElement).toBe(passages[0]);
    fireEvent.click(passages[1]); expect(props.onReplay).not.toHaveBeenCalled();
    const selection = props.onSelect.mock.calls[0][0]; expect(selection).toMatchObject({ startMs: 2000, endMs: 3000 });
    view.rerender(<ImprovInsights state={{ status: "ready", insights }} {...props} selection={selection} />);
    expect(passages[1].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Replay selected passage" }));
    expect(props.onReplay).toHaveBeenCalledWith({ startMs: 2000, endMs: 3000 });
    expect(screen.getByText(/Notes begun before its start are not retriggered/)).toBeTruthy();
    view.rerender(<ImprovInsights state={{ status: "ready", insights }} {...props} selection={selection} playing />);
    expect((screen.getByRole("button", { name: "Replay selected passage" }) as HTMLButtonElement).disabled).toBe(true);
    expect((passages[1] as HTMLButtonElement).disabled).toBe(true);
  });
  it("bounds the timeline and discloses limited analysis", () => {
    const insights = fixture();
    const many = { ...insights, harmony: [], rests: [], motifs: [], phrases: Array.from({ length: 30 }, (_, i) => ({ startMs: i * 1000, endMs: (i + 1) * 1000, noteAttacks: 3, reason: "Gap boundary" })), caps: { ...insights.caps, truncated: ["phrases"] } };
    render(<ImprovInsights state={{ status: "ready", insights: many }} {...callbacks()} />);
    const list = screen.getByRole("list", { name: "Musical passages" }); expect(within(list).getAllByRole("button")).toHaveLength(12);
    expect(screen.getByText(/Page 1 of 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next passages" })); expect(screen.getByRole("button", { name: /Possible phrase 13/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next passages" })); expect(within(list).getAllByRole("button")).toHaveLength(6);
    expect((screen.getByRole("button", { name: "Next passages" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous passages" })); expect(screen.getByText(/Page 2 of 3/)).toBeTruthy();
    expect(screen.getByText(/Analysis detail limited: phrases/)).toBeTruthy();
  });
  it("keeps real detected figure labels distinct across occurrences, evidence, selection and replay", async () => {
    const messages: { bytes: number[]; receivedAtMs: number }[] = [];
    let at = 200;
    for (const [pitches, gaps] of [
      [[60, 64, 67, 72, 74], [200, 400, 200, 600]],
      [[79, 74, 71, 67, 64], [400, 200, 600, 200]],
      [[62, 66, 69, 74, 76], [200, 400, 200, 600]],
      [[76, 71, 68, 64, 61], [400, 200, 600, 200]],
    ]) {
      pitches.forEach((pitch, i) => {
        messages.push({ bytes: [0x90, pitch, 80], receivedAtMs: at }, { bytes: [0x80, pitch, 0], receivedAtMs: at + 100 });
        at += gaps[i] ?? 1800;
      });
    }
    const { loaded } = await performanceFixture(messages, { end: at });
    const analysis = analyzeImprovTake(loaded);
    expect(analysis.motifs.map(m => m.label)).toEqual(["Figure 1", "Figure 2"]);
    // Isolate the motif passages; the other real observations have separate review coverage.
    const insights = { ...analysis, harmony: [], phrases: [], rests: [] };
    const props = callbacks();
    const view = render(<ImprovInsights state={{ status: "ready", insights }} {...props} />);
    for (const figure of [1, 2]) for (const occurrence of [1, 2]) {
      const button = screen.getByRole("button", { name: new RegExp(`^Figure ${figure} · occurrence ${occurrence}`) });
      const item = button.closest("li")!;
      fireEvent.click(within(item).getByText(`Evidence for Figure ${figure} · occurrence ${occurrence}`));
      expect(within(item).getByText(new RegExp(`^Figure ${figure}:`))).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: /^Figure 2 · occurrence 2/ }));
    const selection = props.onSelect.mock.calls[0][0];
    expect(selection).toMatchObject({ id: "motif-1-1", label: "Figure 2 · occurrence 2", ...analysis.motifs[1].occurrences[1] });
    expect(props.onReplay).not.toHaveBeenCalled();
    view.rerender(<ImprovInsights state={{ status: "ready", insights }} {...props} selection={selection} />);
    expect(screen.getByText(/^Selected: Figure 2 · occurrence 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replay selected passage" }));
    expect(props.onReplay).toHaveBeenCalledWith({ startMs: selection.startMs, endMs: selection.endMs });
  });
  it("explains sparse evidence and all non-ready states without hiding review", () => {
    const props = callbacks(); const view = render(<ImprovInsights state={{ status: "loading" }} {...props} />);
    expect(screen.getByRole("status").textContent).toContain("Analyzing");
    view.rerender(<ImprovInsights state={{ status: "error" }} {...props} />); expect(screen.getByRole("status").textContent).toContain("could not be calculated");
    view.rerender(<ImprovInsights state={{ status: "unavailable" }} {...props} />); expect(screen.getByRole("status").textContent).toContain("staff, and replay remain available");
    const empty = { ...fixture(), tonal: { status: "insufficient" as const, hypotheses: [], reasons: ["Too few notes."] }, harmony: [], phrases: [], rests: [], motifs: [] };
    view.rerender(<ImprovInsights state={{ status: "ready", insights: empty }} {...props} />);
    expect(screen.getByText(/Insufficient evidence for a tonal center/)).toBeTruthy(); expect(screen.getByText(/No supported harmonic spans/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Replay selected passage" })).toBeNull();
  });
});
