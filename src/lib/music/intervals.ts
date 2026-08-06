export type MusicalInterval =
  | "minor-second"
  | "major-second"
  | "minor-third"
  | "major-third"
  | "perfect-fourth"
  | "perfect-fifth"
  | "minor-sixth"
  | "major-sixth"
  | "minor-seventh"
  | "major-seventh"
  | "octave";

export type IntervalDirection = "ascending" | "descending";

const INTERVAL_DEFINITIONS: Readonly<
  Record<
    MusicalInterval,
    Readonly<{ diatonicSteps: number; label: string; semitones: number }>
  >
> = {
  "minor-second": { diatonicSteps: 1, label: "Minor second", semitones: 1 },
  "major-second": { diatonicSteps: 1, label: "Major second", semitones: 2 },
  "minor-third": { diatonicSteps: 2, label: "Minor third", semitones: 3 },
  "major-third": { diatonicSteps: 2, label: "Major third", semitones: 4 },
  "perfect-fourth": { diatonicSteps: 3, label: "Perfect fourth", semitones: 5 },
  "perfect-fifth": { diatonicSteps: 4, label: "Perfect fifth", semitones: 7 },
  "minor-sixth": { diatonicSteps: 5, label: "Minor sixth", semitones: 8 },
  "major-sixth": { diatonicSteps: 5, label: "Major sixth", semitones: 9 },
  "minor-seventh": { diatonicSteps: 6, label: "Minor seventh", semitones: 10 },
  "major-seventh": { diatonicSteps: 6, label: "Major seventh", semitones: 11 },
  octave: { diatonicSteps: 7, label: "Octave", semitones: 12 },
};

export const MUSICAL_INTERVALS = Object.freeze(
  Object.keys(INTERVAL_DEFINITIONS) as MusicalInterval[],
);

export function getIntervalSemitones(interval: MusicalInterval): number {
  return INTERVAL_DEFINITIONS[interval].semitones;
}

export function getIntervalDiatonicSteps(interval: MusicalInterval): number {
  return INTERVAL_DEFINITIONS[interval].diatonicSteps;
}

export function getIntervalLabel(interval: MusicalInterval): string {
  return INTERVAL_DEFINITIONS[interval].label;
}
