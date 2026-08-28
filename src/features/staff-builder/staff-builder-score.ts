import { getMusicKeyDefinition, type MusicKeyId } from "@/lib/music/keys";
import { spellKeyAwareMidiNumber } from "@/lib/music/key-aware-spelling";
import {
  durationToTicks,
  getMeasureCapacityTicks,
  type StaffBuilderDuration,
  type StaffBuilderTimeSignature,
} from "./staff-builder-time";
import type {
  StaffBuilderAccidental,
  StaffBuilderEvent,
  StaffBuilderMeasure,
  StaffBuilderMeasureContext,
  StaffBuilderPitch,
  StaffBuilderScore,
  StaffBuilderStaff,
} from "./staff-builder-types";

export type StaffBuilderFactories = Readonly<{
  createId: () => string;
  now: () => string;
}>;

const defaultFactories: StaffBuilderFactories = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

function requireTempo(tempoBpm: number): void {
  if (!Number.isInteger(tempoBpm) || tempoBpm <= 0) throw new Error("Tempo must be a positive integer.");
}

function requireKey(keyId: MusicKeyId): void {
  getMusicKeyDefinition(keyId);
}

function requireTimeSignature(timeSignature: StaffBuilderTimeSignature): void {
  getMeasureCapacityTicks(timeSignature);
}

function updated(score: StaffBuilderScore, factories: StaffBuilderFactories, changes: Partial<StaffBuilderScore>): StaffBuilderScore {
  return { ...score, ...changes, updatedAt: factories.now() };
}

function updateMeasure(score: StaffBuilderScore, measureIndex: number, factories: StaffBuilderFactories, change: (measure: StaffBuilderMeasure) => StaffBuilderMeasure): StaffBuilderScore {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`Unknown measure index ${measureIndex}.`);
  const measures = score.measures.map((item, index) => index === measureIndex ? change(item) : item);
  return updated(score, factories, { measures });
}

export function createStaffBuilderScore(options: Readonly<{
  title: string;
  tempoBpm: number;
  initialKeySignatureId: MusicKeyId;
  initialTimeSignature: StaffBuilderTimeSignature;
  factories?: StaffBuilderFactories;
}>): StaffBuilderScore {
  requireTempo(options.tempoBpm);
  requireKey(options.initialKeySignatureId);
  requireTimeSignature(options.initialTimeSignature);
  const factories = options.factories ?? defaultFactories;
  const timestamp = factories.now();
  return {
    schemaVersion: 3,
    id: factories.createId(),
    title: options.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    tempoBpm: options.tempoBpm,
    initialKeySignatureId: options.initialKeySignatureId,
    initialTimeSignature: options.initialTimeSignature,
    measures: [{ id: factories.createId(), events: [] }],
    ties: [],
    annotations: [],
  };
}

export function appendStaffBuilderMeasure(score: StaffBuilderScore, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScore {
  return updated(score, factories, { measures: [...score.measures, { id: factories.createId(), events: [] }] });
}

export type InsertStaffBuilderMeasureResult =
  | Readonly<{ ok: true; score: StaffBuilderScore; measureIndex: number }>
  | Readonly<{ ok: false; score: StaffBuilderScore; error: "invalid-index" | "tie-crosses-boundary" }>;

export function insertStaffBuilderMeasure(score: StaffBuilderScore, insertionIndex: number, factories: StaffBuilderFactories = defaultFactories): InsertStaffBuilderMeasureResult {
  if (!Number.isInteger(insertionIndex) || insertionIndex < 0 || insertionIndex > score.measures.length) {
    return { ok: false, score, error: "invalid-index" };
  }
  if (insertionIndex > 0 && insertionIndex < score.measures.length) {
    const eventMeasureIndexes = new Map<string, number>();
    score.measures.forEach((measure, measureIndex) => measure.events.forEach(({ id }) => eventMeasureIndexes.set(id, measureIndex)));
    if (score.ties.some(({ fromEventId, toEventId }) => eventMeasureIndexes.get(fromEventId) === insertionIndex - 1 && eventMeasureIndexes.get(toEventId) === insertionIndex)) {
      return { ok: false, score, error: "tie-crosses-boundary" };
    }
  }
  const measure: StaffBuilderMeasure = { id: factories.createId(), events: [] };
  return { ok: true, measureIndex: insertionIndex, score: updated(score, factories, { measures: [...score.measures.slice(0, insertionIndex), measure, ...score.measures.slice(insertionIndex)] }) };
}

export function renameStaffBuilderScore(score: StaffBuilderScore, title: string, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScore {
  return updated(score, factories, { title });
}

export function updateStaffBuilderTempo(score: StaffBuilderScore, tempoBpm: number, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScore {
  requireTempo(tempoBpm);
  return updated(score, factories, { tempoBpm });
}

export function setStaffBuilderMeasureKeySignature(score: StaffBuilderScore, measureIndex: number, keyId: MusicKeyId | null, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScore {
  if (keyId !== null) requireKey(keyId);
  return updateMeasure(score, measureIndex, factories, (measure) => {
    const { keySignatureChange, ...rest } = measure;
    void keySignatureChange;
    return keyId === null ? rest : { ...rest, keySignatureChange: keyId };
  });
}

export function setStaffBuilderMeasureTimeSignature(score: StaffBuilderScore, measureIndex: number, timeSignature: StaffBuilderTimeSignature | null, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScore {
  if (timeSignature !== null) requireTimeSignature(timeSignature);
  return updateMeasure(score, measureIndex, factories, (measure) => {
    const { timeSignatureChange, ...rest } = measure;
    void timeSignatureChange;
    return timeSignature === null ? rest : { ...rest, timeSignatureChange: timeSignature };
  });
}

export function resolveStaffBuilderMeasureContext(score: StaffBuilderScore, measureIndex: number): StaffBuilderMeasureContext {
  if (!Number.isInteger(measureIndex) || measureIndex < 0 || measureIndex >= score.measures.length) {
    throw new Error(`Unknown measure index ${measureIndex}.`);
  }
  let keySignatureId = score.initialKeySignatureId;
  let timeSignature = score.initialTimeSignature;
  for (let index = 0; index <= measureIndex; index += 1) {
    const measure = score.measures[index];
    if (measure?.keySignatureChange) keySignatureId = measure.keySignatureChange;
    if (measure?.timeSignatureChange) timeSignature = measure.timeSignatureChange;
  }
  return { keySignatureId, timeSignature, capacityTicks: getMeasureCapacityTicks(timeSignature) };
}

function requireStartTick(score: StaffBuilderScore, measureIndex: number, startTick: number): void {
  const { capacityTicks } = resolveStaffBuilderMeasureContext(score, measureIndex);
  if (!Number.isInteger(startTick) || startTick < 0 || startTick >= capacityTicks) {
    throw new Error(`Start tick must be an integer from 0 through ${capacityTicks - 1}.`);
  }
}

function accidentalFromName(name: string): StaffBuilderAccidental {
  return name.includes("♯") ? "sharp" : name.includes("♭") ? "flat" : "natural";
}

export function createStaffBuilderPitch(options: Readonly<{
  midiNumber: number;
  keySignatureId: MusicKeyId;
  id: string;
}>): StaffBuilderPitch {
  requireKey(options.keySignatureId);
  const note = spellKeyAwareMidiNumber({ context: { type: "key", keyId: options.keySignatureId }, midiNumber: options.midiNumber });
  if (!note) throw new Error(`Unsupported MIDI pitch ${options.midiNumber}.`);
  return {
    id: options.id,
    midiNumber: note.midiNumber,
    letter: note.name[0] as StaffBuilderPitch["letter"],
    accidental: accidentalFromName(note.name),
    octave: note.octave,
  };
}

function replaceAtPosition(events: readonly StaffBuilderEvent[], event: StaffBuilderEvent): readonly StaffBuilderEvent[] {
  return [...events.filter((item) => item.staff !== event.staff || item.startTick !== event.startTick), event];
}

export function insertStaffBuilderNotes(score: StaffBuilderScore, options: Readonly<{
  measureIndex: number;
  staff: StaffBuilderStaff;
  startTick: number;
  midiNumbers: Iterable<number>;
  rhythm: Extract<StaffBuilderEvent, { kind: "notes" }>["rhythm"];
  factories?: StaffBuilderFactories;
}>): StaffBuilderScore {
  requireStartTick(score, options.measureIndex, options.startTick);
  const factories = options.factories ?? defaultFactories;
  const uniqueMidiNumbers = [...new Set(options.midiNumbers)].sort(
    (left, right) => left - right,
  );
  if (uniqueMidiNumbers.length === 0) throw new Error("A note event requires at least one pitch.");
  const { keySignatureId } = resolveStaffBuilderMeasureContext(score, options.measureIndex);
  const pitches = uniqueMidiNumbers.map((midiNumber) => createStaffBuilderPitch({ midiNumber, keySignatureId, id: factories.createId() }));
  const event: StaffBuilderEvent = {
    id: factories.createId(), kind: "notes", staff: options.staff, startTick: options.startTick,
    rhythm: options.rhythm, pitches,
  };
  return updateMeasure(score, options.measureIndex, factories, (measure) => ({ ...measure, events: replaceAtPosition(measure.events, event) }));
}

export function insertUnresolvedStaffBuilderNotes(score: StaffBuilderScore, options: Readonly<{
  measureIndex: number;
  staff: StaffBuilderStaff;
  startTick: number;
  midiNumbers: Iterable<number>;
  factories?: StaffBuilderFactories;
}>): StaffBuilderScore {
  return insertStaffBuilderNotes(score, { ...options, rhythm: { status: "unresolved" } });
}

export function insertStaffBuilderRest(score: StaffBuilderScore, options: Readonly<{
  measureIndex: number;
  staff: StaffBuilderStaff;
  startTick: number;
  duration: StaffBuilderDuration;
  factories?: StaffBuilderFactories;
}>): StaffBuilderScore {
  requireStartTick(score, options.measureIndex, options.startTick);
  const factories = options.factories ?? defaultFactories;
  durationToTicks(options.duration);
  const event: StaffBuilderEvent = {
    id: factories.createId(), kind: "rest", staff: options.staff, startTick: options.startTick,
    rhythm: { status: "final", duration: options.duration },
  };
  return updateMeasure(score, options.measureIndex, factories, (measure) => ({ ...measure, events: replaceAtPosition(measure.events, event) }));
}

export function removeStaffBuilderEvent(score: StaffBuilderScore, measureIndex: number, eventId: string, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScore {
  return updateMeasure(score, measureIndex, factories, (measure) => ({ ...measure, events: measure.events.filter(({ id }) => id !== eventId) }));
}

export function getStaffBuilderEventsInScoreOrder(score: StaffBuilderScore): readonly StaffBuilderEvent[] {
  return score.measures.flatMap((measure, measureIndex) => measure.events.map((event) => ({ event, measureIndex })))
    .sort((left, right) => left.measureIndex - right.measureIndex
      || left.event.startTick - right.event.startTick
      || (left.event.staff === right.event.staff ? 0 : left.event.staff === "treble" ? -1 : 1)
      || left.event.id.localeCompare(right.event.id))
    .map(({ event }) => event);
}
