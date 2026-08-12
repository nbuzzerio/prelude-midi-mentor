import { getMusicKeyDefinition } from "@/lib/music/keys";
import { spellKeyAwareMidiNumber } from "@/lib/music/key-aware-spelling";
import { durationToTicks, getMeasureStartTick, type StaffBuilderDuration } from "@/features/staff-builder/staff-builder-time";
import { MELODY_PHASE_ONE_METER } from "./melody-meter";
import {
  MELODY_KEY_IDS,
  MELODY_MEASURE_COUNTS,
  MELODY_STAFFS,
  MELODY_TEMPOS,
  type MelodyExercise,
  type MelodyExpectedAttack,
  type MelodyNoteEvent,
  type MelodySeed,
  type MelodySettings,
  type MelodyStaff,
} from "./melody-types";

type MelodyDuration = MelodyNoteEvent["duration"];
type MelodyPitch = MelodyNoteEvent["pitch"];
type RandomSource = () => number;

export const MELODY_RHYTHM_TEMPLATES: readonly (readonly MelodyDuration[])[] = Object.freeze([
  ["quarter", "quarter", "quarter", "quarter"],
  ["half", "quarter", "quarter"],
  ["quarter", "quarter", "half"],
  ["half", "half"],
  ["eighth", "eighth", "quarter", "quarter", "quarter"],
  ["quarter", "eighth", "eighth", "quarter", "quarter"],
  ["quarter", "quarter", "eighth", "eighth", "quarter"],
  ["quarter", "quarter", "quarter", "eighth", "eighth"],
  ["eighth", "eighth", "eighth", "eighth", "quarter", "quarter"],
].map((template) => Object.freeze(template as MelodyDuration[])));

const PITCH_RANGES: Readonly<Record<MelodyStaff, Readonly<{ minMidi: number; maxMidi: number }>>> = Object.freeze({
  treble: Object.freeze({ minMidi: 60, maxMidi: 72 }),
  bass: Object.freeze({ minMidi: 48, maxMidi: 60 }),
});

function hashSeed(seed: MelodySeed): number {
  const value = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createMelodySeededRandom(seed: MelodySeed): RandomSource {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMelodyGenerationKey(settings: MelodySettings, seed: MelodySeed): string {
  return [
    String(seed),
    settings.staff,
    settings.keyId,
    String(settings.tempoBpm),
    String(settings.measureCount),
    settings.pitchDifficulty,
    settings.rhythmDifficulty,
  ].join("|");
}

export function getMelodyPitchRange(staff: MelodyStaff): Readonly<{ minMidi: number; maxMidi: number }> {
  return PITCH_RANGES[staff];
}

export function buildMelodyDiatonicPitchPool(settings: Pick<MelodySettings, "keyId" | "staff">): readonly MelodyPitch[] {
  const range = getMelodyPitchRange(settings.staff);
  const key = getMusicKeyDefinition(settings.keyId);
  const pitches: MelodyPitch[] = [];
  for (let midiNumber = range.minMidi; midiNumber <= range.maxMidi; midiNumber += 1) {
    if (!key.diatonicScale.some(({ pitchClass }) => pitchClass === midiNumber % 12)) continue;
    const note = spellKeyAwareMidiNumber({ context: { type: "key", keyId: settings.keyId }, midiNumber });
    if (!note) throw new Error(`Unable to spell Melody pitch MIDI ${midiNumber}.`);
    const symbol = note.name.slice(1);
    pitches.push(Object.freeze({
      midiNumber,
      letter: note.name[0] as MelodyPitch["letter"],
      accidental: symbol === "♯" ? "sharp" : symbol === "♭" ? "flat" : "natural",
      octave: note.octave,
    }));
  }
  return Object.freeze(pitches);
}

function assertSettings(settings: MelodySettings): void {
  if (!MELODY_STAFFS.includes(settings.staff)
    || !MELODY_KEY_IDS.includes(settings.keyId)
    || !MELODY_TEMPOS.includes(settings.tempoBpm)
    || !MELODY_MEASURE_COUNTS.includes(settings.measureCount)
    || settings.pitchDifficulty !== "easy"
    || settings.rhythmDifficulty !== "easy") throw new Error("Unsupported Melody settings.");
}

function chooseWeighted<T>(items: readonly Readonly<{ value: T; weight: number }>[], random: RandomSource): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let position = random() * total;
  for (const item of items) {
    position -= item.weight;
    if (position < 0) return item.value;
  }
  return items.at(-1)!.value;
}

function tonicIndexes(pool: readonly MelodyPitch[], tonicPitchClass: number): readonly number[] {
  return pool.flatMap((pitch, index) => pitch.midiNumber % 12 === tonicPitchClass ? [index] : []);
}

function chooseStartingIndex(pool: readonly MelodyPitch[], settings: MelodySettings, random: RandomSource): number {
  const key = getMusicKeyDefinition(settings.keyId);
  const weightedDegrees = [{ degree: 0, weight: 4 }, { degree: 2, weight: 3 }, { degree: 4, weight: 3 }];
  const choices = weightedDegrees.flatMap(({ degree, weight }) => pool.flatMap((pitch, index) =>
    pitch.midiNumber % 12 === key.diatonicScale[degree]!.pitchClass ? [{ value: index, weight }] : []));
  return chooseWeighted(choices, random);
}

type MotionState = Readonly<{ direction: -1 | 0 | 1; sameDirectionCount: number; repeatedPitchCount: number; intervalSize: number }>;

function nextMotionState(previous: MotionState, offset: number): MotionState {
  const direction = Math.sign(offset) as -1 | 0 | 1;
  return {
    direction,
    sameDirectionCount: direction === 0 ? 0 : direction === previous.direction ? previous.sameDirectionCount + 1 : 1,
    repeatedPitchCount: offset === 0 ? previous.repeatedPitchCount + 1 : 1,
    intervalSize: Math.abs(offset),
  };
}

function chooseNextIndex(options: Readonly<{
  currentIndex: number;
  pool: readonly MelodyPitch[];
  state: MotionState;
  random: RandomSource;
  mustReachTonicNext: boolean;
  tonicIndexes: readonly number[];
}>): Readonly<{ index: number; state: MotionState }> {
  const { currentIndex, pool, state, random, mustReachTonicNext } = options;
  const offsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  let candidates = offsets.filter((offset) => {
    const index = currentIndex + offset;
    if (index < 0 || index >= pool.length) return false;
    if (offset === 0 && state.repeatedPitchCount >= 2) return false;
    const direction = Math.sign(offset);
    if (direction !== 0 && direction === state.direction && state.sameDirectionCount >= 3) return false;
    if (mustReachTonicNext) {
      const prospectiveState = nextMotionState(state, offset);
      const canResolve = options.tonicIndexes.some((tonicIndex) => {
        const finalOffset = tonicIndex - index;
        const finalDirection = Math.sign(finalOffset);
        return Math.abs(finalOffset) <= 4
          && !(finalOffset === 0 && prospectiveState.repeatedPitchCount >= 2)
          && !(finalDirection !== 0 && finalDirection === prospectiveState.direction && prospectiveState.sameDirectionCount >= 3);
      });
      if (!canResolve) return false;
    }
    return true;
  });

  if (state.intervalSize >= 3) {
    const recovery = candidates.filter((offset) => Math.abs(offset) <= 2 && Math.sign(offset) === -state.direction);
    if (recovery.length > 0) candidates = recovery;
  }
  if (candidates.length === 0) candidates = offsets.filter((offset) => currentIndex + offset >= 0 && currentIndex + offset < pool.length && Math.abs(offset) <= 2);

  const weighted = candidates.map((offset) => ({
    value: offset,
    weight: offset === 0 ? 5 : Math.abs(offset) === 1 ? 65 / 2 : Math.abs(offset) === 2 ? 25 / 2 : 10 / 4,
  }));
  const offset = chooseWeighted(weighted, random);
  return { index: currentIndex + offset, state: nextMotionState(state, offset) };
}

function chooseFinalTonic(currentIndex: number, indexes: readonly number[], state: MotionState): number {
  const valid = indexes.filter((index) => {
    const offset = index - currentIndex;
    const direction = Math.sign(offset);
    return Math.abs(offset) <= 4
      && !(offset === 0 && state.repeatedPitchCount >= 2)
      && !(direction !== 0 && direction === state.direction && state.sameDirectionCount >= 3);
  });
  const candidates = valid.length > 0 ? valid : indexes.filter((index) => Math.abs(index - currentIndex) <= 4);
  return [...candidates].sort((left, right) => Math.abs(left - currentIndex) - Math.abs(right - currentIndex) || left - right)[0]!;
}

export function buildMelodyExpectedAttacks(exerciseId: string, events: readonly MelodyNoteEvent[]): readonly MelodyExpectedAttack[] {
  return Object.freeze([...events].sort((left, right) => left.absoluteTick - right.absoluteTick || left.id.localeCompare(right.id)).map((event) => Object.freeze({
    id: `${event.id}-attack`, exerciseId, eventId: event.id, measureId: event.measureId,
    measureIndex: event.measureIndex, staff: event.staff, startTick: event.startTick,
    absoluteTick: event.absoluteTick, durationTicks: event.durationTicks, midiNumber: event.pitch.midiNumber,
    writtenPitch: Object.freeze({ letter: event.pitch.letter, accidental: event.pitch.accidental, octave: event.pitch.octave }),
  })));
}

export function generateMelodyExercise(settings: MelodySettings, seed: MelodySeed): MelodyExercise {
  assertSettings(settings);
  const stableSettings = Object.freeze({ ...settings });
  const generationKey = createMelodyGenerationKey(settings, seed);
  const random = createMelodySeededRandom(generationKey);
  const identityHash = hashSeed(generationKey).toString(36);
  const exerciseId = `melody-${identityHash}`;
  const pool = buildMelodyDiatonicPitchPool(settings);
  const key = getMusicKeyDefinition(settings.keyId);
  const tonics = tonicIndexes(pool, key.tonicPitchClass);
  const templates = Array.from({ length: settings.measureCount }, () => MELODY_RHYTHM_TEMPLATES[Math.floor(random() * MELODY_RHYTHM_TEMPLATES.length)]!);
  const totalEvents = templates.reduce((sum, template) => sum + template.length, 0);
  const pitchIndexes: number[] = [chooseStartingIndex(pool, settings, random)];
  let motion: MotionState = { direction: 0, sameDirectionCount: 0, repeatedPitchCount: 1, intervalSize: 0 };
  for (let eventIndex = 1; eventIndex < totalEvents - 1; eventIndex += 1) {
    const next = chooseNextIndex({ currentIndex: pitchIndexes.at(-1)!, pool, state: motion, random, mustReachTonicNext: eventIndex === totalEvents - 2, tonicIndexes: tonics });
    pitchIndexes.push(next.index);
    motion = next.state;
  }
  if (totalEvents > 1) pitchIndexes.push(chooseFinalTonic(pitchIndexes.at(-1)!, tonics, motion));

  let pitchCursor = 0;
  const capacities = Array.from({ length: settings.measureCount }, () => MELODY_PHASE_ONE_METER.capacityTicks);
  const measures = templates.map((template, measureIndex) => {
    const measureId = `${exerciseId}-measure-${measureIndex + 1}`;
    let startTick = 0;
    const events = template.map((duration, eventIndex) => {
      const durationTicks = durationToTicks(duration as StaffBuilderDuration);
      const pitch = pool[pitchIndexes[pitchCursor]!]!;
      pitchCursor += 1;
      const event = Object.freeze({
        id: `${measureId}-event-${eventIndex + 1}`, measureId, measureIndex, staff: settings.staff,
        startTick, absoluteTick: getMeasureStartTick(capacities, measureIndex) + startTick,
        duration, durationTicks, pitch,
      });
      startTick += durationTicks;
      return event;
    });
    return Object.freeze({ id: measureId, measureIndex, capacityTicks: MELODY_PHASE_ONE_METER.capacityTicks, events: Object.freeze(events) });
  });
  const allEvents = measures.flatMap(({ events }) => events);
  return Object.freeze({ id: exerciseId, seed, settings: stableSettings, measures: Object.freeze(measures), expectedAttacks: buildMelodyExpectedAttacks(exerciseId, allEvents) });
}
