import { createTheoryPracticeNote, getTheoryRootLetterCandidates, type NoteLetter } from "@/lib/music/note-utils";
import type { StaffBuilderFactories } from "./staff-builder-score";
import type { StaffBuilderDuration } from "./staff-builder-time";
import { formatStaffBuilderCapturePosition } from "./staff-builder-capture";
import { resolveStaffBuilderMeasureContext } from "./staff-builder-score";
import type { StaffBuilderAccidental, StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1, StaffBuilderStaff } from "./staff-builder-types";

export type StaffBuilderEventSelection = Readonly<{ measureIndex: number; eventId: string }>;
export type StaffBuilderRhythmState = Readonly<{ measureIndex: number; selectedEventId: string | null }>;
export type StaffBuilderRhythmEditError = "staff-conflict" | "tied-event" | "event-missing" | "pitch-missing" | "invalid-spelling";
export type StaffBuilderRhythmEditResult =
  | Readonly<{ ok: true; score: StaffBuilderScoreV1 }>
  | Readonly<{ ok: false; error: StaffBuilderRhythmEditError; score: StaffBuilderScoreV1 }>;

const defaultFactories: Pick<StaffBuilderFactories, "now"> = { now: () => new Date().toISOString() };

export function getStaffBuilderEventSelections(score: StaffBuilderScoreV1): readonly StaffBuilderEventSelection[] {
  return score.measures.flatMap((measure, measureIndex) => measure.events.map((event) => ({ measureIndex, event })))
    .sort((left, right) => left.measureIndex - right.measureIndex
      || left.event.startTick - right.event.startTick
      || (left.event.staff === right.event.staff ? 0 : left.event.staff === "treble" ? -1 : 1)
      || left.event.id.localeCompare(right.event.id))
    .map(({ measureIndex, event }) => ({ measureIndex, eventId: event.id }));
}

export function getSelectedStaffBuilderEvent(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection | null): StaffBuilderEvent | null {
  if (!selection) return null;
  return score.measures[selection.measureIndex]?.events.find(({ id }) => id === selection.eventId) ?? null;
}

export function getInitialStaffBuilderRhythmSelection(score: StaffBuilderScoreV1): StaffBuilderEventSelection | null {
  const ordered = getStaffBuilderEventSelections(score);
  return ordered.find((selection) => getSelectedStaffBuilderEvent(score, selection)?.rhythm.status === "unresolved") ?? ordered[0] ?? null;
}

export function moveStaffBuilderEventSelection(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection, direction: "previous" | "next"): StaffBuilderEventSelection {
  const ordered = getStaffBuilderEventSelections(score);
  const index = ordered.findIndex((candidate) => candidate.measureIndex === selection.measureIndex && candidate.eventId === selection.eventId);
  if (index < 0) return getInitialStaffBuilderRhythmSelection(score) ?? selection;
  return ordered[direction === "next" ? Math.min(index + 1, ordered.length - 1) : Math.max(index - 1, 0)] ?? selection;
}

export function reconcileStaffBuilderEventSelection(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection | null): StaffBuilderEventSelection | null {
  return getSelectedStaffBuilderEvent(score, selection) ? selection : getInitialStaffBuilderRhythmSelection(score);
}

function updateSelectedEvent(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection, change: (event: StaffBuilderEvent) => StaffBuilderEvent, factories: Pick<StaffBuilderFactories, "now">): StaffBuilderRhythmEditResult {
  const measure = score.measures[selection.measureIndex];
  if (!measure || !measure.events.some(({ id }) => id === selection.eventId)) return { ok: false, error: "event-missing", score };
  return {
    ok: true,
    score: {
      ...score,
      updatedAt: factories.now(),
      measures: score.measures.map((item, index) => index === selection.measureIndex
        ? { ...item, events: item.events.map((event) => event.id === selection.eventId ? change(event) : event) }
        : item),
    },
  };
}

export function setStaffBuilderEventDuration(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection, duration: StaffBuilderDuration, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  const event = getSelectedStaffBuilderEvent(score, selection);
  if (event?.rhythm.status === "final" && event.rhythm.duration === duration) return { ok: true, score };
  return updateSelectedEvent(score, selection, (event) => ({ ...event, rhythm: { status: "final", duration } }), factories);
}

export function staffBuilderEventParticipatesInTie(score: StaffBuilderScoreV1, eventId: string): boolean {
  return score.ties.some((tie) => tie.fromEventId === eventId || tie.toEventId === eventId);
}

export function convertStaffBuilderEventToRest(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection, duration: StaffBuilderDuration, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  if (staffBuilderEventParticipatesInTie(score, selection.eventId)) return { ok: false, error: "tied-event", score };
  return updateSelectedEvent(score, selection, (event) => ({ id: event.id, kind: "rest", staff: event.staff, startTick: event.startTick, rhythm: { status: "final", duration } }), factories);
}

export function moveStaffBuilderEventToStaff(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection, staff: StaffBuilderStaff, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  const selected = getSelectedStaffBuilderEvent(score, selection);
  if (!selected) return { ok: false, error: "event-missing", score };
  if (selected.staff === staff) return { ok: true, score };
  const conflict = score.measures[selection.measureIndex]?.events.some((event) => event.id !== selected.id && event.staff === staff && event.startTick === selected.startTick);
  if (conflict) return { ok: false, error: "staff-conflict", score };
  return updateSelectedEvent(score, selection, (event) => ({ ...event, staff }), factories);
}

function accidentalFromName(name: string): StaffBuilderAccidental {
  return name.includes("♯") ? "sharp" : name.includes("♭") ? "flat" : "natural";
}

export function getStaffBuilderPitchSpellingCandidates(pitch: StaffBuilderPitch): readonly StaffBuilderPitch[] {
  return getTheoryRootLetterCandidates(pitch.midiNumber).map((letter) => {
    const note = createTheoryPracticeNote(pitch.midiNumber, letter);
    return { ...pitch, letter, accidental: accidentalFromName(note.name), octave: note.octave };
  });
}

export function respellStaffBuilderPitch(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection, pitchId: string, letter: NoteLetter, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  const event = getSelectedStaffBuilderEvent(score, selection);
  if (!event) return { ok: false, error: "event-missing", score };
  if (event.kind !== "notes") return { ok: false, error: "pitch-missing", score };
  const pitch = event.pitches.find(({ id }) => id === pitchId);
  if (!pitch) return { ok: false, error: "pitch-missing", score };
  if (pitch.letter === letter) return { ok: true, score };
  const candidate = getStaffBuilderPitchSpellingCandidates(pitch).find((item) => item.letter === letter);
  if (!candidate) return { ok: false, error: "invalid-spelling", score };
  return updateSelectedEvent(score, selection, (item) => item.kind === "notes"
    ? { ...item, pitches: item.pitches.map((current) => current.id === pitchId ? candidate : current) }
    : item, factories);
}

export function deleteStaffBuilderEvent(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): Readonly<{ result: StaffBuilderRhythmEditResult; selection: StaffBuilderEventSelection | null }> {
  if (staffBuilderEventParticipatesInTie(score, selection.eventId)) return { result: { ok: false, error: "tied-event", score }, selection };
  const ordered = getStaffBuilderEventSelections(score);
  const selectedIndex = ordered.findIndex((candidate) => candidate.measureIndex === selection.measureIndex && candidate.eventId === selection.eventId);
  if (selectedIndex < 0) return { result: { ok: false, error: "event-missing", score }, selection };
  const measure = score.measures[selection.measureIndex];
  if (!measure) return { result: { ok: false, error: "event-missing", score }, selection };
  const nextScore = { ...score, updatedAt: factories.now(), measures: score.measures.map((item, index) => index === selection.measureIndex ? { ...item, events: item.events.filter(({ id }) => id !== selection.eventId) } : item) };
  const remaining = getStaffBuilderEventSelections(nextScore);
  return { result: { ok: true, score: nextScore }, selection: remaining[selectedIndex] ?? remaining[selectedIndex - 1] ?? null };
}

export function describeStaffBuilderSelectedEvent(score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection | null): string {
  const event = getSelectedStaffBuilderEvent(score, selection);
  if (!event || !selection) return "No event selected.";
  const context = resolveStaffBuilderMeasureContext(score, selection.measureIndex);
  const position = formatStaffBuilderCapturePosition(context.timeSignature, event.startTick);
  const content = event.kind === "rest" ? "rest" : event.pitches.map((pitch) => `${pitch.letter}${pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : ""}${pitch.octave}`).join(", ");
  const rhythm = event.rhythm.status === "unresolved" ? "unresolved rhythm" : event.rhythm.duration;
  return `Selected event: measure ${selection.measureIndex + 1}, ${event.staff}, ${position}, ${content}, ${rhythm}.`;
}
