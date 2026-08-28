import { createTheoryPracticeNote, getTheoryRootLetterCandidates, type NoteLetter } from "@/lib/music/note-utils";
import type { StaffBuilderFactories } from "./staff-builder-score";
import type { StaffBuilderDuration } from "./staff-builder-time";
import { formatStaffBuilderCapturePosition } from "./staff-builder-capture";
import { resolveStaffBuilderMeasureContext } from "./staff-builder-score";
import type { StaffBuilderAccidental, StaffBuilderArpeggiation, StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScore, StaffBuilderStaff } from "./staff-builder-types";
import { getStaffBuilderSamePositionConflicts } from "./staff-builder-voices";

export type StaffBuilderEventSelection = Readonly<{ measureIndex: number; eventId: string }>;
export type StaffBuilderRhythmState = Readonly<{ measureIndex: number; selectedEventId: string | null }>;
export type StaffBuilderRhythmEditError = "staff-conflict" | "tied-event" | "event-missing" | "pitch-missing" | "invalid-spelling" | "invalid-arpeggiation-target";
export type StaffBuilderRhythmEditResult =
  | Readonly<{ ok: true; score: StaffBuilderScore }>
  | Readonly<{ ok: false; error: StaffBuilderRhythmEditError; score: StaffBuilderScore }>;

const defaultFactories: Pick<StaffBuilderFactories, "now"> = { now: () => new Date().toISOString() };

export function getStaffBuilderEventSelections(score: StaffBuilderScore): readonly StaffBuilderEventSelection[] {
  return score.measures.flatMap((measure, measureIndex) => measure.events.map((event) => ({ measureIndex, event })))
    .sort((left, right) => left.measureIndex - right.measureIndex
      || left.event.startTick - right.event.startTick
      || (left.event.staff === right.event.staff ? 0 : left.event.staff === "treble" ? -1 : 1)
      || left.event.id.localeCompare(right.event.id))
    .map(({ measureIndex, event }) => ({ measureIndex, eventId: event.id }));
}

export function getSelectedStaffBuilderEvent(score: StaffBuilderScore, selection: StaffBuilderEventSelection | null): StaffBuilderEvent | null {
  if (!selection) return null;
  return score.measures[selection.measureIndex]?.events.find(({ id }) => id === selection.eventId) ?? null;
}

export function getInitialStaffBuilderRhythmSelection(score: StaffBuilderScore): StaffBuilderEventSelection | null {
  const ordered = getStaffBuilderEventSelections(score);
  return ordered.find((selection) => getSelectedStaffBuilderEvent(score, selection)?.rhythm.status === "unresolved") ?? ordered[0] ?? null;
}

export function moveStaffBuilderEventSelection(score: StaffBuilderScore, selection: StaffBuilderEventSelection, direction: "previous" | "next"): StaffBuilderEventSelection {
  const ordered = getStaffBuilderEventSelections(score);
  const index = ordered.findIndex((candidate) => candidate.measureIndex === selection.measureIndex && candidate.eventId === selection.eventId);
  if (index < 0) return getInitialStaffBuilderRhythmSelection(score) ?? selection;
  return ordered[direction === "next" ? Math.min(index + 1, ordered.length - 1) : Math.max(index - 1, 0)] ?? selection;
}

export function reconcileStaffBuilderEventSelection(score: StaffBuilderScore, selection: StaffBuilderEventSelection | null): StaffBuilderEventSelection | null {
  return getSelectedStaffBuilderEvent(score, selection) ? selection : getInitialStaffBuilderRhythmSelection(score);
}

function updateSelectedEvent(score: StaffBuilderScore, selection: StaffBuilderEventSelection, change: (event: StaffBuilderEvent) => StaffBuilderEvent, factories: Pick<StaffBuilderFactories, "now">): StaffBuilderRhythmEditResult {
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

export function setStaffBuilderEventDuration(score: StaffBuilderScore, selection: StaffBuilderEventSelection, duration: StaffBuilderDuration, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  const event = getSelectedStaffBuilderEvent(score, selection);
  if (event?.rhythm.status === "final" && event.rhythm.duration === duration) return { ok: true, score };
  return updateSelectedEvent(score, selection, (event) => ({ ...event, rhythm: { status: "final", duration } }), factories);
}

export function setStaffBuilderEventArpeggiation(score: StaffBuilderScore, selection: StaffBuilderEventSelection, arpeggiation: StaffBuilderArpeggiation | null, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  const event = getSelectedStaffBuilderEvent(score, selection);
  if (!event) return { ok: false, error: "event-missing", score };
  if (event.kind !== "notes" || event.pitches.length < 2) return { ok: false, error: "invalid-arpeggiation-target", score };
  if ((event.arpeggiation ?? null) === arpeggiation) return { ok: true, score };
  return updateSelectedEvent(score, selection, (item) => {
    if (item.kind !== "notes") return item;
    if (arpeggiation !== null) return { ...item, arpeggiation };
    return { id: item.id, kind: item.kind, staff: item.staff, startTick: item.startTick, rhythm: item.rhythm, pitches: item.pitches };
  }, factories);
}

export function staffBuilderEventParticipatesInTie(score: StaffBuilderScore, eventId: string): boolean {
  return score.ties.some((tie) => tie.fromEventId === eventId || tie.toEventId === eventId);
}

export function convertStaffBuilderEventToRest(score: StaffBuilderScore, selection: StaffBuilderEventSelection, duration: StaffBuilderDuration, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  if (staffBuilderEventParticipatesInTie(score, selection.eventId)) return { ok: false, error: "tied-event", score };
  return updateSelectedEvent(score, selection, (event) => ({ id: event.id, kind: "rest", staff: event.staff, startTick: event.startTick, rhythm: { status: "final", duration } }), factories);
}

export function moveStaffBuilderEventToStaff(score: StaffBuilderScore, selection: StaffBuilderEventSelection, staff: StaffBuilderStaff, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
  const selected = getSelectedStaffBuilderEvent(score, selection);
  if (!selected) return { ok: false, error: "event-missing", score };
  if (selected.staff === staff) return { ok: true, score };
  if (staffBuilderEventParticipatesInTie(score, selected.id)) return { ok: false, error: "tied-event", score };
  const destinationEvents = score.measures[selection.measureIndex]?.events.filter((event) => event.id !== selected.id && event.staff === staff) ?? [];
  const samePosition = destinationEvents.filter((event) => event.startTick === selected.startTick);
  const moved = { ...selected, staff };
  const conflict = samePosition.some((event) => event.rhythm.status === "unresolved" || moved.rhythm.status === "unresolved")
    || getStaffBuilderSamePositionConflicts([...destinationEvents, moved]).some(({ eventIds }) => eventIds.includes(selected.id));
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

export function respellStaffBuilderPitch(score: StaffBuilderScore, selection: StaffBuilderEventSelection, pitchId: string, letter: NoteLetter, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderRhythmEditResult {
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

export function deleteStaffBuilderEvent(score: StaffBuilderScore, selection: StaffBuilderEventSelection, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): Readonly<{ result: StaffBuilderRhythmEditResult; selection: StaffBuilderEventSelection | null }> {
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

export function describeStaffBuilderSelectedEvent(score: StaffBuilderScore, selection: StaffBuilderEventSelection | null): string {
  const event = getSelectedStaffBuilderEvent(score, selection);
  if (!event || !selection) return "No event selected.";
  const context = resolveStaffBuilderMeasureContext(score, selection.measureIndex);
  const position = formatStaffBuilderCapturePosition(context.timeSignature, event.startTick);
  const content = event.kind === "rest" ? "rest" : `${event.arpeggiation === "up" ? "arpeggiated chord " : ""}${event.pitches.map((pitch) => `${pitch.letter}${pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : ""}${pitch.octave}`).join(", ")}${event.arpeggiation === "up" ? ", rolled upward" : ""}`;
  const rhythm = event.rhythm.status === "unresolved" ? "unresolved rhythm" : event.rhythm.duration;
  return `Selected event: measure ${selection.measureIndex + 1}, ${event.staff}, ${position}, ${content}, ${rhythm}.`;
}
