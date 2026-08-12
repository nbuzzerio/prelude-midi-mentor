import { describe, expect, it } from "vitest";
import { getMusicKeyDefinition, MUSIC_KEYS } from "@/lib/music/keys";
import { DEFAULT_MELODY_SETTINGS, MELODY_KEY_IDS, MELODY_MEASURE_COUNTS, MELODY_STAFFS, MELODY_TEMPOS, type MelodySettings } from "./melody-types";
import { buildMelodyDiatonicPitchPool, createMelodyGenerationKey, generateMelodyExercise, MELODY_RHYTHM_TEMPLATES } from "./melody-generator";

function settings(overrides: Partial<MelodySettings> = {}): MelodySettings {
  return { ...DEFAULT_MELODY_SETTINGS, ...overrides };
}

function eventsFor(seed: string | number, overrides: Partial<MelodySettings> = {}) {
  return generateMelodyExercise(settings(overrides), seed).measures.flatMap(({ events }) => events);
}

describe("Melody exercise generation", () => {
  it("provides valid approved defaults and accepts every Phase 1 setting dimension", () => {
    expect(DEFAULT_MELODY_SETTINGS).toEqual({ staff: "treble", keyId: "c-major", tempoBpm: 60, measureCount: 1, pitchDifficulty: "easy", rhythmDifficulty: "easy" });
    for (const staff of MELODY_STAFFS) for (const keyId of MELODY_KEY_IDS) for (const tempoBpm of MELODY_TEMPOS) for (const measureCount of MELODY_MEASURE_COUNTS) {
      expect(() => generateMelodyExercise(settings({ staff, keyId, tempoBpm, measureCount }), `${staff}-${keyId}-${tempoBpm}-${measureCount}`)).not.toThrow();
    }
  });

  it("rejects unsupported runtime settings instead of silently normalizing them", () => {
    expect(() => generateMelodyExercise({ ...settings(), tempoBpm: 55 } as unknown as MelodySettings, 1)).toThrow("Unsupported Melody settings");
  });

  it("is deterministic for settings and seed, including stable IDs and Retry Same identity", () => {
    const first = generateMelodyExercise(settings({ measureCount: 2, keyId: "f-major" }), "retry-seed");
    const second = generateMelodyExercise(settings({ measureCount: 2, keyId: "f-major" }), "retry-seed");
    expect(second).toEqual(first);
    expect(first.id).toMatch(/^melody-/);
    expect(first.measures.map(({ id }) => id)).toEqual([`${first.id}-measure-1`, `${first.id}-measure-2`]);
    expect(first.expectedAttacks.map(({ id }) => id)).toEqual(first.measures.flatMap(({ events }) => events).map(({ id }) => `${id}-attack`));
  });

  it("canonicalizes semantic settings independently of object property insertion order", () => {
    const conventional = settings({ staff: "bass", keyId: "d-minor", tempoBpm: 80, measureCount: 2 });
    const differentlyConstructed = {
      rhythmDifficulty: "easy" as const,
      measureCount: 2 as const,
      keyId: "d-minor" as const,
      pitchDifficulty: "easy" as const,
      tempoBpm: 80 as const,
      staff: "bass" as const,
    };

    expect(Object.keys(differentlyConstructed)).not.toEqual(Object.keys(conventional));
    expect(createMelodyGenerationKey(conventional, "canonical-seed")).toBe("canonical-seed|bass|d-minor|80|2|easy|easy");
    expect(createMelodyGenerationKey(differentlyConstructed, "canonical-seed")).toBe(createMelodyGenerationKey(conventional, "canonical-seed"));
    expect(generateMelodyExercise(differentlyConstructed, "canonical-seed")).toEqual(generateMelodyExercise(conventional, "canonical-seed"));
  });

  it("varies musical content across a fixed set of different seeds", () => {
    const signatures = new Set(Array.from({ length: 12 }, (_, seed) => JSON.stringify(eventsFor(seed).map(({ duration, pitch }) => [duration, pitch.midiNumber]))));
    expect(signatures.size).toBeGreaterThan(5);
  });

  it("keeps the rhythm vocabulary explicit, immutable, complete, and unsyncopated", () => {
    expect(MELODY_RHYTHM_TEMPLATES).toHaveLength(9);
    expect(MELODY_RHYTHM_TEMPLATES.every((template) => template.reduce((sum, duration) => sum + ({ half: 960, quarter: 480, eighth: 240 }[duration]), 0) === 1920)).toBe(true);
    expect(MELODY_RHYTHM_TEMPLATES.every((template) => template.every((duration, index) => duration !== "eighth" || (index > 0 && template[index - 1] === "eighth") || template[index + 1] === "eighth"))).toBe(true);
    expect(Object.isFrozen(MELODY_RHYTHM_TEMPLATES)).toBe(true);
    expect(MELODY_RHYTHM_TEMPLATES.every(Object.isFrozen)).toBe(true);
  });

  it("fills every generated measure exactly and emits only beat-aligned paired eighths", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const exercise = generateMelodyExercise(settings({ measureCount: 2 }), seed);
      for (const measure of exercise.measures) {
        expect(measure.events.at(-1)!.startTick + measure.events.at(-1)!.durationTicks).toBe(1920);
        expect(measure.events.map(({ startTick }) => startTick)).toEqual([...measure.events].map(({ startTick }) => startTick).sort((a, b) => a - b));
        measure.events.forEach((event, index) => {
          expect(["quarter", "half", "eighth"]).toContain(event.duration);
          if (event.duration === "eighth") {
            expect([0, 240]).toContain(event.startTick % 480);
            expect(event.startTick % 480 === 0 ? measure.events[index + 1]?.duration : measure.events[index - 1]?.duration).toBe("eighth");
          }
        });
      }
    }
  });

  it("continues event and absolute-tick ordering across a two-measure barline", () => {
    const exercise = generateMelodyExercise(settings({ measureCount: 2 }), 42);
    expect(exercise.measures[0]!.events.every(({ absoluteTick }) => absoluteTick < 1920)).toBe(true);
    expect(exercise.measures[1]!.events.every(({ absoluteTick }) => absoluteTick >= 1920 && absoluteTick < 3840)).toBe(true);
    expect(exercise.expectedAttacks.map(({ absoluteTick }) => absoluteTick)).toEqual(exercise.measures.flatMap(({ events }) => events).map(({ absoluteTick }) => absoluteTick));
  });

  it.each(MELODY_KEY_IDS)("uses only correctly spelled %s diatonic pitches", (keyId) => {
    const key = getMusicKeyDefinition(keyId);
    const exercise = generateMelodyExercise(settings({ keyId, measureCount: 2 }), `spell-${keyId}`);
    for (const { pitch } of exercise.measures.flatMap(({ events }) => events)) {
      const degree = key.diatonicScale.find(({ pitchClass }) => pitchClass === pitch.midiNumber % 12);
      expect(degree?.letter).toBe(pitch.letter);
    }
  });

  it("spells F-major B-flat and G-major F-sharp without generic respelling", () => {
    const fPool = buildMelodyDiatonicPitchPool(settings({ keyId: "f-major" }));
    expect(fPool.find(({ midiNumber }) => midiNumber % 12 === 10)).toMatchObject({ letter: "B", accidental: "flat" });
    const gPool = buildMelodyDiatonicPitchPool(settings({ keyId: "g-major" }));
    expect(gPool.find(({ midiNumber }) => midiNumber % 12 === 6)).toMatchObject({ letter: "F", accidental: "sharp" });
  });

  it("uses natural-minor pitch collections for A minor and D minor", () => {
    for (const keyId of ["a-minor", "d-minor"] as const) {
      const key = getMusicKeyDefinition(keyId);
      expect(buildMelodyDiatonicPitchPool(settings({ keyId })).map(({ midiNumber }) => midiNumber % 12)).toEqual(expect.arrayContaining(key.diatonicScale.map(({ pitchClass }) => pitchClass)));
    }
  });

  it.each([["treble", 60, 72], ["bass", 48, 60]] as const)("keeps %s pitches inside its compact range", (staff, minimum, maximum) => {
    for (let seed = 0; seed < 50; seed += 1) {
      expect(eventsFor(seed, { staff, measureCount: 2 }).every(({ pitch }) => pitch.midiNumber >= minimum && pitch.midiNumber <= maximum)).toBe(true);
    }
  });

  it("uses tonic, mediant, and dominant starts across fixed seeds without hardcoding tonic", () => {
    const key = getMusicKeyDefinition("c-major");
    const allowed = [0, 2, 4].map((degree) => key.diatonicScale[degree]!.pitchClass);
    const starts = Array.from({ length: 200 }, (_, seed) => eventsFor(seed)[0]!.pitch.midiNumber % 12);
    expect(starts.every((pitchClass) => allowed.includes(pitchClass))).toBe(true);
    expect(new Set(starts)).toEqual(new Set(allowed));
    expect(starts.filter((pitchClass) => pitchClass === key.tonicPitchClass).length).toBeLessThan(120);
  });

  it("resolves the final exercise event to a correctly spelled tonic", () => {
    for (const keyId of MELODY_KEY_IDS) for (let seed = 0; seed < 30; seed += 1) {
      const key = getMusicKeyDefinition(keyId);
      const finalPitch = eventsFor(seed, { keyId, measureCount: 2 }).at(-1)!.pitch;
      expect(finalPitch.midiNumber % 12).toBe(key.tonicPitchClass);
      expect(finalPitch.letter).toBe(key.tonicLetter);
    }
  });

  it("enforces Easy leap, direction, and repetition limits over deterministic seed sweeps", () => {
    let stepCount = 0;
    let largerCount = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const pitches = eventsFor(seed, { measureCount: 2 }).map(({ pitch }) => pitch.midiNumber);
      let direction = 0;
      let directionCount = 0;
      let repeatCount = 1;
      for (let index = 1; index < pitches.length; index += 1) {
        const delta = pitches[index]! - pitches[index - 1]!;
        expect(Math.abs(delta)).toBeLessThanOrEqual(7);
        const nextDirection = Math.sign(delta);
        directionCount = nextDirection === 0 ? 0 : nextDirection === direction ? directionCount + 1 : 1;
        direction = nextDirection;
        expect(directionCount).toBeLessThanOrEqual(3);
        repeatCount = delta === 0 ? repeatCount + 1 : 1;
        expect(repeatCount).toBeLessThanOrEqual(2);
        if (Math.abs(delta) <= 2 && delta !== 0) stepCount += 1;
        else if (delta !== 0) largerCount += 1;
      }
    }
    expect(stepCount).toBeGreaterThan(largerCount);
  });

  it("strongly recovers opposite and by step after a diatonic fourth/fifth where possible", () => {
    let recoverableLeaps = 0;
    let recoveries = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const events = eventsFor(seed, { measureCount: 2 });
      const pool = buildMelodyDiatonicPitchPool(settings());
      const indexes = events.map(({ pitch }) => pool.findIndex(({ midiNumber }) => midiNumber === pitch.midiNumber));
      for (let index = 1; index < indexes.length - 1; index += 1) {
        const leap = indexes[index]! - indexes[index - 1]!;
        if (Math.abs(leap) < 3) continue;
        recoverableLeaps += 1;
        const recovery = indexes[index + 1]! - indexes[index]!;
        if (Math.abs(recovery) <= 2 && Math.sign(recovery) === -Math.sign(leap)) recoveries += 1;
      }
    }
    expect(recoverableLeaps).toBeGreaterThan(20);
    expect(recoveries / recoverableLeaps).toBeGreaterThan(0.75);
  });

  it("carries contour state across the barline rather than restarting measure two", () => {
    const first = generateMelodyExercise(settings({ measureCount: 2 }), "barline-contour");
    const finalFirst = first.measures[0]!.events.at(-1)!;
    const initialSecond = first.measures[1]!.events[0]!;
    expect(initialSecond.absoluteTick).toBe(1920);
    expect(Math.abs(initialSecond.pitch.midiNumber - finalFirst.pitch.midiNumber)).toBeLessThanOrEqual(7);
  });

  it("derives one fully linked expected attack per event with preserved pitch and duration", () => {
    const exercise = generateMelodyExercise(settings({ measureCount: 2, staff: "bass" }), 88);
    const events = exercise.measures.flatMap(({ events }) => events);
    expect(exercise.expectedAttacks).toHaveLength(events.length);
    exercise.expectedAttacks.forEach((attack, index) => {
      const event = events[index]!;
      expect(attack).toMatchObject({ exerciseId: exercise.id, eventId: event.id, measureId: event.measureId, measureIndex: event.measureIndex, staff: event.staff, startTick: event.startTick, absoluteTick: event.absoluteTick, durationTicks: event.durationTicks, midiNumber: event.pitch.midiNumber, writtenPitch: { letter: event.pitch.letter, accidental: event.pitch.accidental, octave: event.pitch.octave } });
    });
  });

  it("does not mutate settings, key definitions, or shared templates", () => {
    const input = settings({ keyId: "f-major", measureCount: 2 });
    const settingsBefore = structuredClone(input);
    const keysBefore = structuredClone(MUSIC_KEYS);
    const templatesBefore = structuredClone(MELODY_RHYTHM_TEMPLATES);
    generateMelodyExercise(input, "immutable");
    expect(input).toEqual(settingsBefore);
    expect(MUSIC_KEYS).toEqual(keysBefore);
    expect(MELODY_RHYTHM_TEMPLATES).toEqual(templatesBefore);
  });
});
