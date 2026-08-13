import { MUSIC_KEYS, type MusicKeyId } from "@/lib/music/keys";
import {
  STAFF_BUILDER_DURATIONS,
  STAFF_BUILDER_STEP_DURATIONS,
  STAFF_BUILDER_TIME_SIGNATURES,
  getMeasureCapacityTicks,
  type StaffBuilderDuration,
  type StaffBuilderTimeSignature,
} from "../staff-builder-time";
import type { StaffBuilderCaptureState } from "../staff-builder-capture";
import type { StaffBuilderRhythmState } from "../staff-builder-rhythm";
import type {
  StaffBuilderAccidental,
  StaffBuilderAnnotation,
  StaffBuilderAnnotationAnchor,
  StaffBuilderEvent,
  StaffBuilderEventRhythm,
  StaffBuilderMeasure,
  StaffBuilderPitch,
  StaffBuilderScore,
  StaffBuilderScoreV1,
  StaffBuilderTie,
} from "../staff-builder-types";

export type StaffBuilderLibraryV1 = Readonly<{
  schemaVersion: 1;
  pieces: readonly StaffBuilderScoreV1[];
}>;

export type StaffBuilderLibraryV2 = Readonly<{
  schemaVersion: 2;
  pieces: readonly StaffBuilderScore[];
}>;

export type StaffBuilderLibrary = StaffBuilderLibraryV2;

export type StaffBuilderDraftV1 = Readonly<{
  schemaVersion: 1;
  savedPieceId: string | null;
  updatedAt: string;
  score: StaffBuilderScoreV1;
  editorPass: "capture" | "rhythm";
  captureState?: StaffBuilderCaptureState;
  rhythmState?: StaffBuilderRhythmState;
}>;

export type StaffBuilderDraftV2 = Readonly<Omit<StaffBuilderDraftV1, "schemaVersion" | "score"> & {
  schemaVersion: 2;
  score: StaffBuilderScore;
}>;

export type StaffBuilderDraft = StaffBuilderDraftV2;

export type StaffBuilderParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: "corrupt" | "unsupported"; message: string }>;

const KEY_IDS = new Set<string>(MUSIC_KEYS.map(({ id }) => id));
const TIME_SIGNATURES = new Set<string>(STAFF_BUILDER_TIME_SIGNATURES);
const DURATIONS = new Set<string>(STAFF_BUILDER_DURATIONS);
const LETTERS = new Set(["A", "B", "C", "D", "E", "F", "G"]);
const ACCIDENTALS = new Set<StaffBuilderAccidental>(["flat", "natural", "sharp"]);
const STEP_DURATIONS = new Set<string>(STAFF_BUILDER_STEP_DURATIONS);
const INPUT_MODES = new Set(["grand", "treble", "bass"]);
const PRACTICE_MARK_CATEGORIES = new Set(["needs-work", "rhythm", "hands-separate", "check-fingering", "other"]);
const BOOKMARK_CATEGORIES = new Set(["interesting", "needs-work", "question", "revisit"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

function isKeyId(value: unknown): value is MusicKeyId {
  return typeof value === "string" && KEY_IDS.has(value);
}

function isTimeSignature(value: unknown): value is StaffBuilderTimeSignature {
  return typeof value === "string" && TIME_SIGNATURES.has(value);
}

function isDuration(value: unknown): value is StaffBuilderDuration {
  return typeof value === "string" && DURATIONS.has(value);
}

function parseRhythm(value: unknown): StaffBuilderEventRhythm | null {
  if (!isRecord(value)) return null;
  if (value.status === "unresolved") return { status: "unresolved" };
  if (value.status === "final" && isDuration(value.duration)) {
    return { status: "final", duration: value.duration };
  }
  return null;
}

function parsePitch(value: unknown): StaffBuilderPitch | null {
  if (!isRecord(value) || !isId(value.id) || !Number.isInteger(value.midiNumber)
    || (value.midiNumber as number) < 0 || (value.midiNumber as number) > 127
    || typeof value.letter !== "string" || !LETTERS.has(value.letter)
    || typeof value.accidental !== "string" || !ACCIDENTALS.has(value.accidental as StaffBuilderAccidental)
    || !Number.isInteger(value.octave)) return null;
  return {
    id: value.id,
    midiNumber: value.midiNumber as number,
    letter: value.letter as StaffBuilderPitch["letter"],
    accidental: value.accidental as StaffBuilderAccidental,
    octave: value.octave as number,
  };
}

function parseEvent(value: unknown): StaffBuilderEvent | null {
  if (!isRecord(value) || !isId(value.id) || (value.staff !== "treble" && value.staff !== "bass")
    || !Number.isInteger(value.startTick) || (value.startTick as number) < 0) return null;
  const rhythm = parseRhythm(value.rhythm);
  if (!rhythm) return null;
  const base = {
    id: value.id,
    staff: value.staff as "treble" | "bass",
    startTick: value.startTick as number,
  };
  if (value.kind === "rest") {
    return rhythm.status === "final" ? { ...base, kind: "rest", rhythm } : null;
  }
  if (value.kind !== "notes" || !Array.isArray(value.pitches) || value.pitches.length === 0) return null;
  const pitches = value.pitches.map(parsePitch);
  if (pitches.some((pitch) => pitch === null)) return null;
  const parsedPitches = pitches as StaffBuilderPitch[];
  if (new Set(parsedPitches.map(({ id }) => id)).size !== parsedPitches.length
    || new Set(parsedPitches.map(({ midiNumber }) => midiNumber)).size !== parsedPitches.length) return null;
  return { ...base, kind: "notes", rhythm, pitches: parsedPitches };
}

function parseMeasure(value: unknown): StaffBuilderMeasure | null {
  if (!isRecord(value) || !isId(value.id) || !Array.isArray(value.events)
    || (value.keySignatureChange !== undefined && !isKeyId(value.keySignatureChange))
    || (value.timeSignatureChange !== undefined && !isTimeSignature(value.timeSignatureChange))) return null;
  const events = value.events.map(parseEvent);
  if (events.some((event) => event === null)) return null;
  return {
    id: value.id,
    ...(value.keySignatureChange === undefined ? {} : { keySignatureChange: value.keySignatureChange as MusicKeyId }),
    ...(value.timeSignatureChange === undefined ? {} : { timeSignatureChange: value.timeSignatureChange as StaffBuilderTimeSignature }),
    events: events as StaffBuilderEvent[],
  };
}

function parseTie(value: unknown): StaffBuilderTie | null {
  if (!isRecord(value) || !isId(value.id) || !isId(value.fromEventId)
    || !isId(value.fromPitchId) || !isId(value.toEventId) || !isId(value.toPitchId)) return null;
  return {
    id: value.id, fromEventId: value.fromEventId, fromPitchId: value.fromPitchId,
    toEventId: value.toEventId, toPitchId: value.toPitchId,
  };
}

function parseAnnotationAnchor(value: unknown): StaffBuilderAnnotationAnchor | null {
  if (!isRecord(value)) return null;
  if (value.kind === "event" && isId(value.eventId)) return { kind: "event", eventId: value.eventId };
  if (value.kind === "measure" && isId(value.measureId)) return { kind: "measure", measureId: value.measureId };
  return null;
}

function parseAnnotation(value: unknown): StaffBuilderAnnotation | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const anchor = parseAnnotationAnchor(value.anchor);
  if (!anchor) return null;
  if (value.kind === "study-note" && typeof value.text === "string" && value.text.trim().length > 0) {
    return { id: value.id, kind: "study-note", anchor, text: value.text };
  }
  if (value.kind === "practice-mark" && typeof value.category === "string" && PRACTICE_MARK_CATEGORIES.has(value.category)
    && (value.text === undefined || typeof value.text === "string")
    && (value.category !== "other" || (typeof value.text === "string" && value.text.trim().length > 0))) {
    return {
      id: value.id,
      kind: "practice-mark",
      anchor,
      category: value.category as Extract<StaffBuilderAnnotation, { kind: "practice-mark" }>["category"],
      ...(value.text === undefined ? {} : { text: value.text }),
    };
  }
  if (value.kind === "bookmark" && typeof value.category === "string" && BOOKMARK_CATEGORIES.has(value.category)) {
    return { id: value.id, kind: "bookmark", anchor, category: value.category as Extract<StaffBuilderAnnotation, { kind: "bookmark" }>["category"] };
  }
  return null;
}

function unsupportedVersion(value: unknown): boolean {
  return isRecord(value) && "schemaVersion" in value && value.schemaVersion !== 1 && value.schemaVersion !== 2;
}

export function parseStaffBuilderScore(value: unknown): StaffBuilderParseResult<StaffBuilderScore> {
  if (unsupportedVersion(value)) return { ok: false, reason: "unsupported", message: "This Staff Builder score uses an unsupported version." };
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !isId(value.id)
    || typeof value.title !== "string" || value.title.trim().length === 0
    || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)
    || !Number.isInteger(value.tempoBpm) || (value.tempoBpm as number) < 40 || (value.tempoBpm as number) > 240
    || !isKeyId(value.initialKeySignatureId) || !isTimeSignature(value.initialTimeSignature)
    || !Array.isArray(value.measures) || value.measures.length === 0 || !Array.isArray(value.ties)
    || (value.schemaVersion === 2 && !Array.isArray(value.annotations))) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder score is invalid." };
  }
  const measures = value.measures.map(parseMeasure);
  const ties = value.ties.map(parseTie);
  if (measures.some((measure) => measure === null) || ties.some((tie) => tie === null)) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder score contains invalid notation data." };
  }
  const parsedMeasures = measures as StaffBuilderMeasure[];
  const parsedTies = ties as StaffBuilderTie[];
  const annotations = value.schemaVersion === 1 ? [] : (value.annotations as unknown[]).map(parseAnnotation);
  if (annotations.some((annotation) => annotation === null)) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder score contains invalid annotation data." };
  }
  const parsedAnnotations = annotations as StaffBuilderAnnotation[];
  if (new Set(parsedMeasures.map(({ id }) => id)).size !== parsedMeasures.length
    || new Set(parsedMeasures.flatMap(({ events }) => events.map(({ id }) => id))).size !== parsedMeasures.reduce((count, measure) => count + measure.events.length, 0)
    || new Set(parsedTies.map(({ id }) => id)).size !== parsedTies.length
    || new Set(parsedAnnotations.map(({ id }) => id)).size !== parsedAnnotations.length) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder score contains duplicate notation IDs." };
  }
  const measureIds = new Set(parsedMeasures.map(({ id }) => id));
  const eventIds = new Set(parsedMeasures.flatMap(({ events }) => events.map(({ id }) => id)));
  if (parsedAnnotations.some(({ anchor }) => anchor.kind === "measure" ? !measureIds.has(anchor.measureId) : !eventIds.has(anchor.eventId))) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder score contains an annotation with a missing anchor." };
  }
  return { ok: true, value: {
    schemaVersion: 2, id: value.id, title: value.title, createdAt: value.createdAt,
    updatedAt: value.updatedAt, tempoBpm: value.tempoBpm as number,
    initialKeySignatureId: value.initialKeySignatureId, initialTimeSignature: value.initialTimeSignature,
    measures: parsedMeasures, ties: parsedTies, annotations: parsedAnnotations,
  } };
}

export function parseStaffBuilderLibrary(value: unknown): StaffBuilderParseResult<StaffBuilderLibrary> {
  if (unsupportedVersion(value)) return { ok: false, reason: "unsupported", message: "The Staff Builder library uses a newer unsupported version." };
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !Array.isArray(value.pieces)) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder library is invalid." };
  }
  const pieces: StaffBuilderScore[] = [];
  for (const candidate of value.pieces) {
    const result = parseStaffBuilderScore(candidate);
    if (!result.ok) return result;
    pieces.push(result.value);
  }
  if (new Set(pieces.map(({ id }) => id)).size !== pieces.length) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder library contains duplicate piece IDs." };
  }
  return { ok: true, value: { schemaVersion: 2, pieces } };
}

export function parseStaffBuilderDraft(value: unknown): StaffBuilderParseResult<StaffBuilderDraft> {
  if (unsupportedVersion(value)) return { ok: false, reason: "unsupported", message: "The Staff Builder draft uses a newer unsupported version." };
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
    || (value.savedPieceId !== null && !isId(value.savedPieceId))
    || !isTimestamp(value.updatedAt) || (value.editorPass !== "capture" && value.editorPass !== "rhythm")) {
    return { ok: false, reason: "corrupt", message: "The stored Staff Builder draft is invalid." };
  }
  const score = parseStaffBuilderScore(value.score);
  if (!score.ok) return score;
  let captureState: StaffBuilderCaptureState | undefined;
  if (value.captureState !== undefined) {
    const candidate = value.captureState;
    if (!isRecord(candidate) || !isRecord(candidate.cursor)
      || !Number.isInteger(candidate.cursor.measureIndex) || (candidate.cursor.measureIndex as number) < 0
      || !Number.isInteger(candidate.cursor.offsetTicks) || (candidate.cursor.offsetTicks as number) < 0
      || typeof candidate.stepDuration !== "string" || !STEP_DURATIONS.has(candidate.stepDuration)
      || (candidate.inputMode !== undefined
        ? typeof candidate.inputMode !== "string" || !INPUT_MODES.has(candidate.inputMode)
        : candidate.activeStaff !== "treble" && candidate.activeStaff !== "bass")) {
      return { ok: false, reason: "corrupt", message: "The stored Staff Builder draft has invalid capture state." };
    }
    const measureIndex = candidate.cursor.measureIndex as number;
    const offsetTicks = candidate.cursor.offsetTicks as number;
    let effectiveTime = score.value.initialTimeSignature;
    for (let index = 0; index <= measureIndex && index < score.value.measures.length; index += 1) {
      effectiveTime = score.value.measures[index]?.timeSignatureChange ?? effectiveTime;
    }
    if (measureIndex >= score.value.measures.length || offsetTicks % 120 !== 0) {
      return { ok: false, reason: "corrupt", message: "The stored Staff Builder draft has an invalid capture position." };
    }
    const capacityTicks = getMeasureCapacityTicks(effectiveTime);
    captureState = {
      cursor: { measureIndex, offsetTicks: offsetTicks < capacityTicks ? offsetTicks : 0 },
      stepDuration: candidate.stepDuration as StaffBuilderCaptureState["stepDuration"],
      inputMode: (candidate.inputMode ?? candidate.activeStaff) as StaffBuilderCaptureState["inputMode"],
    };
  }
  let rhythmState: StaffBuilderRhythmState | undefined;
  if (value.rhythmState !== undefined) {
    const candidate = value.rhythmState;
    if (!isRecord(candidate) || !Number.isInteger(candidate.measureIndex) || (candidate.measureIndex as number) < 0
      || (candidate.selectedEventId !== null && !isId(candidate.selectedEventId))) {
      return { ok: false, reason: "corrupt", message: "The stored Staff Builder draft has invalid rhythm selection state." };
    }
    const measureIndex = candidate.measureIndex as number;
    const selectedEventId = candidate.selectedEventId as string | null;
    const safeMeasureIndex = Math.min(measureIndex, score.value.measures.length - 1);
    const selectedLocation = selectedEventId === null ? null : score.value.measures.findIndex((measure) => measure.events.some(({ id }) => id === selectedEventId));
    rhythmState = selectedLocation !== null && selectedLocation >= 0
      ? { measureIndex: selectedLocation, selectedEventId }
      : { measureIndex: safeMeasureIndex, selectedEventId: null };
  }
  return { ok: true, value: {
    schemaVersion: 2, savedPieceId: value.savedPieceId as string | null,
    updatedAt: value.updatedAt, score: score.value, editorPass: value.editorPass,
    ...(captureState ? { captureState } : {}),
    ...(rhythmState ? { rhythmState } : {}),
  } };
}
