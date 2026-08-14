import type { StaffBuilderAnnotation, StaffBuilderBookmarkCategory, StaffBuilderPracticeMarkCategory } from "./staff-builder-types";
import type { StaffBuilderAnnotationLayer } from "./staff-builder-annotation-layers";

export const STAFF_BUILDER_ANNOTATION_KIND_LABELS = { "study-note": "Study Note", "practice-mark": "Practice Mark", bookmark: "Bookmark" } as const;
export const STAFF_BUILDER_ANNOTATION_LAYER_LABELS: Readonly<Record<StaffBuilderAnnotationLayer, string>> = { "study-notes": "Study Notes", "practice-marks": "Practice Marks", bookmarks: "Bookmarks" };
export const STAFF_BUILDER_PRACTICE_MARK_LABELS: Readonly<Record<StaffBuilderPracticeMarkCategory, string>> = { "needs-work": "Needs work", rhythm: "Rhythm", "hands-separate": "Hands separate", "check-fingering": "Check fingering", other: "Other" };
export const STAFF_BUILDER_BOOKMARK_LABELS: Readonly<Record<StaffBuilderBookmarkCategory, string>> = { interesting: "Interesting", "needs-work": "Needs work", question: "Question", revisit: "Revisit" };

export function describeStaffBuilderAnnotation(annotation: StaffBuilderAnnotation): string {
  if (annotation.kind === "study-note") return annotation.text;
  if (annotation.kind === "practice-mark") return annotation.category === "other" ? annotation.text ?? "Other" : STAFF_BUILDER_PRACTICE_MARK_LABELS[annotation.category];
  return STAFF_BUILDER_BOOKMARK_LABELS[annotation.category];
}
