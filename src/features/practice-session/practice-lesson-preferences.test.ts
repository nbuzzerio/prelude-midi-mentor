import { describe, expect, it, vi } from "vitest";
import { loadLessonPreference, PRACTICE_LESSON_PREFERENCE_KEY as key, saveLessonPreference } from "./practice-lesson-preferences";

describe("explicit morning program preference", () => {
  it("loads a missing preference without writing", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    expect(loadLessonPreference(() => storage)).toEqual({ programId: null, message: "" });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("remembers only the explicitly chosen stable identity and allows changing it", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
    saveLessonPreference("first", () => storage);
    expect(JSON.parse(values.get(key)!)).toEqual({ version: 1, programId: "first" });
    expect(loadLessonPreference(() => storage).programId).toBe("first");
    saveLessonPreference("second", () => storage);
    expect(loadLessonPreference(() => storage).programId).toBe("second");
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });
  it.each(["{", "null", '{"version":2,"programId":"one"}', '{"version":1,"programId":"bad id"}', '{"version":1,"programId":"one","revision":2}'])("preserves corrupt or unsupported preference bytes: %s", text => {
      const storage = { getItem: () => text, setItem: vi.fn() };
      expect(loadLessonPreference(() => storage)).toMatchObject({ programId: null, message: expect.any(String) });
      expect(loadLessonPreference(() => storage).message).not.toBe("");
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  it("handles denied reads and retains explicit choices only in this tab after denied writes", () => {
    const storage = () => { throw new DOMException("Denied", "SecurityError"); };
    expect(loadLessonPreference(storage)).toMatchObject({ programId: null, message: expect.stringContaining("unavailable") });
    expect(saveLessonPreference("chosen", storage)).toMatchObject({ programId: "chosen", message: expect.stringContaining("could not be saved") });
  });
  it("rejects an invalid explicit identity before writing", () => {
    const storage = { getItem: () => null, setItem: vi.fn() };
    expect(() => saveLessonPreference("", () => storage)).toThrow("valid saved weekly program");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
