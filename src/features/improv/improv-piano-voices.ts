import { getInstrumentVolume } from "@/lib/audio/instrument-volume";
import type { ImprovReplaySound, ImprovReplayVoice } from "./improv-replay";

// Reuse the existing twelve local samples without changing the legacy fixed-duration piano API.
const urls = import.meta.glob<string>("/src/assets/audio/grand-piano-samples/*.wav", { eager: true, query: "?url", import: "default" });
const names = ["C4", "Cs4", "D4", "Ds4", "E4", "F4", "Fs4", "G4", "Gs4", "A4", "As4", "B4"];

/** HTMLAudio voices naturally decay; this is sampled piano approximation, not acoustic reconstruction. */
export function createImprovPianoVoices(): ImprovReplaySound {
  const samples = new Map<number, HTMLAudioElement>(); const active = new Set<ImprovReplayVoice>();
  let disposed = false;
  return Object.freeze({
    attack({ pitch, gain }: Parameters<ImprovReplaySound["attack"]>[0]): ImprovReplayVoice {
      if (disposed || !Number.isInteger(pitch) || pitch < 0 || pitch > 127 || !Number.isFinite(gain) || gain < 0 || gain > 1) throw new Error("Invalid or disposed Improv voice.");
      const volume = getInstrumentVolume() * gain;
      if (volume === 0) return { started: Promise.resolve(true), release: () => {} };
      if (typeof Audio === "undefined") return { started: Promise.resolve(false), release: () => {} };
      const pitchClass = pitch % 12;
      let sample = samples.get(pitchClass);
      if (!sample) {
        const url = urls[`/src/assets/audio/grand-piano-samples/${names[pitchClass]}.wav`];
        if (!url) return { started: Promise.resolve(false), release: () => {} };
        sample = new Audio(url); sample.preload = "auto"; samples.set(pitchClass, sample);
      }
      let audio: HTMLAudioElement | null = sample.cloneNode(true) as HTMLAudioElement;
      audio.volume = volume; audio.preservesPitch = false; audio.playbackRate = 2 ** ((pitch - (60 + pitchClass)) / 12);
      let released = false;
      let resolveEnded!: () => void;
      const ended = new Promise<void>((resolve) => { resolveEnded = resolve; });
      const release = () => {
        if (released) return; released = true; active.delete(voice);
        const element = audio; audio = null;
        try { if (element) { element.onended = null; element.pause(); element.currentTime = 0; } } finally { resolveEnded(); }
      };
      const voice: ImprovReplayVoice = { release, ended, started: Promise.resolve(false) };
      active.add(voice); audio.onended = release;
      const element = audio;
      let started: Promise<boolean>;
      try {
        started = element.play().then(() => {
          if (released) { element.pause(); element.currentTime = 0; return false; }
          return true;
        }, () => { release(); return false; });
      } catch { release(); started = Promise.resolve(false); }
      // The handle tracked by active has the same idempotent release function.
      return Object.freeze({ release, started, ended });
    },
    dispose: () => { if (disposed) return; disposed = true; for (const voice of active) voice.release(); active.clear(); samples.clear(); },
  });
}
