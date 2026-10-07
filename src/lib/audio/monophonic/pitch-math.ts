export const centsBetween = (frequencyHz: number, referenceHz: number) =>
  1200 * Math.log2(frequencyHz / referenceHz);
export const equalTemperedFrequency = (semitone: number) => 440 * 2 ** ((semitone - 69) / 12);

/** A numeric pitch coordinate, not a MIDI message or an acoustic attack. */
export function describeFrequency(frequencyHz: number) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;
  const coordinate = 69 + 12 * Math.log2(frequencyHz / 440);
  const semitone = Math.round(coordinate);
  if (semitone < 0 || semitone > 127) return null;
  return { frequencyHz, coordinate, semitone };
}
