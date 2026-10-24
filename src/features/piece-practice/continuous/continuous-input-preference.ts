import type { MidiInputInfo } from "@/lib/midi/midi-transport";

export const CONTINUOUS_INPUT_PREFERENCE_KEY = "prelude-continuous-midi-input-v1";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
type Preference = Readonly<{ input: MidiInputInfo | null; message: string }>;
const browserStorage = () => window.localStorage;

/** A selection hint, never proof of connection, activity or physical timing acceptance. */
export function loadContinuousInputPreference(storage: () => Storage = browserStorage): Preference {
  try {
    const text = storage().getItem(CONTINUOUS_INPUT_PREFERENCE_KEY);
    if (text === null) return { input: null, message: "" };
    const record = JSON.parse(text);
    if (record?.version !== 1 || !(record.input === null || (typeof record.input?.id === "string" && record.input.id.length > 0
      && (record.input.name === null || typeof record.input.name === "string")))) throw Error("Invalid preference");
    return { input: record.input === null ? null : { id: record.input.id, name: record.input.name }, message: "" };
  } catch { return { input: null, message: "The remembered MIDI input could not be loaded. Select your physical input explicitly." }; }
}

export function saveContinuousInputPreference(input: MidiInputInfo | null, storage: () => Storage = browserStorage): Preference {
  if (input && !input.id) throw Error("Select an input with a usable browser identity.");
  try {
    storage().setItem(CONTINUOUS_INPUT_PREFERENCE_KEY, JSON.stringify({ version: 1, input }));
    return { input, message: "" };
  } catch { return { input, message: "This input is selected for this tab, but could not be remembered. Select it again after reloading." }; }
}

/** Never infer identity from enumeration order or a matching name after an ID change. */
export function resolveContinuousInput(preferred: MidiInputInfo | null, inputs: readonly MidiInputInfo[]): MidiInputInfo | null {
  if (!preferred?.id) return null;
  const matches = inputs.filter(i => i.id === preferred.id);
  return matches.length === 1 && matches[0]!.name === preferred.name ? matches[0]! : null;
}
