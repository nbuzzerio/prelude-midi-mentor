import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MUSIC_KEYS } from "@/lib/music/keys";

import FreeplayControls from "./freeplay-controls";

afterEach(cleanup);

const createProps = () => ({
  chromaticPreference: "automatic" as const,
  onChromaticPreferenceChange: vi.fn(),
  notationContext: { type: "no-key" } as const,
  onNotationContextChange: vi.fn(),
});

describe("FreeplayControls", () => {
  it("shows the default values with accessible native selects", () => {
    render(<FreeplayControls {...createProps()} />);

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

  it("derives every supported key option and both mode groups", () => {
    render(<FreeplayControls {...createProps()} />);

    expect(screen.getByRole("group", { name: "Major" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Minor" })).toBeTruthy();

    const keySelect = screen.getByRole("combobox", { name: "Key" });
    const options = [...keySelect.querySelectorAll("option")];

    expect(options.map((option) => option.value)).toEqual(
      ["no-key", ...MUSIC_KEYS.map((key) => key.id)],
    );
    expect(options.map((option) => option.textContent)).toEqual(
      ["No Key", ...MUSIC_KEYS.map((key) => key.name)],
    );
  });

  it("shows all chromatic spelling preferences", () => {
    render(<FreeplayControls {...createProps()} />);

    const select = screen.getByRole("combobox", {
      name: "Chromatic spelling preference",
    });

    expect(
      [...select.querySelectorAll("option")].map((option) => [
        option.value,
        option.textContent,
      ]),
    ).toEqual([
      ["automatic", "Automatic"],
      ["prefer-sharps", "Prefer sharps"],
      ["prefer-flats", "Prefer flats"],
    ]);
  });

  it("emits named-key, No Key, and chromatic preference changes", () => {
    const props = createProps();
    render(<FreeplayControls {...props} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "f-major" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "no-key" },
    });
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Chromatic spelling preference",
      }),
      { target: { value: "prefer-flats" } },
    );

    expect(props.onNotationContextChange).toHaveBeenNthCalledWith(1, {
      type: "key",
      keyId: "f-major",
    });
    expect(props.onNotationContextChange).toHaveBeenNthCalledWith(2, {
      type: "no-key",
    });
    expect(props.onChromaticPreferenceChange).toHaveBeenCalledWith(
      "prefer-flats",
    );
  });

  it("keeps explicit C major distinct from No Key", () => {
    const props = createProps();
    render(<FreeplayControls {...props} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Key" }), {
      target: { value: "c-major" },
    });

    expect(props.onNotationContextChange).toHaveBeenCalledWith({
      type: "key",
      keyId: "c-major",
    });
  });
});
