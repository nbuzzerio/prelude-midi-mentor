import { describe, expect, it, vi } from "vitest";
import { readCalibrationTolerance, saveCalibrationTolerance, VIOLIN_CALIBRATION_TOLERANCE_KEY } from "./calibration-preferences";

function fixture(initial: string | null = null) {
  let value = initial;
  const storage = { getItem: vi.fn(() => value), setItem: vi.fn((_key: string, next: string) => { value = next; }) };
  return { storage, access: () => storage };
}
describe("violin-specific calibration preference", () => {
  it("defaults to 10 without writing and remembers validated settings across readers", () => {
    const f = fixture(); expect(readCalibrationTolerance(f.access).value).toBe(10); expect(f.storage.setItem).not.toHaveBeenCalled();
    expect(saveCalibrationTolerance(5, f.access)).toBe(true); expect(readCalibrationTolerance(f.access).value).toBe(5);
    expect(f.storage.setItem).toHaveBeenCalledExactlyOnceWith(VIOLIN_CALIBRATION_TOLERANCE_KEY, '{"version":1,"toleranceCents":5}');
    expect(saveCalibrationTolerance(30, f.access)).toBe(true); expect(readCalibrationTolerance(f.access).value).toBe(30);
  });
  it.each(["{", "null", "[]", '{"version":2,"toleranceCents":5}', '{"version":1,"toleranceCents":"5"}', '{"version":1,"toleranceCents":0}', '{"version":1,"toleranceCents":31}', '{"version":1,"toleranceCents":1.5}'])("preserves invalid/unsupported stored %s and defaults to 10", value => {
    const f = fixture(value); expect(readCalibrationTolerance(f.access)).toMatchObject({ value: 10, message: expect.any(String) }); expect(f.storage.setItem).not.toHaveBeenCalled();
  });
  it.each([0, 31, 1.5, NaN, Infinity])("refuses to persist invalid %s", value => {
    const f = fixture(); expect(saveCalibrationTolerance(value, f.access)).toBe(false); expect(f.storage.setItem).not.toHaveBeenCalled();
  });
  it("tolerates blocked getters and writes", () => {
    const blocked = () => { throw Error("blocked"); };
    expect(readCalibrationTolerance(blocked)).toMatchObject({ value: 10, message: expect.stringContaining("could not be loaded") });
    expect(saveCalibrationTolerance(1, blocked)).toBe(false);
    const f = fixture(); f.storage.setItem.mockImplementation(() => { throw Error("quota"); }); expect(saveCalibrationTolerance(1, f.access)).toBe(false);
  });
});
