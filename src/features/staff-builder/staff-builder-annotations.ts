import type {
  StaffBuilderAnnotation,
  StaffBuilderAnnotationAnchor,
  StaffBuilderScore,
} from "./staff-builder-types";
import type { StaffBuilderFactories } from "./staff-builder-score";

const defaultFactories: Pick<StaffBuilderFactories, "now"> = { now: () => new Date().toISOString() };

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
  const annotations = score.annotations.filter(({ anchor }) => isStaffBuilderAnnotationAnchorValid(score, anchor));
  return annotations.length === score.annotations.length ? score : { ...score, annotations };
}

export function addStaffBuilderAnnotation(
  score: StaffBuilderScore,
  annotation: StaffBuilderAnnotation,
  factories: Pick<StaffBuilderFactories, "now"> = defaultFactories,
): StaffBuilderScore {
  if (score.annotations.some(({ id }) => id === annotation.id)) {
    throw new Error(`Duplicate Staff Builder annotation ID ${annotation.id}.`);
  }
  if (!isStaffBuilderAnnotationAnchorValid(score, annotation.anchor)) {
    throw new Error("Staff Builder annotation anchor does not exist in the score.");
  }
  return { ...score, updatedAt: factories.now(), annotations: [...score.annotations, annotation] };
}

export function updateStaffBuilderAnnotation(
  score: StaffBuilderScore,
  annotation: StaffBuilderAnnotation,
  factories: Pick<StaffBuilderFactories, "now"> = defaultFactories,
): StaffBuilderScore {
  const index = score.annotations.findIndex(({ id }) => id === annotation.id);
  if (index < 0) throw new Error(`Unknown Staff Builder annotation ID ${annotation.id}.`);
  if (!isStaffBuilderAnnotationAnchorValid(score, annotation.anchor)) {
    throw new Error("Staff Builder annotation anchor does not exist in the score.");
  }
  return {
    ...score,
    updatedAt: factories.now(),
    annotations: score.annotations.map((current, currentIndex) => currentIndex === index ? annotation : current),
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
