import A4SampleUrl from "@/assets/audio/grand-piano-samples/A4.wav";
import As4SampleUrl from "@/assets/audio/grand-piano-samples/As4.wav";
import B4SampleUrl from "@/assets/audio/grand-piano-samples/B4.wav";
import C4SampleUrl from "@/assets/audio/grand-piano-samples/C4.wav";
import Cs4SampleUrl from "@/assets/audio/grand-piano-samples/Cs4.wav";
import D4SampleUrl from "@/assets/audio/grand-piano-samples/D4.wav";
import Ds4SampleUrl from "@/assets/audio/grand-piano-samples/Ds4.wav";
import E4SampleUrl from "@/assets/audio/grand-piano-samples/E4.wav";
import F4SampleUrl from "@/assets/audio/grand-piano-samples/F4.wav";
import Fs4SampleUrl from "@/assets/audio/grand-piano-samples/Fs4.wav";
import G4SampleUrl from "@/assets/audio/grand-piano-samples/G4.wav";
import Gs4SampleUrl from "@/assets/audio/grand-piano-samples/Gs4.wav";
import { getInstrumentVolume } from "@/lib/audio/instrument-volume";

type PianoSample = Readonly<{
  baseMidiNumber: number;
  url: string;
}>;

const SEMITONES_PER_OCTAVE = 12;

const GRAND_PIANO_SAMPLES: Readonly<Record<number, PianoSample>> = {
  0: {
    baseMidiNumber: 60,
    url: C4SampleUrl,
  },
  1: {
    baseMidiNumber: 61,
    url: Cs4SampleUrl,
  },
  2: {
    baseMidiNumber: 62,
    url: D4SampleUrl,
  },
  3: {
    baseMidiNumber: 63,
    url: Ds4SampleUrl,
  },
  4: {
    baseMidiNumber: 64,
    url: E4SampleUrl,
  },
  5: {
    baseMidiNumber: 65,
    url: F4SampleUrl,
  },
  6: {
    baseMidiNumber: 66,
    url: Fs4SampleUrl,
  },
  7: {
    baseMidiNumber: 67,
    url: G4SampleUrl,
  },
  8: {
    baseMidiNumber: 68,
    url: Gs4SampleUrl,
  },
  9: {
    baseMidiNumber: 69,
    url: A4SampleUrl,
  },
  10: {
    baseMidiNumber: 70,
    url: As4SampleUrl,
  },
  11: {
    baseMidiNumber: 71,
    url: B4SampleUrl,
  },
};

const preloadedSamples = new Map<string, HTMLAudioElement>();

function getPitchClass(midiNumber: number): number {
  return (
    ((midiNumber % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) %
    SEMITONES_PER_OCTAVE
  );
}

function getPlaybackRate(
  requestedMidiNumber: number,
  baseMidiNumber: number,
): number {
  const semitoneDifference = requestedMidiNumber - baseMidiNumber;

  return 2 ** (semitoneDifference / SEMITONES_PER_OCTAVE);
}

function getPreloadedSample(url: string): HTMLAudioElement | null {
  if (typeof Audio === "undefined") {
    return null;
  }

  const existingSample = preloadedSamples.get(url);

  if (existingSample) {
    return existingSample;
  }

  const sample = new Audio(url);

  sample.preload = "auto";

  preloadedSamples.set(url, sample);

  return sample;
}

export function preloadGrandPianoSamples(): void {
  Object.values(GRAND_PIANO_SAMPLES).forEach(({ url }) => {
    getPreloadedSample(url);
  });
}

export function playGrandPianoNote(midiNumber: number): void {
  const volume = getInstrumentVolume();

  if (volume === 0) {
    return;
  }

  const pitchClass = getPitchClass(midiNumber);
  const sampleDefinition = GRAND_PIANO_SAMPLES[pitchClass];

  if (!sampleDefinition) {
    return;
  }

  const preloadedSample = getPreloadedSample(sampleDefinition.url);

  if (!preloadedSample) {
    return;
  }

  const playableSample = preloadedSample.cloneNode(true) as HTMLAudioElement;

  playableSample.volume = volume;
  playableSample.playbackRate = getPlaybackRate(
    midiNumber,
    sampleDefinition.baseMidiNumber,
  );

  void playableSample.play().catch(() => {
    // Browsers may reject playback before the user has interacted with the page.
  });
}

export function playGrandPianoChord(midiNumbers: Iterable<number>): void {
  for (const midiNumber of midiNumbers) {
    playGrandPianoNote(midiNumber);
  }
}
