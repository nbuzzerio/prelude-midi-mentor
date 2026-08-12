import type { StaffBuilderEventHighlight } from "@/features/staff-builder/components/staff-builder-score-view";
import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import type { MelodyAttackEvaluation, MelodyAttemptResult } from "./melody-scoring";

export type MelodyResultHighlightStatus = "correct" | "missed" | "wrong-pitch";
export type MelodyResultDetail = Readonly<{ eventId: string; status: MelodyResultHighlightStatus; text: string }>;

function writtenPitchLabel(attack: MelodyAttackEvaluation): string {
  const { letter, accidental, octave } = attack.expectedAttack.writtenPitch;
  return `${letter}${accidental === "sharp" ? "♯" : accidental === "flat" ? "♭" : ""}${octave}`;
}

function midiLabel(midiNumber: number): string {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return `${names[midiNumber % 12]}${Math.floor(midiNumber / 12) - 1}`;
}

function locationLabel(attack: MelodyAttackEvaluation): string {
  const beatOffset = attack.expectedAttack.startTick / STAFF_BUILDER_TICKS_PER_QUARTER;
  const beat = Number.isInteger(beatOffset) ? `${beatOffset + 1}` : `${Math.floor(beatOffset) + 1} &`;
  return `Measure ${attack.expectedAttack.measureIndex + 1}, beat ${beat}`;
}

export function getMelodyResultEventHighlights(result: MelodyAttemptResult): readonly StaffBuilderEventHighlight[] {
  return Object.freeze(result.attacks.map(({ expectedAttack, status }) => Object.freeze({
    eventId: expectedAttack.eventId,
    status: status === "missing" ? "missed" as const : status,
  })));
}

export function getMelodyResultDetails(result: MelodyAttemptResult): readonly MelodyResultDetail[] {
  return Object.freeze(result.attacks.map((attack) => {
    const status = attack.status === "missing" ? "missed" as const : attack.status;
    const expected = writtenPitchLabel(attack);
    const text = attack.status === "correct"
      ? `${locationLabel(attack)}: ${expected}, correct.`
      : attack.status === "missing"
        ? `${locationLabel(attack)}: missed ${expected}.`
        : `${locationLabel(attack)}: expected ${expected}, played ${midiLabel(attack.performedAttack!.midiNumber)}.`;
    return Object.freeze({ eventId: attack.expectedAttack.eventId, status, text });
  }));
}
