import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "./staff-builder-types";
import { layoutStaffBuilderScoreSystems } from "./notation/staff-builder-system-layout";
import { getStaffBuilderStudyLayoutConstraints } from "./staff-builder-study-layout";

const score: StaffBuilderScore = {
  schemaVersion: 3, annotations: [], id: "study", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [],
  measures: Array.from({ length: 6 }, (_value, index) => ({ id: `m${index}`, events: [] })),
};

describe("Staff Builder Study View layout policy", () => {
  it.each([
    [360, 300, 380, 24], [700, 260, 380, 28], [1100, 200, 340, 32],
  ] as const)("returns the approved deterministic policy for %ipx", (width, minimum, maximum, gap) => {
    const constraints = getStaffBuilderStudyLayoutConstraints(width);
    expect(constraints).toEqual(getStaffBuilderStudyLayoutConstraints(width));
    expect(constraints).toMatchObject({ contentWidth: width, minimumMeasureWidth: minimum, maximumMeasureWidth: maximum, baseMusicHeight: 220, systemGap: gap });
    expect(constraints.verticalReservations).toEqual({ aboveStaff: 0, betweenStaves: 0, belowStaff: 0 });
  });

  it("uses Phase 4A packing while preserving readable width and intentional overflow", () => {
    const narrow = layoutStaffBuilderScoreSystems(score, getStaffBuilderStudyLayoutConstraints(360));
    const desktop = layoutStaffBuilderScoreSystems(score, getStaffBuilderStudyLayoutConstraints(1100));
    expect(narrow.systems.length).toBeGreaterThan(desktop.systems.length);
    expect(narrow.systems.flatMap(({ measures }) => measures).every(({ width }) => width >= 300)).toBe(true);
    const tiny = layoutStaffBuilderScoreSystems({ ...score, measures: score.measures.slice(0, 1) }, getStaffBuilderStudyLayoutConstraints(120));
    expect(tiny.width).toBeGreaterThan(120);
    expect(tiny.systems[0]?.measures[0]?.width).toBeGreaterThanOrEqual(300);
  });
});
