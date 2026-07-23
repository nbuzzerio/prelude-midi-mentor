// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMidi } from "./use-midi";

type MidiMessageListener = (event: MIDIMessageEvent) => void;
type MidiStateChangeListener = () => void;

function createMidiInput(name = "Test MIDI Keyboard") {
  let midiMessageListener: MidiMessageListener | null = null;

  const input = {
    name,
    addEventListener: vi.fn(
      (eventType: string, listener: EventListenerOrEventListenerObject) => {
        if (eventType === "midimessage") {
          midiMessageListener = listener as MidiMessageListener;
        }
      },
    ),
    removeEventListener: vi.fn(
      (eventType: string, listener: EventListenerOrEventListenerObject) => {
        if (eventType === "midimessage" && midiMessageListener === listener) {
          midiMessageListener = null;
        }
      },
    ),
  } as unknown as MIDIInput;

  const emitMidiMessage = (data: number[]) => {
    midiMessageListener?.({
      data: Uint8Array.from(data),
    } as MIDIMessageEvent);
  };

  return {
    emitMidiMessage,
    input,
  };
}

function createMidiAccess(initialInputs: MIDIInput[] = []) {
  let stateChangeListener: MidiStateChangeListener | null = null;

  const inputs = new Map<string, MIDIInput>();

  initialInputs.forEach((input, index) => {
    inputs.set(`input-${index}`, input);
  });

  const access = {
    inputs,
    addEventListener: vi.fn(
      (eventType: string, listener: EventListenerOrEventListenerObject) => {
        if (eventType === "statechange") {
          stateChangeListener = listener as MidiStateChangeListener;
        }
      },
    ),
    removeEventListener: vi.fn(
      (eventType: string, listener: EventListenerOrEventListenerObject) => {
        if (eventType === "statechange" && stateChangeListener === listener) {
          stateChangeListener = null;
        }
      },
    ),
  } as unknown as MIDIAccess;

  const addInput = (id: string, input: MIDIInput) => {
    inputs.set(id, input);
  };

  const emitStateChange = () => {
    stateChangeListener?.();
  };

  return {
    access,
    addInput,
    emitStateChange,
  };
}

function installRequestMidiAccess(implementation: () => Promise<MIDIAccess>) {
  const requestMIDIAccess = vi.fn(implementation);

  Object.defineProperty(navigator, "requestMIDIAccess", {
    configurable: true,
    value: requestMIDIAccess,
  });

  return requestMIDIAccess;
}

describe("useMidi", () => {
  beforeEach(() => {
    Reflect.deleteProperty(navigator, "requestMIDIAccess");
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "requestMIDIAccess");
    vi.restoreAllMocks();
  });

  it("starts disconnected without a device or error", () => {
    const { result } = renderHook(() =>
      useMidi({
        onNotePlayed: vi.fn(),
      }),
    );

    expect(result.current.status).toBe("disconnected");
    expect(result.current.deviceName).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("reports unsupported when Web MIDI is unavailable", async () => {
    const { result } = renderHook(() =>
      useMidi({
        onNotePlayed: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    expect(result.current.status).toBe("unsupported");
    expect(result.current.deviceName).toBeNull();
    expect(result.current.error).toBe(
      "This browser does not support the Web MIDI API.",
    );
  });

  it("reports a connection error when MIDI access is rejected", async () => {
    installRequestMidiAccess(() =>
      Promise.reject(new Error("Permission denied")),
    );

    const { result } = renderHook(() =>
      useMidi({
        onNotePlayed: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Permission denied");
    expect(result.current.deviceName).toBeNull();
  });

  it("reports disconnected when no MIDI inputs are found", async () => {
    const onHeldNotesChanged = vi.fn();
    const { access } = createMidiAccess();

    installRequestMidiAccess(() => Promise.resolve(access));

    const { result } = renderHook(() =>
      useMidi({
        onHeldNotesChanged,
        onNotePlayed: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    expect(result.current.status).toBe("disconnected");
    expect(result.current.deviceName).toBeNull();
    expect(result.current.error).toBe(
      "No MIDI input was found. Check the keyboard connection and try again.",
    );

    expect(onHeldNotesChanged).toHaveBeenCalledWith(new Set());
  });

  it("connects to the first available MIDI input", async () => {
    const { input } = createMidiInput("Yamaha Digital Piano");
    const { access } = createMidiAccess([input]);

    const requestMIDIAccess = installRequestMidiAccess(() =>
      Promise.resolve(access),
    );

    const { result } = renderHook(() =>
      useMidi({
        onNotePlayed: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    expect(requestMIDIAccess).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("connected");
    expect(result.current.deviceName).toBe("Yamaha Digital Piano");
    expect(result.current.error).toBeNull();

    expect(input.addEventListener).toHaveBeenCalledWith(
      "midimessage",
      expect.any(Function),
    );
  });

  it("publishes held notes and reports note-on messages", async () => {
    const onHeldNotesChanged = vi.fn();
    const onNotePlayed = vi.fn();

    const { emitMidiMessage, input } = createMidiInput();
    const { access } = createMidiAccess([input]);

    installRequestMidiAccess(() => Promise.resolve(access));

    const { result } = renderHook(() =>
      useMidi({
        onHeldNotesChanged,
        onNotePlayed,
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    act(() => {
      emitMidiMessage([0x90, 60, 100]);
      emitMidiMessage([0x90, 64, 100]);
    });

    expect(onNotePlayed).toHaveBeenNthCalledWith(1, 60);
    expect(onNotePlayed).toHaveBeenNthCalledWith(2, 64);

    expect(onHeldNotesChanged).toHaveBeenNthCalledWith(1, new Set([60]));

    expect(onHeldNotesChanged).toHaveBeenNthCalledWith(2, new Set([60, 64]));
  });

  it("removes released notes for note-off messages", async () => {
    const onHeldNotesChanged = vi.fn();
    const onNotePlayed = vi.fn();

    const { emitMidiMessage, input } = createMidiInput();
    const { access } = createMidiAccess([input]);

    installRequestMidiAccess(() => Promise.resolve(access));

    const { result } = renderHook(() =>
      useMidi({
        onHeldNotesChanged,
        onNotePlayed,
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    act(() => {
      emitMidiMessage([0x90, 60, 100]);
      emitMidiMessage([0x80, 60, 0]);
    });

    expect(onNotePlayed).toHaveBeenCalledTimes(1);

    expect(onHeldNotesChanged).toHaveBeenLastCalledWith(new Set());
  });

  it("treats note-on with zero velocity as note-off", async () => {
    const onHeldNotesChanged = vi.fn();
    const onNotePlayed = vi.fn();

    const { emitMidiMessage, input } = createMidiInput();
    const { access } = createMidiAccess([input]);

    installRequestMidiAccess(() => Promise.resolve(access));

    const { result } = renderHook(() =>
      useMidi({
        onHeldNotesChanged,
        onNotePlayed,
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    act(() => {
      emitMidiMessage([0x90, 60, 100]);
      emitMidiMessage([0x90, 60, 0]);
    });

    expect(onNotePlayed).toHaveBeenCalledTimes(1);

    expect(onHeldNotesChanged).toHaveBeenLastCalledWith(new Set());
  });

  it("supports note messages on MIDI channels other than channel one", async () => {
    const onNotePlayed = vi.fn();

    const { emitMidiMessage, input } = createMidiInput();
    const { access } = createMidiAccess([input]);

    installRequestMidiAccess(() => Promise.resolve(access));

    const { result } = renderHook(() =>
      useMidi({
        onNotePlayed,
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    act(() => {
      emitMidiMessage([0x95, 72, 100]);
    });

    expect(onNotePlayed).toHaveBeenCalledWith(72);
  });

  it("ignores incomplete and unrelated MIDI messages", async () => {
    const onHeldNotesChanged = vi.fn();
    const onNotePlayed = vi.fn();

    const { emitMidiMessage, input } = createMidiInput();
    const { access } = createMidiAccess([input]);

    installRequestMidiAccess(() => Promise.resolve(access));

    const { result } = renderHook(() =>
      useMidi({
        onHeldNotesChanged,
        onNotePlayed,
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    act(() => {
      emitMidiMessage([0x90, 60]);
      emitMidiMessage([0xb0, 64, 100]);
    });

    expect(onNotePlayed).not.toHaveBeenCalled();
    expect(onHeldNotesChanged).not.toHaveBeenCalled();
  });

  it("uses the latest callbacks after rerendering", async () => {
    const initialOnHeldNotesChanged = vi.fn();
    const initialOnNotePlayed = vi.fn();

    const updatedOnHeldNotesChanged = vi.fn();
    const updatedOnNotePlayed = vi.fn();

    const { emitMidiMessage, input } = createMidiInput();
    const { access } = createMidiAccess([input]);

    installRequestMidiAccess(() => Promise.resolve(access));

    const { result, rerender } = renderHook(
      ({
        onHeldNotesChanged,
        onNotePlayed,
      }: {
        onHeldNotesChanged: (notes: ReadonlySet<number>) => void;
        onNotePlayed: (midiNumber: number) => void;
      }) =>
        useMidi({
          onHeldNotesChanged,
          onNotePlayed,
        }),
      {
        initialProps: {
          onHeldNotesChanged: initialOnHeldNotesChanged,
          onNotePlayed: initialOnNotePlayed,
        },
      },
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    rerender({
      onHeldNotesChanged: updatedOnHeldNotesChanged,
      onNotePlayed: updatedOnNotePlayed,
    });

    act(() => {
      emitMidiMessage([0x90, 60, 100]);
    });

    expect(initialOnHeldNotesChanged).not.toHaveBeenCalled();
    expect(initialOnNotePlayed).not.toHaveBeenCalled();

    expect(updatedOnHeldNotesChanged).toHaveBeenCalledWith(new Set([60]));
    expect(updatedOnNotePlayed).toHaveBeenCalledWith(60);
  });

  it("connects when a MIDI input appears after access was granted", async () => {
    const onHeldNotesChanged = vi.fn();
    const midiAccess = createMidiAccess();

    installRequestMidiAccess(() => Promise.resolve(midiAccess.access));

    const { result } = renderHook(() =>
      useMidi({
        onHeldNotesChanged,
        onNotePlayed: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    expect(result.current.status).toBe("disconnected");

    const { input } = createMidiInput("Connected Later");

    act(() => {
      midiAccess.addInput("later-input", input);
      midiAccess.emitStateChange();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.deviceName).toBe("Connected Later");
    expect(result.current.error).toBeNull();
  });

  it("removes MIDI listeners when unmounted", async () => {
    const onNotePlayed = vi.fn();

    const { emitMidiMessage, input } = createMidiInput();
    const midiAccess = createMidiAccess([input]);

    installRequestMidiAccess(() => Promise.resolve(midiAccess.access));

    const { result, unmount } = renderHook(() =>
      useMidi({
        onNotePlayed,
      }),
    );

    await act(async () => {
      await result.current.connectMidi();
    });

    unmount();

    expect(midiAccess.access.removeEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function),
    );

    expect(input.removeEventListener).toHaveBeenCalledWith(
      "midimessage",
      expect.any(Function),
    );

    act(() => {
      emitMidiMessage([0x90, 60, 100]);
    });

    expect(onNotePlayed).not.toHaveBeenCalled();
  });
});
