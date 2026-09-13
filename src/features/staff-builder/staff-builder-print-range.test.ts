import { describe, expect, it } from "vitest";
import { entireStaffBuilderPrintRange, parseStaffBuilderPrintRange } from "./staff-builder-print-range";

describe("Staff Builder print ranges", () => {
  it("selects an entire piece", () => expect(entireStaffBuilderPrintRange(3)).toEqual({ ok: true, ranges: [{ start: 1, end: 3 }], measureIndexes: [0, 1, 2] }));
  it.each([
    ["12", [{ start: 12, end: 12 }], [11]],
    ["5-10", [{ start: 5, end: 10 }], [4, 5, 6, 7, 8, 9]],
    [" 5 - 10, 15-20, 27 - 28 ", [{ start: 5, end: 10 }, { start: 15, end: 20 }, { start: 27, end: 28 }], [4, 5, 6, 7, 8, 9, 14, 15, 16, 17, 18, 19, 26, 27]],
    ["8-10, 5-8, 10, 11-12", [{ start: 5, end: 12 }], [4, 5, 6, 7, 8, 9, 10, 11]],
  ] as const)("normalizes %s", (input, ranges, indexes) => expect(parseStaffBuilderPrintRange(input, 30)).toEqual({ ok: true, ranges, measureIndexes: indexes }));
  it.each(["", "1,", "a", "1--2", "-1", "1.5", "0", "10-5", "31"])("rejects %s", (input) => expect(parseStaffBuilderPrintRange(input, 30).ok).toBe(false));
});
