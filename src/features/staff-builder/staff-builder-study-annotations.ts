import { filterStaffBuilderAnnotationsByLayers, type StaffBuilderAnnotationLayer } from "./staff-builder-annotation-layers";
import { describeStaffBuilderAnnotation, STAFF_BUILDER_ANNOTATION_KIND_LABELS } from "./staff-builder-annotation-presentation";
import type { StaffBuilderAnnotation, StaffBuilderScore, StaffBuilderStaff } from "./staff-builder-types";
import type { StaffBuilderSystemRenderResult } from "./notation/render-staff-builder-system";
import { translateStaffBuilderSystemBoundsToDocument, type StaffBuilderLayoutBounds, type StaffBuilderScoreDocumentLayout } from "./notation/staff-builder-system-layout";

export type StaffBuilderStudyAnnotationRecord = Readonly<{
  annotation: StaffBuilderAnnotation;
  annotationIndex: number;
  measureIndex: number;
  measureNumber: number;
  eventStartTick?: number;
  eventStaff?: StaffBuilderStaff;
  content: string;
  kindLabel: string;
  locationLabel: string;
}>;

export type StaffBuilderStudyAnnotationMarker = Readonly<{
  key: string;
  kind: StaffBuilderAnnotation["kind"];
  label: "N" | "P" | "B";
  count: number;
  bounds: StaffBuilderLayoutBounds;
  records: readonly StaffBuilderStudyAnnotationRecord[];
  accessibleName: string;
}>;

export type StaffBuilderStudyAnnotationProjection = Readonly<{
  records: readonly StaffBuilderStudyAnnotationRecord[];
  markers: readonly StaffBuilderStudyAnnotationMarker[];
}>;

const kindOrder = { "study-note": 0, "practice-mark": 1, bookmark: 2 } as const;

export function getStaffBuilderStudyAnnotationMarkerKey(annotation: StaffBuilderAnnotation): string {
  const anchor = annotation.anchor;
  return `${anchor.kind}:${anchor.kind === "measure" ? anchor.measureId : anchor.eventId}:${annotation.kind}`;
}

export function projectStaffBuilderStudyAnnotations(
  score: StaffBuilderScore,
  layout: StaffBuilderScoreDocumentLayout,
  results: readonly StaffBuilderSystemRenderResult[],
  visibleLayers: ReadonlySet<StaffBuilderAnnotationLayer>,
): StaffBuilderStudyAnnotationProjection {
  const measureById = new Map(score.measures.map((measure, measureIndex) => [measure.id, { measure, measureIndex }] as const));
  const eventById = new Map(score.measures.flatMap((measure, measureIndex) => measure.events.map((event, eventIndex) => [event.id, { event, eventIndex, measureIndex }] as const)));
  const visible = new Set(filterStaffBuilderAnnotationsByLayers(score.annotations, visibleLayers));
  const records = score.annotations.flatMap((annotation, annotationIndex): StaffBuilderStudyAnnotationRecord[] => {
    if (!visible.has(annotation)) return [];
    const resolved = annotation.anchor.kind === "measure" ? measureById.get(annotation.anchor.measureId) : eventById.get(annotation.anchor.eventId);
    if (!resolved) return [];
    const measureIndex = resolved.measureIndex;
    const event = "event" in resolved ? resolved.event : undefined;
    return [{ annotation, annotationIndex, measureIndex, measureNumber: measureIndex + 1, ...(event ? { eventStartTick: event.startTick, eventStaff: event.staff } : {}), content: describeStaffBuilderAnnotation(annotation), kindLabel: STAFF_BUILDER_ANNOTATION_KIND_LABELS[annotation.kind], locationLabel: annotation.anchor.kind === "measure" ? `Measure ${measureIndex + 1}` : `Event in Measure ${measureIndex + 1}` }];
  }).sort((left, right) => left.measureIndex - right.measureIndex
    || Number(left.annotation.anchor.kind === "event") - Number(right.annotation.anchor.kind === "event")
    || (left.eventStartTick ?? -1) - (right.eventStartTick ?? -1)
    || (left.eventStaff === right.eventStaff ? 0 : left.eventStaff === "treble" ? -1 : 1)
    || left.annotationIndex - right.annotationIndex);

  const geometry = new Map<string, { bounds: StaffBuilderLayoutBounds; systemBounds: StaffBuilderLayoutBounds }>();
  results.forEach((result) => {
    const system = layout.systems.find(({ systemIndex }) => systemIndex === result.system.systemIndex);
    if (!system) return;
    const systemBounds = { x: system.x, y: system.y, width: system.width, height: system.height };
    result.measures.forEach((measure) => geometry.set(`measure:${measure.measureId}`, { bounds: translateStaffBuilderSystemBoundsToDocument(measure.bounds, system), systemBounds }));
    result.events.forEach((event, eventId) => geometry.set(`event:${eventId}`, { bounds: translateStaffBuilderSystemBoundsToDocument(event, system), systemBounds }));
  });
  const groups = new Map<string, StaffBuilderStudyAnnotationRecord[]>();
  records.forEach((record) => {
    const key = getStaffBuilderStudyAnnotationMarkerKey(record.annotation);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  const markers = [...groups.entries()].flatMap(([key, grouped]): StaffBuilderStudyAnnotationMarker[] => {
    const first = grouped[0]!;
    const anchor = first.annotation.anchor;
    const found = geometry.get(`${anchor.kind}:${anchor.kind === "measure" ? anchor.measureId : anchor.eventId}`);
    if (!found) return [];
    const clusterIndex = kindOrder[first.annotation.kind];
    const desiredX = found.bounds.x + found.bounds.width - 18;
    const desiredY = anchor.kind === "measure" ? found.bounds.y + 6 + clusterIndex * 30 : found.bounds.y - 26 + clusterIndex * 30;
    const x = Math.max(found.systemBounds.x, Math.min(desiredX, found.systemBounds.x + found.systemBounds.width - 28));
    const y = Math.max(found.systemBounds.y, Math.min(desiredY, found.systemBounds.y + found.systemBounds.height - 28));
    const kindLabel = STAFF_BUILDER_ANNOTATION_KIND_LABELS[first.annotation.kind];
    return [{ key, kind: first.annotation.kind, label: first.annotation.kind === "study-note" ? "N" : first.annotation.kind === "practice-mark" ? "P" : "B", count: grouped.length, bounds: { x, y, width: 28, height: 28 }, records: grouped, accessibleName: `${grouped.length === 1 ? kindLabel : `${kindLabel}s, ${grouped.length} annotations`}, Measure ${first.measureNumber}, ${anchor.kind}` }];
  });
  return { records, markers };
}
