import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { useAppMidiInput } from "./hooks/use-app-midi-input";

const appStyles = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "requestMIDIAccess");
});

type SessionProps = Readonly<{
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}>;

const appMidiNotes: string[] = [];

function TestSession({
  isFocusMode,
  label,
  onToggleFocusMode,
}: SessionProps & Readonly<{ label: string }>) {
  const midi = useAppMidiInput({ onNotePlayed: (midiNumber) => appMidiNotes.push(`${label}:${midiNumber}`) });
  return (
    <div>
      <span>{label}</span>
      <span>{midi.status}:{midi.deviceName}</span>
      <button onClick={() => void midi.connectMidi()} type="button">Connect test MIDI</button>
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

vi.mock("./features/staff-builder/components/staff-builder-session", () => ({
  default: () => <div className="staff-builder-study-view">Staff Builder Study View</div>,
}));

vi.mock("./features/melody/components/melody-session", () => ({
  default: () => <TestSession isFocusMode={false} label="Melody session" onToggleFocusMode={() => undefined} />,
}));

describe("App focus mode", () => {
  it("keeps one connected MIDI lifecycle while routing attacks only to the active top-level mode", async () => {
    appMidiNotes.length = 0;
    let messageListener: ((event: MIDIMessageEvent) => void) | null = null;
    const input = {
      name: "Persistent Keys",
      addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "midimessage") messageListener = listener as (event: MIDIMessageEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as MIDIInput;
    const access = {
      inputs: new Map([["keys", input]]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MIDIAccess;
    const requestMIDIAccess = vi.fn(async () => access);
    Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: requestMIDIAccess });

    render(<App />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect test MIDI" })); });
    expect(screen.getByText("connected:Persistent Keys")).toBeTruthy();
    expect(requestMIDIAccess).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Sequences" }));
    expect(screen.getByText("connected:Persistent Keys")).toBeTruthy();
    act(() => messageListener?.({ data: Uint8Array.from([0x90, 60, 100]) } as MIDIMessageEvent));
    expect(appMidiNotes).toEqual(["Sequence session:60"]);

    fireEvent.click(screen.getByRole("button", { name: "Ear Training" }));
    act(() => messageListener?.({ data: Uint8Array.from([0x90, 62, 100]) } as MIDIMessageEvent));
    expect(appMidiNotes).toEqual(["Sequence session:60"]);
    fireEvent.click(screen.getByRole("button", { name: "Flashcards" }));
    expect(screen.getByText("connected:Persistent Keys")).toBeTruthy();
    act(() => messageListener?.({ data: Uint8Array.from([0x90, 64, 100]) } as MIDIMessageEvent));
    expect(appMidiNotes).toEqual(["Sequence session:60", "Flashcard session:64"]);
    expect(requestMIDIAccess).toHaveBeenCalledTimes(1);
    expect(input.addEventListener).toHaveBeenCalledTimes(1);
  });

  it("orders modes with compact visual labels and full accessible names", () => {
    render(<App />);
    const navigation = screen.getByRole("navigation", { name: "Prelude modes" });
    expect(within(navigation).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent?.trim())).toEqual([
      "Free Play", "Staff Builder", "Flashcards", "Sequences", "Ear Training", "Melody",
    ]);
    expect(within(screen.getByRole("button", { name: "Staff Builder" })).getByText("Staff")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Ear Training" })).getByText("Ear")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Flashcards" }).classList.contains("prelude-mode-group-start")).toBe(true);
    expect(screen.getByRole("button", { name: "Free Play" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Sequences" }));
    expect(screen.getByText("Sequence session")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sequences" }).getAttribute("aria-pressed")).toBe("true");
  });

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

  it("mounts Staff Builder as a fifth mode, exits Focus Staff, and suppresses F", () => {
    render(<App />);
    const modeNavigation = screen.getByRole("button", { name: "Free Play" }).parentElement;
    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));
    fireEvent.click(screen.getByRole("button", { name: "Staff Builder", hidden: true }));
    expect(screen.getByText("Staff Builder Study View")).toBeTruthy();
    expect(modeNavigation?.hidden).toBe(false);
    expect(appStyles).toMatch(/body:has\(\.staff-builder-study-view\) \.prelude-mode-nav\s*\{\s*visibility: hidden;/);
    fireEvent.keyDown(window, { key: "f" });
    expect(modeNavigation?.hidden).toBe(false);
    expect(screen.queryByRole("button", { name: "Exit Focus Staff" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Free Play" }));
    expect(screen.getByText("Free Play session")).toBeTruthy();
  });

  it("mounts Melody as a sixth mode without changing adjacent modes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Melody" }));
    expect(screen.getByText("Melody session")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sequences" }));
    expect(screen.getByText("Sequence session")).toBeTruthy();
  });
});
