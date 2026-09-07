import type { Clef } from "@/types/practice";
import type { NoteLetter } from "@/lib/music/note-utils";
import { NOTE_RANGES } from "@/data/note-ranges";
import { realizeScaleTarget } from "@/lib/music/generators/sequences";

export type ScalePracticeMode = "random" | "repertoire-in-order" | "repertoire-shuffle";
export type RepertoireScaleForm = "major" | "natural-minor" | "harmonic-minor" | "melodic-minor";
export type ScaleTonicId = "c" | "d" | "e" | "f" | "g" | "a" | "b" | "c-sharp" | "f-sharp" | "g-sharp";
export type ScaleRepertoireId = `${ScaleTonicId}-${RepertoireScaleForm}`;
export type ScaleRepertoireEntry = Readonly<{
  id: ScaleRepertoireId;
  tonic: ScaleTonicId;
  form: RepertoireScaleForm;
  name: string;
  disabledReason?: string;
}>;
const TONICS: Readonly<Record<ScaleTonicId, Readonly<{ name: string; letter: NoteLetter; pitchClass: number }>>> = {
  c: { name: "C", letter: "C", pitchClass: 0 }, d: { name: "D", letter: "D", pitchClass: 2 },
  e: { name: "E", letter: "E", pitchClass: 4 }, f: { name: "F", letter: "F", pitchClass: 5 },
  g: { name: "G", letter: "G", pitchClass: 7 }, a: { name: "A", letter: "A", pitchClass: 9 },
  b: { name: "B", letter: "B", pitchClass: 11 },
  "c-sharp": { name: "C\u266f", letter: "C", pitchClass: 1 },
  "f-sharp": { name: "F\u266f", letter: "F", pitchClass: 6 },
  "g-sharp": { name: "G\u266f", letter: "G", pitchClass: 8 },
};
const FORM_NAMES: Readonly<Record<RepertoireScaleForm, string>> = {
  major: "Major", "natural-minor": "Natural Minor", "harmonic-minor": "Harmonic Minor", "melodic-minor": "Melodic Minor",
};
export const DOUBLE_ACCIDENTAL_REASON = "Coming soon: double accidentals are not yet supported.";
const GROUP_TONICS: readonly (readonly [ScaleTonicId, ScaleTonicId])[] = [
  ["c", "a"], ["d", "b"], ["e", "c-sharp"], ["f", "d"], ["g", "e"], ["a", "f-sharp"], ["b", "g-sharp"],
];
function entry(tonic: ScaleTonicId, form: RepertoireScaleForm): ScaleRepertoireEntry {
  const disabled = tonic === "g-sharp" && (form === "harmonic-minor" || form === "melodic-minor");
  return Object.freeze({ id: `${tonic}-${form}`, tonic, form, name: `${TONICS[tonic].name} ${FORM_NAMES[form]}`,
    ...(disabled ? { disabledReason: DOUBLE_ACCIDENTAL_REASON } : {}) });
}
export const SCALE_REPERTOIRE_GROUPS = Object.freeze(GROUP_TONICS.map(([major, minor]) => Object.freeze([
  entry(major, "major"), entry(minor, "natural-minor"), entry(minor, "harmonic-minor"), entry(minor, "melodic-minor"),
])));
export const SCALE_REPERTOIRE_CATALOG = Object.freeze(SCALE_REPERTOIRE_GROUPS.flat());
export function getScaleRepertoireEntry(id: ScaleRepertoireId): ScaleRepertoireEntry {
  const found = SCALE_REPERTOIRE_CATALOG.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown repertoire scale: ${id}`);
  return found;
}
export function isSelectableRepertoire(value: unknown): value is readonly ScaleRepertoireId[] {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((id) =>
    SCALE_REPERTOIRE_CATALOG.some((candidate) => candidate.id === id && !candidate.disabledReason));
}
export function realizeRepertoireScale(id: ScaleRepertoireId, clef: Clef) {
  const scale = getScaleRepertoireEntry(id);
  if (scale.disabledReason) throw new Error(scale.disabledReason);
  const tonic = TONICS[scale.tonic];
  // Lowest eligible tonic in the existing two-octave clef range; C4 for treble C major.
  const range = NOTE_RANGES[clef];
  const lowerTonicMidiNumber = range.minMidi + ((tonic.pitchClass - range.minMidi % 12 + 12) % 12);
  if (lowerTonicMidiNumber + 12 > range.maxMidi) throw new Error("Repertoire scale exceeds the Sequence range.");
  const target = realizeScaleTarget({ clef, lowerTonicMidiNumber, scale: scale.form, direction: "ascending-descending", rootLetter: tonic.letter });
  return { ...target, name: { primary: scale.name, secondary: "One octave - Ascending and descending" } };
}

/** A finite traversal. Target realization never changes this state. */
export type ScaleRepertoireTraversal = Readonly<{ order: readonly ScaleRepertoireId[]; completed: number }>;
export function createScaleRepertoireTraversal(selection: readonly ScaleRepertoireId[], mode: Exclude<ScalePracticeMode, "random">, random = Math.random): ScaleRepertoireTraversal {
  if (!isSelectableRepertoire(selection)) throw new Error("Invalid scale repertoire selection.");
  const order = [...selection];
  if (mode === "repertoire-shuffle") {
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other]!, order[index]!];
    }
  }
  return { order, completed: 0 };
}
export function completeScaleRepertoireEntry(traversal: ScaleRepertoireTraversal) {
  if (traversal.completed >= traversal.order.length) return { traversal, traversalCompleted: false };
  const next = { ...traversal, completed: traversal.completed + 1 };
  return { traversal: next, traversalCompleted: next.completed === next.order.length };
}
