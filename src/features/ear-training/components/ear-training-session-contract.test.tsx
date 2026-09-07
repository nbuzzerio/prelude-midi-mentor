import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { StrictMode, useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EarTrainingSession from "./ear-training-session";

const mocks = vi.hoisted(() => ({
  cancelPrompt: vi.fn(),
  getResponseTimeMs: vi.fn(() => 1500),
  generateTarget: vi.fn(),
  playPrompt: vi.fn(),
  playIncorrectFeedback: vi.fn(),
  playSuccessChirp: vi.fn(),
  resetPrompt: vi.fn(),
}));

vi.mock("../generate-ear-training-target", async (original) => {
  const actual = await original<typeof import("../generate-ear-training-target")>();
  return { ...actual, generateEarTrainingTarget: vi.fn(actual.generateEarTrainingTarget) };
});
vi.mock("@/lib/audio/feedback", () => ({
  playIncorrectFeedback: mocks.playIncorrectFeedback,
  playSuccessChirp: mocks.playSuccessChirp,
}));
vi.mock("../hooks/use-ear-training-prompt", () => ({
  useEarTrainingPrompt: () => {
    const [state, setState] = useState<"ready" | "heard">("ready");
    const playPrompt = useCallback(async (target: unknown) => {
      mocks.playPrompt(target);
      setState("heard");
      return "completed";
    }, []);
    const resetPrompt = useCallback(() => {
      mocks.resetPrompt();
      setState("ready");
    }, []);
    return {
      cancelPrompt: mocks.cancelPrompt,
      getResponseTimeMs: mocks.getResponseTimeMs,
      playPrompt,
      resetPrompt,
      state,
    };
  },
}));
vi.mock("@/hooks/use-mobile-play", () => ({
  useMobilePlay: () => {
    const [isMobilePlayMode, setActive] = useState(false);
    return { enterMobilePlay: () => setActive(true), exitMobilePlay: () => setActive(false), isMobilePlayMode };
  },
}));
vi.mock("@/components/audio/feedback-volume-control", () => ({ default: () => <div>Feedback volume</div> }));
vi.mock("@/components/audio/instrument-volume-control", () => ({ default: () => <div>Instrument volume</div> }));

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function playPrompt() {
  fireEvent.click(screen.getByRole("button", { name: "Play Prompt" }));
}

import { DEFAULT_EAR_TRAINING_CONFIG, earTrainingConfigToSettings, type EarTrainingConfig } from "../ear-training-config";
import { generateEarTrainingTarget } from "../generate-ear-training-target";
const config: EarTrainingConfig = { ...DEFAULT_EAR_TRAINING_CONFIG, enabledIntervals: ["octave", "minor-second", "major-second", "minor-third", "major-third"], enabledDirections: ["descending", "ascending"] };

describe("Ear Training engine contract", () => {
  it("creates the configured first prompt without autoplay and ignores changed initial props", () => {
    const view = render(<EarTrainingSession initialConfig={config} />);
    expect(generateEarTrainingTarget).toHaveBeenCalledExactlyOnceWith(earTrainingConfigToSettings(config));
    const first = vi.mocked(generateEarTrainingTarget).mock.results[0].value;
    expect(first).toMatchObject({ interval: "octave", direction: "descending" });
    expect(first.notes[1].midiNumber - first.notes[0].midiNumber).toBe(-12);
    expect(mocks.playPrompt).not.toHaveBeenCalled();
    view.rerender(<EarTrainingSession initialConfig={{ ...config }} />);
    view.rerender(<EarTrainingSession initialConfig={DEFAULT_EAR_TRAINING_CONFIG} />);
    expect(generateEarTrainingTarget).toHaveBeenCalledTimes(1);
    playPrompt();
    expect(mocks.playPrompt).toHaveBeenCalledExactlyOnceWith(first);
  });
  it("does not regenerate on Strict Mode effect replay or callback changes", () => {
    const oldCallback = vi.fn(); const currentCallback = vi.fn();
    const view = render(<StrictMode><EarTrainingSession initialConfig={config} onPracticeUnitCompleted={oldCallback} /></StrictMode>);
    // React checks the lazy initializer twice; effect replay must not generate a third target.
    expect(generateEarTrainingTarget).toHaveBeenCalledTimes(2);
    view.rerender(<StrictMode><EarTrainingSession initialConfig={{ ...config }} onPracticeUnitCompleted={currentCallback} /></StrictMode>);
    expect(generateEarTrainingTarget).toHaveBeenCalledTimes(2);
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Octave" }));
    fireEvent.click(screen.getByRole("button", { name: "Octave" }));
    expect(currentCallback).toHaveBeenCalledExactlyOnceWith();
    expect(oldCallback).not.toHaveBeenCalled();
    view.unmount(); act(() => vi.runAllTimers());
    expect(currentCallback).toHaveBeenCalledTimes(1);
  });
  it("notifies only eventual correct identification, never replay, advancement, settings or reset", () => {
    const completed = vi.fn();
    render(<EarTrainingSession initialConfig={config} onPracticeUnitCompleted={completed} />);
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Replay Prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "Minor second" }));
    expect(completed).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    fireEvent.click(screen.getByRole("button", { name: "Octave" }));
    expect(completed).toHaveBeenCalledExactlyOnceWith();
    act(() => vi.advanceTimersByTime(1000));
    expect(completed).toHaveBeenCalledTimes(1);
    expect(mocks.playPrompt).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("checkbox", { name: "ascending" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Session" }));
    expect(completed).toHaveBeenCalledTimes(1);
  });
  it("suppresses prescription controls but preserves Play Prompt when hosted", () => {
    const view = render(<EarTrainingSession initialConfig={config} />);
    expect(screen.getByRole("button", { name: "Reset Session" })).toBeTruthy();
    view.rerender(<EarTrainingSession initialConfig={config} practiceSessionMode />);
    expect(screen.queryByRole("button", { name: "Reset Session" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play Prompt" })).toBeTruthy();
  });
  it("renders hosted Mobile Play as an embedded presentation without local controls", () => {
    const { container } = render(<EarTrainingSession hostedMobilePlay={{ active: true }} initialConfig={config} practiceSessionMode />);
    expect(container.firstElementChild?.classList.contains("ear-training-mobile-play")).toBe(true);
    expect(container.firstElementChild?.classList.contains("mobile-play-mode")).toBe(false);
    expect(container.firstElementChild?.classList.contains("fixed")).toBe(false);
    expect(screen.queryByRole("button", { name: "Mobile Play" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play Prompt" })).toBeTruthy();
  });
});
