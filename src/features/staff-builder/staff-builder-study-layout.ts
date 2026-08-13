import type { StaffBuilderSystemLayoutConstraints } from "./notation/staff-builder-system-layout";

export function getStaffBuilderStudyLayoutConstraints(containerWidth: number): StaffBuilderSystemLayoutConstraints {
  const contentWidth = Math.max(1, Math.floor(containerWidth));
  const policy = contentWidth < 480
    ? { minimumMeasureWidth: 300, maximumMeasureWidth: 380, systemGap: 24 }
    : contentWidth < 768
      ? { minimumMeasureWidth: 260, maximumMeasureWidth: 380, systemGap: 28 }
      : contentWidth < 1024
        ? { minimumMeasureWidth: 220, maximumMeasureWidth: 360, systemGap: 30 }
        : { minimumMeasureWidth: 200, maximumMeasureWidth: 340, systemGap: 32 };
  return {
    contentWidth,
    ...policy,
    baseMusicHeight: 220,
    verticalReservations: { aboveStaff: 0, betweenStaves: 0, belowStaff: 0 },
  };
}
