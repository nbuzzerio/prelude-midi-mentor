import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FreeplaySession from "./freeplay-session";

const mocks = vi.hoisted(() => ({
  midiOptions: vi.fn(),
  musicStaffProps: vi.fn(),
  playGrandPianoNote: vi.fn(),
  pianoProps: vi.fn(),
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
  default: ({ isFocusMode, onToggle }: { isFocusMode: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} type="button">
      {isFocusMode ? "Exit Focus Staff" : "Focus Staff"}
    </button>
  ),
}));

vi.mock("@/components/notation/music-staff", () => ({
  default: (props: {
    heldNotes: ReadonlyArray<{
      midiNumber: number;
      name: string;
      octave: number;
    }>;
    isFocusMode?: boolean;
    keySignatureId?: string;
    mode: string;
  }) => {
    mocks.musicStaffProps(props);
    return (
      <div>
        <div data-testid="staff-notes">
          {props.heldNotes
            .map((note) => `${note.name}${note.octave}:${note.midiNumber}`)
            .join(",")}
        </div>
        <div data-testid="staff-signature">{props.keySignatureId ?? "none"}</div>
      </div>
    );
  },
}));

vi.mock("@/components/notation/piano-keyboard", () => ({
  default: ({
    activeMidiNumbers,
    onNotePress,
    onNoteRelease,
    onNoteToggle,
  }: {
    activeMidiNumbers: ReadonlySet<number>;
    onNotePress?: (midiNumber: number) => void;
    onNoteRelease?: (midiNumber: number) => void;
    onNoteToggle: (midiNumber: number) => void;
  }) => {
    mocks.pianoProps({ onNotePress, onNoteRelease, onNoteToggle });
    return (
    <div>
      <span data-testid="active-notes">{[...activeMidiNumbers].join(",")}</span>
      {[60, 61, 66, 70].map((midiNumber) => (
        <button
          key={midiNumber}
          onClick={() => onNoteToggle(midiNumber)}
          type="button"
        >
          Toggle MIDI {midiNumber}
        </button>
      ))}
      <button onPointerDown={() => onNotePress?.(61)} onPointerUp={() => onNoteRelease?.(61)} type="button">
        Momentary MIDI 61
      </button>
    </div>
    );
  },
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function renderSession(isFocusMode = false) {
  return render(
    <FreeplaySession
      isFocusMode={isFocusMode}
      onToggleFocusMode={vi.fn()}
    />,
  );
}

function renderInteractiveSession() {
  function SessionHarness() {
    const [isFocusMode, setIsFocusMode] = useState(false);
    return <>
      <button onClick={() => setIsFocusMode(true)} type="button">Activate Focus globally</button>
      <FreeplaySession
          isFocusMode={isFocusMode}
          onToggleFocusMode={() => setIsFocusMode((current) => !current)}
        />
    </>;
  }
  return render(<SessionHarness />);
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

  it("spells MIDI 70 as B-flat in D minor", () => {
    renderSession();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "d-minor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle MIDI 70" }));

    expect(screen.getByTestId("staff-notes").textContent).toBe("B♭4:70");
    expect(screen.getByTestId("active-notes").textContent).toBe("70");
  });

  it("forwards the selected F-major signature", () => {
    renderSession();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "f-major" },
    });

    expect(screen.getByTestId("staff-signature").textContent).toBe("f-major");
  });

  it("respells held chromatic notes for key and preference changes without replay", () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Toggle MIDI 66" }));
    mocks.playGrandPianoNote.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "f-major" },
    });
    expect(screen.getByTestId("staff-notes").textContent).toBe("G♭4:66");

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Chromatic spelling preference",
      }),
      { target: { value: "prefer-sharps" } },
    );
    expect(screen.getByTestId("staff-notes").textContent).toBe("F♯4:66");

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Chromatic spelling preference",
      }),
      { target: { value: "prefer-flats" } },
    );

    expect(screen.getByTestId("staff-notes").textContent).toBe("G♭4:66");
    expect(screen.getByTestId("active-notes").textContent).toBe("66");
    expect(mocks.playGrandPianoNote).not.toHaveBeenCalled();
  });

  it("keeps Automatic diatonic spelling authoritative", () => {
    renderSession();

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "g-major" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle MIDI 66" }));

    expect(screen.getByTestId("staff-notes").textContent).toBe("F♯4:66");
  });

  it("respells an existing held note immediately when chromatic preference changes", () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Toggle MIDI 61" }));

    expect(screen.getByTestId("staff-notes").textContent).toBe("C♯4:61");

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Chromatic spelling preference",
      }),
      { target: { value: "prefer-flats" } },
    );

    expect(screen.getByTestId("staff-notes").textContent).toBe("D♭4:61");
    expect(screen.getByTestId("active-notes").textContent).toBe("61");
  });

  it("preserves merged physical and virtual raw MIDI state", () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Toggle MIDI 60" }));

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onHeldNotesChanged: (notes: ReadonlySet<number>) => void;
    };
    act(() => {
      midiOptions.onHeldNotesChanged(new Set([64]));
    });

    expect(screen.getByTestId("active-notes").textContent).toBe("60,64");
    expect(screen.getByTestId("staff-notes").textContent).toBe("C4:60,E4:64");
    const latestStaffProps = mocks.musicStaffProps.mock.calls.at(-1)?.[0] as {
      heldNotes: ReadonlyArray<{ midiNumber: number }>;
      mode: string;
    };
    expect(latestStaffProps.heldNotes.map((note) => note.midiNumber)).toEqual([
      60, 64,
    ]);
    expect(latestStaffProps.mode).toBe("freeplay");
  });

  it("preserves Focus Staff behavior", () => {
    renderSession(true);

    expect(screen.queryByRole("button", { name: "Toggle MIDI 60" })).toBeNull();
    const latestStaffProps = mocks.musicStaffProps.mock.calls.at(-1)?.[0] as {
      isFocusMode?: boolean;
    };
    expect(latestStaffProps.isFocusMode).toBe(true);
  });

  it("preserves held notes and notation settings across Mobile Play entry and exit", () => {
    renderInteractiveSession();
    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "f-major" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle MIDI 70" }));
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    expect(screen.getByTestId("staff-notes").textContent).toBe("B♭4:70");

    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getByTestId("staff-notes").textContent).toBe("B♭4:70");
    expect((screen.getByRole("combobox", { name: "Key" }) as HTMLSelectElement).value).toBe("f-major");
  });

  it("uses momentary callbacks, clears pointer notes on exit, and leaves MIDI notes held", () => {
    renderInteractiveSession();
    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onHeldNotesChanged: (notes: ReadonlySet<number>) => void;
    };
    act(() => midiOptions.onHeldNotesChanged(new Set([60])));
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Momentary MIDI 61" }));
    expect(screen.getByTestId("active-notes").textContent).toBe("61,60");

    const props = mocks.pianoProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props.onNotePress).toEqual(expect.any(Function));
    expect(props.onNoteRelease).toEqual(expect.any(Function));
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getByTestId("active-notes").textContent).toBe("60");
  });

  it("keeps Focus Staff and Mobile Play mutually exclusive", () => {
    renderInteractiveSession();
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Activate Focus globally" }));
    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Exit Focus Staff" })).toBeTruthy();
  });
});
