import type { StaffBuilderPitch, StaffBuilderStaff } from "../staff-builder-types";

export type StaffBuilderVerticalGeometry = Readonly<{
  topReservation: number;
  bottomReservation: number;
  height: number;
  trebleStaveY: number;
  bassStaveY: number;
}>;

export type StaffBuilderVerticalPitchSource = Readonly<{
  staff: StaffBuilderStaff;
  pitches: readonly Pick<StaffBuilderPitch, "letter" | "octave">[];
}>;

const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 } as const;
const TREBLE_TOP_LINE_STEP = 5 * 7 + LETTER_INDEX.F;
const BASS_TOP_LINE_STEP = 3 * 7 + LETTER_INDEX.A;
const STAVE_TOP_LINE_OFFSET = 40;
const HALF_STEP_HEIGHT = 5;
const GLYPH_AND_STEM_EXTENT = 45;
const MINIMUM_MARGIN = 12;

function writtenStep(pitch: Pick<StaffBuilderPitch, "letter" | "octave">): number {
  return pitch.octave * 7 + LETTER_INDEX[pitch.letter];
}

/** Deterministic VexFlow-space reservation for noteheads, ledger lines, stems, accidentals, and ties. */
export function getStaffBuilderVerticalGeometry(options: Readonly<{
  pitchSources: readonly StaffBuilderVerticalPitchSource[];
  baseHeight: number;
  trebleStaveY: number;
  bassStaveY: number;
  visibleStaff?: "grand" | StaffBuilderStaff;
}>): StaffBuilderVerticalGeometry {
  const visibleStaff = options.visibleStaff ?? "grand";
  let minimumY = MINIMUM_MARGIN;
  let maximumY = options.baseHeight - MINIMUM_MARGIN;
  for (const source of options.pitchSources) {
    if (visibleStaff !== "grand" && source.staff !== visibleStaff) continue;
    const staveY = source.staff === "treble" ? options.trebleStaveY : options.bassStaveY;
    const referenceStep = source.staff === "treble" ? TREBLE_TOP_LINE_STEP : BASS_TOP_LINE_STEP;
    for (const pitch of source.pitches) {
      const noteheadCenterY = staveY + STAVE_TOP_LINE_OFFSET - (writtenStep(pitch) - referenceStep) * HALF_STEP_HEIGHT;
      minimumY = Math.min(minimumY, noteheadCenterY - GLYPH_AND_STEM_EXTENT);
      maximumY = Math.max(maximumY, noteheadCenterY + GLYPH_AND_STEM_EXTENT);
    }
  }
  const topReservation = Math.max(0, Math.ceil(MINIMUM_MARGIN - minimumY));
  const bottomReservation = Math.max(0, Math.ceil(maximumY - (options.baseHeight - MINIMUM_MARGIN)));
  return {
    topReservation,
    bottomReservation,
    height: options.baseHeight + topReservation + bottomReservation,
    trebleStaveY: options.trebleStaveY + topReservation,
    bassStaveY: options.bassStaveY + topReservation,
  };
}
