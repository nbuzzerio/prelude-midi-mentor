import { describe, expect, it, vi } from "vitest";
import { loadRepertoirePreference, saveRepertoirePreference, REPERTOIRE_PREFERENCE_KEY } from "./practice-repertoire-preferences";

describe("independent repertoire preferences", () => {
  function fixture(initial: string | null = null) {
    let text = initial;
    const storage = { getItem: vi.fn(() => text), setItem: vi.fn((_key: string, value: string) => { text = value; }) };
    return { storage, read: () => storage };
  }
  it("defaults off with Piano selected without writing on load", () => {
    const f = fixture(); expect(loadRepertoirePreference(f.read)).toEqual({ enabled: false, instruments: ["piano"], message: "" });
    expect(f.storage.setItem).not.toHaveBeenCalled();
  });
  it("persists explicit opt-in and instrument changes independently", () => {
    const f = fixture();
    saveRepertoirePreference({ enabled: true, instruments: ["piano", "ocarina"], message: "" }, f.read);
    expect(f.storage.setItem).toHaveBeenCalledWith(REPERTOIRE_PREFERENCE_KEY, JSON.stringify({ version: 1, enabled: true, instruments: ["piano", "ocarina"] }));
    expect(loadRepertoirePreference(f.read)).toMatchObject({ enabled: true, instruments: ["piano", "ocarina"] });
  });
  it.each(["{", "null", '{"version":2}', '{"version":1,"enabled":true,"instruments":["guitar"]}', '{"version":1,"enabled":true,"instruments":["piano","piano"]}'])("preserves invalid data and fails off: %s", text => {
    const f = fixture(text); expect(loadRepertoirePreference(f.read)).toMatchObject({ enabled: false, message: expect.stringContaining("could not be read") });
    expect(f.storage.setItem).not.toHaveBeenCalled(); expect(f.storage.getItem()).toBe(text);
  });
  it("reports denied reads and failed writes without claiming a saved choice", () => {
    expect(loadRepertoirePreference(() => { throw Error("denied"); }).enabled).toBe(false);
    const f = fixture(); f.storage.setItem.mockImplementation(() => { throw Error("quota"); });
    expect(saveRepertoirePreference({ enabled: true, instruments: ["piano"], message: "" }, f.read)).toMatchObject({ enabled: false, message: expect.stringContaining("not saved") });
    f.storage.setItem.mockImplementation(() => {});
    expect(saveRepertoirePreference({ enabled: true, instruments: ["piano"], message: "" }, f.read).message).toBe("");
  });
});
