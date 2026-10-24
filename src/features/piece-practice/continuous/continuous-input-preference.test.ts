import { describe, expect, it } from "vitest";
import { loadContinuousInputPreference, resolveContinuousInput, saveContinuousInputPreference } from "./continuous-input-preference";

const a = { id: "silent", name: "Midi Through Port-0" }, b = { id: "piano", name: "CH345 MIDI 1" };
function storage(initial: string | null = null) {
  let text = initial;
  return { getItem: () => text, setItem: (_key: string, value: string) => { text = value; } };
}
describe("A1 explicit input preference", () => {
  it("never chooses enumeration order without an explicit preference", () => {
    expect(loadContinuousInputPreference(() => storage()).input).toBeNull();
    expect(resolveContinuousInput(null, [a, b])).toBeNull();
  });
  it("restores an explicit second input independently of enumeration order", () => {
    const s = storage(); saveContinuousInputPreference(b, () => s);
    const p = loadContinuousInputPreference(() => s);
    expect(resolveContinuousInput(p.input, [a, b])).toEqual(b);
    expect(resolveContinuousInput(p.input, [b, a])).toEqual(b);
  });
  it("requires reselection for missing, changed ID, changed name and ambiguous ID", () => {
    for (const inputs of [[a], [{ ...b, id: "new" }], [{ ...b, name: "Other" }], [b, b]]) {
      expect(resolveContinuousInput(b, inputs)).toBeNull();
    }
  });
  it("distinguishes identical names by explicit identity and never remaps by name", () => {
    const other = { ...b, id: "other" };
    expect(resolveContinuousInput(b, [other, b])).toBe(b);
    expect(resolveContinuousInput(b, [other])).toBeNull();
  });
  it.each(['{}', '{', '{"version":2,"input":null}', '{"version":1,"input":{"id":"","name":"Piano"}}', '{"version":1,"input":{"id":"piano","name":3}}'])("explains invalid stored preferences without rewriting them: %s", text => {
    const s = storage(text); expect(loadContinuousInputPreference(() => s)).toMatchObject({ input: null, message: expect.any(String) });
    expect(s.getItem()).toBe(text);
  });
  it("keeps the explicit selection usable when local storage is unavailable", () => {
    const unavailable = () => { throw Error("denied"); };
    expect(loadContinuousInputPreference(unavailable).message).toContain("could not be loaded");
    expect(saveContinuousInputPreference(b, unavailable)).toMatchObject({ input: b, message: expect.stringContaining("this tab") });
  });
  it("can forget the preference and refuses unidentifiable inputs", () => {
    const s = storage(); saveContinuousInputPreference(null, () => s);
    expect(loadContinuousInputPreference(() => s).input).toBeNull();
    expect(() => saveContinuousInputPreference({ id: null, name: "Keys" }, () => s)).toThrow(/identity/);
  });
});
