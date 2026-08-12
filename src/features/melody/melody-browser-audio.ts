import type { MelodyAudioContextLike } from "./melody-metronome";

export type MelodyOwnedAudioContext = MelodyAudioContextLike & Readonly<{
  close?: () => Promise<void>;
}>;

export function createMelodyBrowserAudioContext(): MelodyOwnedAudioContext {
  const Constructor = window.AudioContext;
  if (!Constructor) throw new Error("Web Audio is unavailable.");
  return new Constructor() as unknown as MelodyOwnedAudioContext;
}
