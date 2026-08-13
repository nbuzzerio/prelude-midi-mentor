import { useState } from "react";
import {
  addStaffBuilderAnnotation,
  deleteStaffBuilderAnnotation,
  updateStaffBuilderAnnotation,
} from "../staff-builder-annotations";
import type { StaffBuilderAnnotationLayer } from "../staff-builder-annotation-layers";
import type {
  StaffBuilderAnnotation,
  StaffBuilderAnnotationAnchor,
  StaffBuilderBookmarkCategory,
  StaffBuilderPracticeMarkCategory,
  StaffBuilderScore,
} from "../staff-builder-types";

const KIND_LABELS = { "study-note": "Study Note", "practice-mark": "Practice Mark", bookmark: "Bookmark" } as const;
const PRACTICE_CATEGORIES: readonly Readonly<{ value: StaffBuilderPracticeMarkCategory; label: string }>[] = [
  { value: "needs-work", label: "Needs work" },
  { value: "rhythm", label: "Rhythm" },
  { value: "hands-separate", label: "Hands separate" },
  { value: "check-fingering", label: "Check fingering" },
  { value: "other", label: "Other" },
];
const BOOKMARK_CATEGORIES: readonly Readonly<{ value: StaffBuilderBookmarkCategory; label: string }>[] = [
  { value: "interesting", label: "Interesting" },
  { value: "needs-work", label: "Needs work" },
  { value: "question", label: "Question" },
  { value: "revisit", label: "Revisit" },
];
const LAYER_CONTROLS: readonly Readonly<{ layer: StaffBuilderAnnotationLayer; label: string }>[] = [
  { layer: "study-notes", label: "Study Notes" },
  { layer: "practice-marks", label: "Practice Marks" },
  { layer: "bookmarks", label: "Bookmarks" },
];

type FormKind = StaffBuilderAnnotation["kind"];
function annotationSummary(annotation: StaffBuilderAnnotation): string {
  if (annotation.kind === "study-note") return annotation.text;
  if (annotation.kind === "practice-mark") {
    const label = PRACTICE_CATEGORIES.find(({ value }) => value === annotation.category)?.label ?? annotation.category;
    return annotation.category === "other" ? annotation.text ?? label : label;
  }
  return BOOKMARK_CATEGORIES.find(({ value }) => value === annotation.category)?.label ?? annotation.category;
}

export function StaffBuilderAnnotationsPanel({
  score,
  measureIndex,
  selectedEventId,
  visibleLayers,
  onLayerVisibilityChange,
  onScoreMutation,
  createId = () => crypto.randomUUID(),
  now,
}: Readonly<{
  score: StaffBuilderScore;
  measureIndex: number;
  selectedEventId: string | null;
  visibleLayers: ReadonlySet<StaffBuilderAnnotationLayer>;
  onLayerVisibilityChange: (layer: StaffBuilderAnnotationLayer, visible: boolean) => void;
  onScoreMutation: (score: StaffBuilderScore) => boolean;
  createId?: () => string;
  now?: () => string;
}>) {
  const measure = score.measures[measureIndex];
  const eventIds = new Set(measure?.events.map(({ id }) => id) ?? []);
  const relevant = score.annotations.filter(({ anchor }) => anchor.kind === "measure"
    ? anchor.measureId === measure?.id
    : eventIds.has(anchor.eventId));
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<FormKind>("study-note");
  const [anchor, setAnchor] = useState<StaffBuilderAnnotationAnchor | null>(null);
  const [originalEditAnchor, setOriginalEditAnchor] = useState<StaffBuilderAnnotationAnchor | null>(null);
  const [text, setText] = useState("");
  const [practiceCategory, setPracticeCategory] = useState<StaffBuilderPracticeMarkCategory>("needs-work");
  const [bookmarkCategory, setBookmarkCategory] = useState<StaffBuilderBookmarkCategory>("interesting");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setKind("study-note");
    setAnchor(null);
    setOriginalEditAnchor(null);
    setText("");
    setPracticeCategory("needs-work");
    setBookmarkCategory("interesting");
    setError(null);
  };
  const beginAdd = () => {
    resetForm();
    setAnchor(selectedEventId ? { kind: "event", eventId: selectedEventId } : measure ? { kind: "measure", measureId: measure.id } : null);
    setFormOpen(true);
  };
  const beginEdit = (annotation: StaffBuilderAnnotation) => {
    setEditingId(annotation.id);
    setKind(annotation.kind);
    setAnchor(annotation.anchor);
    setOriginalEditAnchor(annotation.anchor);
    setText(annotation.kind === "study-note" ? annotation.text : annotation.kind === "practice-mark" ? annotation.text ?? "" : "");
    if (annotation.kind === "practice-mark") setPracticeCategory(annotation.category);
    if (annotation.kind === "bookmark") setBookmarkCategory(annotation.category);
    setError(null);
    setFormOpen(true);
  };
  const submit = () => {
    if (!anchor) { setError("Choose an available annotation target."); return; }
    const trimmed = text.trim();
    if (kind === "study-note" && !trimmed) { setError("Enter study note text."); return; }
    if (kind === "practice-mark" && practiceCategory === "other" && !trimmed) { setError("Describe the other practice mark."); return; }
    const id = editingId ?? createId();
    const annotation: StaffBuilderAnnotation = kind === "study-note"
      ? { id, kind, anchor, text: trimmed }
      : kind === "practice-mark"
        ? { id, kind, anchor, category: practiceCategory, ...(practiceCategory === "other" ? { text: trimmed } : {}) }
        : { id, kind, anchor, category: bookmarkCategory };
    const factories = now ? { now } : undefined;
    const next = editingId
      ? updateStaffBuilderAnnotation(score, annotation, factories)
      : addStaffBuilderAnnotation(score, annotation, factories);
    if (onScoreMutation(next)) resetForm();
  };

  return <section aria-labelledby="staff-builder-annotations-title" className="staff-builder-annotations-panel">
    <div className="staff-builder-annotations-heading">
      <div><h3 id="staff-builder-annotations-title">Study annotations</h3><p>Measure {measureIndex + 1}{selectedEventId ? " · Selected event available" : " · No event selected"}</p></div>
      <button className="staff-builder-primary-button" onClick={beginAdd} type="button">Add Annotation</button>
    </div>
    <fieldset className="staff-builder-annotation-layers"><legend>Score annotation layers</legend>{LAYER_CONTROLS.map(({ layer, label }) => <label key={layer}><input checked={visibleLayers.has(layer)} onChange={(event) => onLayerVisibilityChange(layer, event.target.checked)} type="checkbox" />{label}</label>)}</fieldset>
    {formOpen && <div aria-label={editingId ? "Edit annotation" : "Add annotation"} className="staff-builder-annotation-form" role="group">
      <label>Annotation type<select onChange={(event) => { setKind(event.target.value as FormKind); setError(null); }} value={kind}><option value="study-note">Study Note</option><option value="practice-mark">Practice Mark</option><option value="bookmark">Bookmark</option></select></label>
      <fieldset><legend>Attach to</legend><label><input checked={anchor?.kind === "measure" && anchor.measureId === measure?.id} name="annotation-anchor" onChange={() => setAnchor(measure ? { kind: "measure", measureId: measure.id } : null)} type="radio" />Current measure</label>{originalEditAnchor?.kind === "event" && originalEditAnchor.eventId !== selectedEventId && <label><input checked={anchor?.kind === "event" && anchor.eventId === originalEditAnchor.eventId} name="annotation-anchor" onChange={() => setAnchor(originalEditAnchor)} type="radio" />Existing event</label>}{selectedEventId && <label><input checked={anchor?.kind === "event" && anchor.eventId === selectedEventId} name="annotation-anchor" onChange={() => setAnchor({ kind: "event", eventId: selectedEventId })} type="radio" />Selected event</label>}</fieldset>
      {kind === "study-note" && <label>Study note<textarea onChange={(event) => setText(event.target.value)} rows={3} value={text} /></label>}
      {kind === "practice-mark" && <><label>Practice mark<select onChange={(event) => { setPracticeCategory(event.target.value as StaffBuilderPracticeMarkCategory); setError(null); }} value={practiceCategory}>{PRACTICE_CATEGORIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>{practiceCategory === "other" && <label>Other practice mark<input onChange={(event) => setText(event.target.value)} value={text} /></label>}</>}
      {kind === "bookmark" && <label>Bookmark category<select onChange={(event) => setBookmarkCategory(event.target.value as StaffBuilderBookmarkCategory)} value={bookmarkCategory}>{BOOKMARK_CATEGORIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>}
      {error && <p className="staff-builder-annotation-error">{error}</p>}
      <div className="staff-builder-annotation-form-actions"><button className="staff-builder-primary-button" onClick={submit} type="button">{editingId ? "Save Annotation" : "Add Annotation"}</button><button className="staff-builder-secondary-button" onClick={resetForm} type="button">Cancel</button></div>
    </div>}
    <div className="staff-builder-annotation-list">{relevant.length === 0 ? <p>No annotations in this measure.</p> : relevant.map((annotation) => {
      const selected = annotation.anchor.kind === "event" && annotation.anchor.eventId === selectedEventId;
      const typeLabel = KIND_LABELS[annotation.kind];
      const location = annotation.anchor.kind === "measure" ? `Measure ${measureIndex + 1}` : selected ? "Selected event" : "Event in this measure";
      return <article className="staff-builder-annotation-item" data-selected-event={selected || undefined} key={annotation.id}><div><strong>{typeLabel}</strong><span>{location}</span><p>{annotationSummary(annotation)}</p></div><div><button aria-label={`Edit ${typeLabel}: ${annotationSummary(annotation)}`} className="staff-builder-secondary-button" onClick={() => beginEdit(annotation)} type="button">Edit</button><button aria-label={`Delete ${typeLabel}: ${annotationSummary(annotation)}`} className="staff-builder-danger-button" onClick={() => onScoreMutation(deleteStaffBuilderAnnotation(score, annotation.id, now ? { now } : undefined))} type="button">Delete</button></div></article>;
    })}</div>
  </section>;
}
