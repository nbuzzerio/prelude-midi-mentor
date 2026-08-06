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
  StaffBuilderScoreV1,
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

function updated(score: StaffBuilderScoreV1, factories: StaffBuilderFactories, changes: Partial<StaffBuilderScoreV1>): StaffBuilderScoreV1 {
  return { ...score, ...changes, updatedAt: factories.now() };
}

function updateMeasure(score: StaffBuilderScoreV1, measureIndex: number, factories: StaffBuilderFactories, change: (measure: StaffBuilderMeasure) => StaffBuilderMeasure): StaffBuilderScoreV1 {
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
}>): StaffBuilderScoreV1 {
  requireTempo(options.tempoBpm);
  requireKey(options.initialKeySignatureId);
  requireTimeSignature(options.initialTimeSignature);
  const factories = options.factories ?? defaultFactories;
  const timestamp = factories.now();
  return {
    schemaVersion: 1,
    id: factories.createId(),
    title: options.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    tempoBpm: options.tempoBpm,
    initialKeySignatureId: options.initialKeySignatureId,
    initialTimeSignature: options.initialTimeSignature,
    measures: [{ id: factories.createId(), events: [] }],
    ties: [],
  };
}

export function appendStaffBuilderMeasure(score: StaffBuilderScoreV1, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScoreV1 {
  return updated(score, factories, { measures: [...score.measures, { id: factories.createId(), events: [] }] });
}

export function renameStaffBuilderScore(score: StaffBuilderScoreV1, title: string, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScoreV1 {
  return updated(score, factories, { title });
}

export function updateStaffBuilderTempo(score: StaffBuilderScoreV1, tempoBpm: number, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScoreV1 {
  requireTempo(tempoBpm);
  return updated(score, factories, { tempoBpm });
}

export function setStaffBuilderMeasureKeySignature(score: StaffBuilderScoreV1, measureIndex: number, keyId: MusicKeyId | null, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScoreV1 {
  if (keyId !== null) requireKey(keyId);
  return updateMeasure(score, measureIndex, factories, (measure) => {
    const { keySignatureChange, ...rest } = measure;
    void keySignatureChange;
    return keyId === null ? rest : { ...rest, keySignatureChange: keyId };
  });
}

export function setStaffBuilderMeasureTimeSignature(score: StaffBuilderScoreV1, measureIndex: number, timeSignature: StaffBuilderTimeSignature | null, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScoreV1 {
  if (timeSignature !== null) requireTimeSignature(timeSignature);
  return updateMeasure(score, measureIndex, factories, (measure) => {
    const { timeSignatureChange, ...rest } = measure;
    void timeSignatureChange;
    return timeSignature === null ? rest : { ...rest, timeSignatureChange: timeSignature };
  });
}

export function resolveStaffBuilderMeasureContext(score: StaffBuilderScoreV1, measureIndex: number): StaffBuilderMeasureContext {
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

function requireStartTick(score: StaffBuilderScoreV1, measureIndex: number, startTick: number): void {
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

export function insertUnresolvedStaffBuilderNotes(score: StaffBuilderScoreV1, options: Readonly<{
  measureIndex: number;
  staff: StaffBuilderStaff;
  startTick: number;
  midiNumbers: Iterable<number>;
  factories?: StaffBuilderFactories;
}>): StaffBuilderScoreV1 {
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
    rhythm: { status: "unresolved" }, pitches,
  };
  return updateMeasure(score, options.measureIndex, factories, (measure) => ({ ...measure, events: replaceAtPosition(measure.events, event) }));
}

export function insertStaffBuilderRest(score: StaffBuilderScoreV1, options: Readonly<{
  measureIndex: number;
  staff: StaffBuilderStaff;
  startTick: number;
  duration: StaffBuilderDuration;
  factories?: StaffBuilderFactories;
}>): StaffBuilderScoreV1 {
  requireStartTick(score, options.measureIndex, options.startTick);
  const factories = options.factories ?? defaultFactories;
  durationToTicks(options.duration);
  const event: StaffBuilderEvent = {
    id: factories.createId(), kind: "rest", staff: options.staff, startTick: options.startTick,
    rhythm: { status: "final", duration: options.duration },
  };
  return updateMeasure(score, options.measureIndex, factories, (measure) => ({ ...measure, events: replaceAtPosition(measure.events, event) }));
}

export function removeStaffBuilderEvent(score: StaffBuilderScoreV1, measureIndex: number, eventId: string, factories: StaffBuilderFactories = defaultFactories): StaffBuilderScoreV1 {
  return updateMeasure(score, measureIndex, factories, (measure) => ({ ...measure, events: measure.events.filter(({ id }) => id !== eventId) }));
}

export function getStaffBuilderEventsInScoreOrder(score: StaffBuilderScoreV1): readonly StaffBuilderEvent[] {
  return score.measures.flatMap((measure, measureIndex) => measure.events.map((event) => ({ event, measureIndex })))
    .sort((left, right) => left.measureIndex - right.measureIndex
      || left.event.startTick - right.event.startTick
      || (left.event.staff === right.event.staff ? 0 : left.event.staff === "treble" ? -1 : 1)
      || left.event.id.localeCompare(right.event.id))
    .map(({ event }) => event);
}
