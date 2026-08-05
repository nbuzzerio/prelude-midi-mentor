import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PianoKeyboard from "./piano-keyboard";

const EMPTY_NOTES = new Set<number>();

afterEach(cleanup);

function renderKeyboard(
  overrides: Partial<Parameters<typeof PianoKeyboard>[0]> = {},
) {
  const props: Parameters<typeof PianoKeyboard>[0] = {
    activeMidiNumbers: EMPTY_NOTES,
    failedMidiNumbers: EMPTY_NOTES,
    lastAnswer: null,
    onNoteToggle: vi.fn(),
    targetMidiNumbers: EMPTY_NOTES,
    ...overrides,
  };

  return { props, ...render(<PianoKeyboard {...props} />) };
}

describe("PianoKeyboard", () => {
  it("renders the existing range through C6 without changing MIDI mappings", () => {
    renderKeyboard();

    const keys = screen.getAllByRole("button");

    expect(keys).toHaveLength(49);
    expect(keys[0]?.getAttribute("aria-label")).toBe("C, MIDI 36");
    expect(keys.at(-2)?.getAttribute("aria-label")).toBe("B, MIDI 83");
    expect(keys.at(-1)?.getAttribute("aria-label")).toBe("C, MIDI 84");
  });

  it("emits MIDI note 84 from the C6 key", () => {
    const onNoteToggle = vi.fn();

    renderKeyboard({ onNoteToggle });

    const c6 = screen.getByRole("button", { name: "C, MIDI 84" });

    expect(c6.getAttribute("type")).toBe("button");
    expect(c6.hasAttribute("disabled")).toBe(false);
    fireEvent.click(c6);
    expect(onNoteToggle).toHaveBeenCalledTimes(1);
    expect(onNoteToggle).toHaveBeenCalledWith(84);
  });

  it.each([
    {
      expectedColor: "rgb(125, 211, 252)",
      name: "active target",
      props: {
        activeMidiNumbers: new Set([84]),
        targetMidiNumbers: new Set([84]),
      },
      pressed: "true",
    },
    {
      expectedColor: "rgba(220, 38, 38, 0.5)",
      name: "failed non-target",
      props: { failedMidiNumbers: new Set([84]) },
      pressed: "false",
    },
    {
      expectedColor: "rgb(74, 222, 128)",
      name: "correct last answer",
      props: {
        lastAnswer: {
          midiNumbers: new Set([84]),
          result: "correct" as const,
        },
      },
      pressed: "false",
    },
    {
      expectedColor: "rgb(248, 113, 113)",
      name: "incorrect last answer",
      props: {
        lastAnswer: {
          midiNumbers: new Set([84]),
          result: "incorrect" as const,
        },
      },
      pressed: "false",
    },
    {
      expectedColor: "rgb(212, 212, 216)",
      name: "active Free Play note",
      props: {
        activeMidiNumbers: new Set([84]),
        visualMode: "freeplay" as const,
      },
      pressed: "true",
    },
  ])("applies $name state to C6", ({ expectedColor, pressed, props }) => {
    renderKeyboard(props);

    const c6 = screen.getByRole("button", { name: "C, MIDI 84" });

    expect(c6.getAttribute("aria-pressed")).toBe(pressed);
    expect(c6.style.backgroundColor).toBe(expectedColor);
  });
});
