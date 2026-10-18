import { describe, expect, it } from "vitest";
import { getStaffBuilderReadingLayout as layout, getStaffBuilderReadingScrollLeft as follow } from "./staff-builder-reading-layout";
describe("opt-in Reading Flow layout", () => {
  it.each([1280, 1152, 929, 713])("reformats within %d pixels without reducing staff-line spacing", width => {
    for (const expanded of [false, true]) {
      const value = layout(width, expanded);
      expect(value.scale * 10).toBe(expanded ? 22 : 18);
      expect(value.width).toBeGreaterThanOrEqual(440);
      if (value.width > 440) expect(value.width * value.scale).toBeLessThanOrEqual(width);
    }
  });
  it.each([0, 300, 320, NaN])("keeps narrow/unknown width %s readable with one scrollable canvas", width => {
    expect(layout(width, false).scale).toBe(1.8); expect(layout(width, false).width).toBeGreaterThanOrEqual(440);
  });
  it("follows authoritative highlight geometry with bounded scrolling", () => {
    expect(follow(0, 300, 792)).toBe(0); expect(follow(450, 300, 792)).toBe(285);
    expect(follow(900, 300, 792)).toBe(492); expect(follow(500, 1000, 792)).toBe(0);
  });
});
