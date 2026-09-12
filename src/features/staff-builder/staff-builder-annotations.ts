import type {
  StaffBuilderAnnotation,
  StaffBuilderAnnotationAnchor,
  StaffBuilderScore,
} from "./staff-builder-types";
import type { StaffBuilderFactories } from "./staff-builder-score";

const defaultFactories: Pick<StaffBuilderFactories, "now"> = { now: () => new Date().toISOString() };
export const STAFF_BUILDER_LYRIC_CUE_MAX_LENGTH = 60;

function normalizeAnnotation(annotation: StaffBuilderAnnotation): StaffBuilderAnnotation {
  return annotation.kind === "lyric-cue" ? { ...annotation, text: annotation.text.trim() } : annotation;
}

function assertValidLyricCue(score: StaffBuilderScore, annotation: StaffBuilderAnnotation, replacingId?: string): void {
  if (annotation.kind !== "lyric-cue") return;
  if (annotation.anchor.kind !== "event") throw new Error("Lyric cues must be attached to an event.");
  const eventId = annotation.anchor.eventId;
  const event = score.measures.flatMap(({ events }) => events).find(({ id }) => id === eventId);
  if (!event || event.kind !== "notes" || event.staff !== "treble") throw new Error("Lyric cues require a treble note event.");
  if (!annotation.text.trim() || annotation.text.length > STAFF_BUILDER_LYRIC_CUE_MAX_LENGTH) throw new Error("Lyric cue text is invalid.");
  if (score.annotations.some((current) => current.id !== replacingId && current.kind === "lyric-cue" && current.anchor.kind === "event" && current.anchor.eventId === eventId)) {
    throw new Error("A lyric cue already exists for this event.");
  }
}

export type StaffBuilderResolvedAnnotationAnchor =
  | Readonly<{ kind: "event"; measureId: string; eventId: string }>
  | Readonly<{ kind: "measure"; measureId: string }>;

export function resolveStaffBuilderAnnotationAnchor(
  score: StaffBuilderScore,
  anchor: StaffBuilderAnnotationAnchor,
): StaffBuilderResolvedAnnotationAnchor | null {
  if (anchor.kind === "measure") {
    return score.measures.some(({ id }) => id === anchor.measureId)
      ? anchor
      : null;
  }
  for (const measure of score.measures) {
    if (measure.events.some(({ id }) => id === anchor.eventId)) {
      return { kind: "event", measureId: measure.id, eventId: anchor.eventId };
    }
  }
  return null;
}

export function isStaffBuilderAnnotationAnchorValid(
  score: StaffBuilderScore,
  anchor: StaffBuilderAnnotationAnchor,
): boolean {
  return resolveStaffBuilderAnnotationAnchor(score, anchor) !== null;
}

export function reconcileStaffBuilderAnnotations(score: StaffBuilderScore): StaffBuilderScore {
  const annotations = score.annotations.filter((annotation) => {
    if (!isStaffBuilderAnnotationAnchorValid(score, annotation.anchor)) return false;
    if (annotation.kind !== "lyric-cue" || annotation.anchor.kind !== "event") return true;
    const eventId = annotation.anchor.eventId;
    const event = score.measures.flatMap(({ events }) => events).find(({ id }) => id === eventId);
    return event?.kind === "notes" && event.staff === "treble";
  });
  return annotations.length === score.annotations.length ? score : { ...score, annotations };
}

export function addStaffBuilderAnnotation(
  score: StaffBuilderScore,
  annotation: StaffBuilderAnnotation,
  factories: Pick<StaffBuilderFactories, "now"> = defaultFactories,
): StaffBuilderScore {
  const normalized = normalizeAnnotation(annotation);
  assertValidLyricCue(score, normalized);
  if (score.annotations.some(({ id }) => id === normalized.id)) {
    throw new Error(`Duplicate Staff Builder annotation ID ${normalized.id}.`);
  }
  if (!isStaffBuilderAnnotationAnchorValid(score, normalized.anchor)) {
    throw new Error("Staff Builder annotation anchor does not exist in the score.");
  }
  return { ...score, updatedAt: factories.now(), annotations: [...score.annotations, normalized] };
}

export function updateStaffBuilderAnnotation(
  score: StaffBuilderScore,
  annotation: StaffBuilderAnnotation,
  factories: Pick<StaffBuilderFactories, "now"> = defaultFactories,
): StaffBuilderScore {
  const normalized = normalizeAnnotation(annotation);
  assertValidLyricCue(score, normalized, normalized.id);
  const index = score.annotations.findIndex(({ id }) => id === normalized.id);
  if (index < 0) throw new Error(`Unknown Staff Builder annotation ID ${normalized.id}.`);
  if (!isStaffBuilderAnnotationAnchorValid(score, normalized.anchor)) {
    throw new Error("Staff Builder annotation anchor does not exist in the score.");
  }
  return {
    ...score,
    updatedAt: factories.now(),
    annotations: score.annotations.map((current, currentIndex) => currentIndex === index ? normalized : current),
  };
}

export function deleteStaffBuilderAnnotation(
  score: StaffBuilderScore,
  annotationId: string,
  factories: Pick<StaffBuilderFactories, "now"> = defaultFactories,
): StaffBuilderScore {
  const annotations = score.annotations.filter(({ id }) => id !== annotationId);
  return annotations.length === score.annotations.length ? score : { ...score, updatedAt: factories.now(), annotations };
}
