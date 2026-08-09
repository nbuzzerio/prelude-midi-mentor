import { describe, expect, it } from "vitest";
import type { StaffBuilderNotationControlAnchors } from "../notation/render-staff-builder-measure";
import { resolveStaffBuilderExpandedNotationControl, resolveStaffBuilderNotationControl, resolveStaffBuilderOriginalNotationControl, type StaffBuilderNotationControlName } from "./staff-builder-notation-control-geometry";

const anchors: StaffBuilderNotationControlAnchors = {
  trebleClef: { x: 20, y: 45, width: 34, height: 68 },
  grandStaff: { x: 2, y: 105, width: 18, height: 90 },
  bassClef: { x: 20, y: 145, width: 34, height: 68 },
  keySignature: { x: 58, y: 45, width: 12, height: 168 },
  timeSignature: { x: 72, y: 45, width: 18, height: 168 },
};
const all = new Set<StaffBuilderNotationControlName>(["trebleClef", "grandStaff", "bassClef", "keySignature", "timeSignature"]);

describe("resolveStaffBuilderNotationControl", () => {
  it.each([
    [{ x: 37, y: 75 }, "trebleClef"],
    [{ x: 64, y: 80 }, "keySignature"],
    [{ x: 81, y: 80 }, "timeSignature"],
    [{ x: 37, y: 179 }, "bassClef"],
  ] as const)("resolves original geometry at scale one for %o", (point, expected) => {
    expect(resolveStaffBuilderNotationControl(anchors, all, 1, point)).toBe(expected);
  });

  it("keeps centered clef taps ahead of the generous Grand region at minimum scale", () => {
    const scale = 480 / 760;
    expect(resolveStaffBuilderNotationControl(anchors, all, scale, { x: 37, y: 75 })).toBe("trebleClef");
    expect(resolveStaffBuilderNotationControl(anchors, all, scale, { x: 37, y: 179 })).toBe("bassClef");
  });

  it("chooses the nearest original geometry when only expanded touch regions overlap", () => {
    const scale = 480 / 760;
    expect(resolveStaffBuilderNotationControl(anchors, all, scale, { x: 55, y: 125 })).toBe("keySignature");
    expect(resolveStaffBuilderNotationControl(anchors, all, scale, { x: 71, y: 125 })).toBe("keySignature");
  });

  it("exposes original and expanded-only matches for deliberate cross-domain composition", () => {
    const scale = 480 / 760;
    expect(resolveStaffBuilderOriginalNotationControl(anchors, all, { x: 81, y: 80 })).toBe("timeSignature");
    expect(resolveStaffBuilderExpandedNotationControl(anchors, all, scale, { x: 81, y: 80 })).toBeNull();
    expect(resolveStaffBuilderOriginalNotationControl(anchors, all, { x: 55, y: 125 })).toBeNull();
    expect(resolveStaffBuilderExpandedNotationControl(anchors, all, scale, { x: 55, y: 125 })).toBe("keySignature");
  });

  it("uses smallest original area, then semantic priority as stable final tiebreakers", () => {
    const overlapping = { ...anchors, keySignature: { x: 60, y: 50, width: 20, height: 40 }, timeSignature: { x: 60, y: 50, width: 20, height: 40 } };
    expect(resolveStaffBuilderNotationControl(overlapping, all, 1, { x: 70, y: 70 })).toBe("keySignature");
    const differentAreas = { ...overlapping, timeSignature: { x: 65, y: 55, width: 8, height: 10 } };
    expect(resolveStaffBuilderNotationControl(differentAreas, all, 1, { x: 69, y: 60 })).toBe("timeSignature");
  });
});
