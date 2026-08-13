import type { StaffBuilderAnnotation } from "./staff-builder-types";

export const STAFF_BUILDER_ANNOTATION_LAYERS = ["study-notes", "practice-marks", "bookmarks"] as const;

export type StaffBuilderAnnotationLayer = typeof STAFF_BUILDER_ANNOTATION_LAYERS[number];

export const ALL_STAFF_BUILDER_ANNOTATION_LAYERS: ReadonlySet<StaffBuilderAnnotationLayer> = new Set(STAFF_BUILDER_ANNOTATION_LAYERS);

export function getStaffBuilderAnnotationLayer(annotation: StaffBuilderAnnotation): StaffBuilderAnnotationLayer {
  if (annotation.kind === "study-note") return "study-notes";
  if (annotation.kind === "practice-mark") return "practice-marks";
  return "bookmarks";
}

export function filterStaffBuilderAnnotationsByLayers(
  annotations: readonly StaffBuilderAnnotation[],
  visibleLayers: ReadonlySet<StaffBuilderAnnotationLayer>,
): readonly StaffBuilderAnnotation[] {
  return annotations.filter((annotation) => visibleLayers.has(getStaffBuilderAnnotationLayer(annotation)));
}
