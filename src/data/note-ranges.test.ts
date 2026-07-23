import { describe, expect, it } from 'vitest';

import { NOTE_RANGES } from './note-ranges';

describe('NOTE_RANGES', () => {
  it('defines the bass-clef practice range from C2 through middle C', () => {
    expect(NOTE_RANGES.bass).toEqual({
      clef: 'bass',
      minMidi: 36,
      maxMidi: 60,
    });
  });

  it('defines the treble-clef practice range from middle C through C6', () => {
    expect(NOTE_RANGES.treble).toEqual({
      clef: 'treble',
      minMidi: 60,
      maxMidi: 84,
    });
  });

  it('includes middle C in both clef ranges', () => {
    expect(NOTE_RANGES.bass.maxMidi).toBe(60);
    expect(NOTE_RANGES.treble.minMidi).toBe(60);
  });

  it('defines each range from its lower MIDI boundary to its upper boundary', () => {
    expect(NOTE_RANGES.bass.minMidi).toBeLessThan(
      NOTE_RANGES.bass.maxMidi,
    );

    expect(NOTE_RANGES.treble.minMidi).toBeLessThan(
      NOTE_RANGES.treble.maxMidi,
    );
  });
});