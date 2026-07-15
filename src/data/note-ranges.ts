import type { Clef } from '../types/practice';

export type NoteRange = Readonly<{
  clef: Clef;
  minMidi: number;
  maxMidi: number;
}>;

export const NOTE_RANGES: Record<Clef, NoteRange> = {
  bass: {
    clef: 'bass',
    minMidi: 36, // C2
    maxMidi: 60, // C4 / Middle C
  },
  treble: {
    clef: 'treble',
    minMidi: 60, // C4 / Middle C
    maxMidi: 84, // C6
  },
};