import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FreeplaySession from "./freeplay-session";

const mocks = vi.hoisted(() => ({
  midiOptions: vi.fn(),
  musicStaffProps: vi.fn(),
  playGrandPianoNote: vi.fn(),
}));

vi.mock("@/hooks/use-midi", () => ({
  useMidi: (options: unknown) => {
    mocks.midiOptions(options);
    return {
      connectMidi: vi.fn(),
      deviceName: null,
      error: null,
      status: "disconnected",
    };
  },
}));

vi.mock("@/lib/audio/grand-piano", () => ({
  playGrandPianoNote: mocks.playGrandPianoNote,
}));

vi.mock("@/components/audio/instrument-volume-control", () => ({
  default: () => <div>Instrument volume</div>,
}));

vi.mock("@/components/midi/midi-status", () => ({
  default: () => <div>MIDI status</div>,
}));

vi.mock("@/components/notation/focus-staff-control", () => ({
  default: () => <button type="button">Focus Staff</button>,
}));

vi.mock("@/components/notation/music-staff", () => ({
  default: (props: { heldMidiNumbers: ReadonlySet<number> }) => {
    mocks.musicStaffProps(props);
    return (
      <div data-testid="staff-notes">{[...props.heldMidiNumbers].join(",")}</div>
    );
  },
}));

vi.mock("@/components/notation/piano-keyboard", () => ({
  default: ({
    activeMidiNumbers,
    onNoteToggle,
  }: {
    activeMidiNumbers: ReadonlySet<number>;
    onNoteToggle: (midiNumber: number) => void;
  }) => (
    <div>
      <span data-testid="active-notes">{[...activeMidiNumbers].join(",")}</span>
      <button onClick={() => onNoteToggle(60)} type="button">
        Toggle C4
      </button>
    </div>
  ),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function renderSession() {
  return render(
    <FreeplaySession isFocusMode={false} onToggleFocusMode={vi.fn()} />,
  );
}

describe("FreeplaySession notation settings", () => {
  it("starts with No Key and Automatic", () => {
    renderSession();

    expect(
      (screen.getByRole("combobox", { name: "Key" }) as HTMLSelectElement)
        .value,
    ).toBe("no-key");
    expect(
      (
        screen.getByRole("combobox", {
          name: "Chromatic spelling preference",
        }) as HTMLSelectElement
      ).value,
    ).toBe("automatic");
  });

  it("switches from No Key to F major and back to No Key", () => {
    renderSession();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "f-major" },
    });
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Chromatic spelling preference",
      }),
      { target: { value: "prefer-flats" } },
    );

    expect(
      (screen.getByRole("combobox", { name: "Key" }) as HTMLSelectElement)
        .value,
    ).toBe("f-major");
    expect(
      (
        screen.getByRole("combobox", {
          name: "Chromatic spelling preference",
        }) as HTMLSelectElement
      ).value,
    ).toBe("prefer-flats");

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "no-key" },
    });

    expect(
      (screen.getByRole("combobox", { name: "Key" }) as HTMLSelectElement)
        .value,
    ).toBe("no-key");
  });

  it("supports explicit C major separately from No Key", () => {
    renderSession();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "c-major" },
    });

    expect(
      (screen.getByRole("combobox", { name: "Key" }) as HTMLSelectElement)
        .value,
    ).toBe("c-major");
  });

  it("preserves held notes and settings through virtual note updates", () => {
    renderSession();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "g-minor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle C4" }));

    expect(screen.getByTestId("active-notes").textContent).toBe("60");
    expect(screen.getByTestId("staff-notes").textContent).toBe("60");
    expect(
      (screen.getByRole("combobox", { name: "Key" }) as HTMLSelectElement)
        .value,
    ).toBe("g-minor");
  });

  it("does not clear notes or play audio when settings change", () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Toggle C4" }));
    mocks.playGrandPianoNote.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "f-major" },
    });
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Chromatic spelling preference",
      }),
      { target: { value: "prefer-sharps" } },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "no-key" },
    });

    expect(screen.getByTestId("staff-notes").textContent).toBe("60");
    expect(mocks.playGrandPianoNote).not.toHaveBeenCalled();
  });

  it("continues forwarding merged physical and virtual MIDI notes", () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Toggle C4" }));

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onHeldNotesChanged: (notes: ReadonlySet<number>) => void;
    };
    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "f-major" },
    });
    act(() => {
      midiOptions.onHeldNotesChanged(new Set([64]));
    });

    expect(screen.getByTestId("staff-notes").textContent).toBe("60,64");
    const latestStaffProps = mocks.musicStaffProps.mock.calls.at(-1)?.[0] as {
      heldMidiNumbers: ReadonlySet<number>;
      mode?: string;
    };
    expect([...latestStaffProps.heldMidiNumbers]).toEqual([60, 64]);
    expect(latestStaffProps.mode).toBeUndefined();
  });
});
