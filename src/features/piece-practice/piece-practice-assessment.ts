import type { StaffBuilderStaff } from "@/features/staff-builder/staff-builder-types";

export type PiecePracticeAssessmentFocus = "both" | "upper" | "lower";

export function piecePracticeAssessmentLabel(focus: PiecePracticeAssessmentFocus): string {
  return focus === "upper" ? "Upper Staff" : focus === "lower" ? "Lower Staff" : "Both Staves";
}

export function isPiecePracticeStaffAssessed(focus: PiecePracticeAssessmentFocus, staff: StaffBuilderStaff): boolean {
  return focus === "both" || staff === (focus === "upper" ? "treble" : "bass");
}
