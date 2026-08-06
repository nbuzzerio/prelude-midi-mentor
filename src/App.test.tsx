import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

afterEach(cleanup);

type SessionProps = Readonly<{
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}>;

function TestSession({
  isFocusMode,
  label,
  onToggleFocusMode,
}: SessionProps & Readonly<{ label: string }>) {
  return (
    <div>
      <span>{label}</span>
      <button onClick={onToggleFocusMode} type="button">
        {isFocusMode ? "Exit Focus Staff" : "Focus Staff"}
      </button>
    </div>
  );
}

vi.mock("./features/freeplay/freeplay-session", () => ({
  default: (props: SessionProps) => <TestSession {...props} label="Free Play session" />,
}));

vi.mock("./features/flashcards/components/flashcard-session", () => ({
  default: (props: SessionProps) => <TestSession {...props} label="Flashcard session" />,
}));

vi.mock("./features/sequences/components/sequence-session", () => ({
  default: (props: SessionProps) => <TestSession {...props} label="Sequence session" />,
}));

vi.mock("./features/ear-training/components/ear-training-session", () => ({
  default: () => <div>Ear Training session</div>,
}));

describe("App focus mode", () => {
  it("shares focus state between the visible control and keyboard shortcut", () => {
    render(<App />);

    const modeNavigation = screen.getByRole("button", {
      name: "Free Play",
    }).parentElement;

    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(modeNavigation?.hidden).toBe(true);
    expect(
      screen.getByRole("button", { name: "Exit Focus Staff" }),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: "f" });

    expect(modeNavigation?.hidden).toBe(false);
    expect(screen.getByRole("button", { name: "Focus Staff" })).toBeTruthy();
  });

  it("mounts Ear Training as a fourth mode and suppresses Focus Staff", () => {
    render(<App />);

    const modeNavigation = screen.getByRole("button", {
      name: "Free Play",
    }).parentElement;

    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(screen.getByRole("button", { name: "Exit Focus Staff" })).toBeTruthy();
    expect(modeNavigation?.hidden).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Ear Training", hidden: true }),
    );

    expect(screen.getByText("Ear Training session")).toBeTruthy();
    expect(modeNavigation?.hidden).toBe(false);
    expect(screen.queryByRole("button", { name: "Exit Focus Staff" })).toBeNull();

    fireEvent.keyDown(window, { key: "f" });

    expect(screen.getByText("Ear Training session")).toBeTruthy();
    expect(modeNavigation?.hidden).toBe(false);
    expect(screen.queryByRole("button", { name: "Exit Focus Staff" })).toBeNull();
  });
});
