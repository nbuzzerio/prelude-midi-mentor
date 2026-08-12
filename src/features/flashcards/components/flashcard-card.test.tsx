import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FlashcardCard from "./flashcard-card";

vi.mock("@/components/notation/music-staff", () => ({
  default: () => <div>Music staff</div>,
}));
vi.mock("@/components/notation/focus-staff-control", () => ({
  default: () => <button type="button">Focus Staff</button>,
}));
vi.mock("@/components/practice-simulation-controls", () => ({
  default: () => <button type="button">Simulate correct</button>,
}));

afterEach(cleanup);

const TARGET = {
  clef: "treble",
  name: { primary: "C Major", secondary: "Root position" },
  notes: [{ midiNumber: 60, name: "C", octave: 4 }],
} as const;

function renderCard(overrides: Partial<Parameters<typeof FlashcardCard>[0]> = {}) {
  return render(
    <FlashcardCard
      completedCount={7}
      feedback="incorrect"
      isFocusMode={false}
      onCorrect={vi.fn()}
      onIncorrect={vi.fn()}
      onToggleFocusMode={vi.fn()}
      practiceTarget={TARGET}
      showTargetName
      {...overrides}
    />,
  );
}

describe("FlashcardCard Mobile Play", () => {
  it("shows the authoritative completed count in every presentation", () => {
    const view = renderCard();
    expect(screen.getByText("Completed: 7")).toBeTruthy();
    view.rerender(<FlashcardCard completedCount={8} feedback="idle" isFocusMode isMobilePlayMode={false} onCorrect={vi.fn()} onIncorrect={vi.fn()} onToggleFocusMode={vi.fn()} practiceTarget={TARGET} showTargetName />);
    expect(screen.getByText("Completed: 8")).toBeTruthy();
    view.rerender(<FlashcardCard completedCount={9} feedback="idle" isFocusMode={false} isMobilePlayMode onCorrect={vi.fn()} onIncorrect={vi.fn()} onToggleFocusMode={vi.fn()} practiceTarget={TARGET} showTargetName />);
    expect(screen.getByText("Completed: 9")).toBeTruthy();
  });

  it("offers Mobile Play outside Focus Staff", () => {
    const onEnterMobilePlay = vi.fn();
    renderCard({ onEnterMobilePlay });
    const entry = screen.getByRole("button", { name: "Mobile Play" });
    expect(entry.classList.contains("practice-mobile-play-entry")).toBe(true);
    fireEvent.click(entry);
    expect(onEnterMobilePlay).toHaveBeenCalledTimes(1);
  });

  it("keeps feedback and revealed target labels while hiding simulation controls", () => {
    renderCard({ isMobilePlayMode: true });
    expect(screen.getByText("Try again.")).toBeTruthy();
    expect(screen.getByText("C Major")).toBeTruthy();
    expect(screen.getByText("Root position")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simulate correct" })).toBeNull();
    expect(screen.getByText("Music staff")).toBeTruthy();
  });

  it("continues honoring hidden target names in Mobile Play", () => {
    renderCard({ isMobilePlayMode: true, showTargetName: false });
    expect(screen.queryByText("C Major")).toBeNull();
  });
});
