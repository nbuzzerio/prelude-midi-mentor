import { afterEach, describe, expect, it, vi } from "vitest";
import { createImprovPianoVoices } from "./improv-piano-voices";
import { setInstrumentVolume } from "@/lib/audio/instrument-volume";

afterEach(() => { setInstrumentVolume(0.5); vi.unstubAllGlobals(); });
function audioMock(play: () => Promise<void> = () => Promise.resolve()) {
  const audios: { volume: number; playbackRate: number; preservesPitch: boolean; currentTime: number;
    play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const constructor = vi.fn(function () { return { preload: "", cloneNode: () => {
    const audio = { volume: 1, playbackRate: 1, preservesPitch: true, currentTime: 1, play: vi.fn(play), pause: vi.fn(), onended: null };
    audios.push(audio); return audio;
  } }; });
  vi.stubGlobal("Audio", constructor); return { constructor, audios };
}
const note = (pitch = 72, velocity = 64) => ({ pitch, velocity, gain: velocity / 127, channel: 0 });

describe("separate sampled-piano release voices", () => {
  it("loads no audio before an explicit attack and reuses existing local samples", async () => {
    const s = audioMock(); const voices = createImprovPianoVoices(); expect(s.constructor).not.toHaveBeenCalled();
    const voice = voices.attack(note()); await expect(voice.started).resolves.toBe(true);
    expect(s.audios[0]).toMatchObject({ volume: 0.5 * 64 / 127, playbackRate: 2, preservesPitch: false });
    voice.release(); voice.release(); expect(s.audios[0].pause).toHaveBeenCalledTimes(1); expect(s.audios[0].currentTime).toBe(0);
  });
  it("supports independent overlapping voices and releases them all on disposal", async () => {
    const s = audioMock(); const voices = createImprovPianoVoices(); voices.attack(note(60, 127)); voices.attack(note(60, 32));
    expect(s.constructor).toHaveBeenCalledTimes(1); expect(s.audios).toHaveLength(2); voices.dispose!(); voices.dispose!();
    expect(s.audios.every((a) => a.pause.mock.calls.length === 1)).toBe(true); expect(() => voices.attack(note())).toThrow(/disposed/);
  });
  it("a late browser play resolution after release is paused again instead of reviving sound", async () => {
    let resolve!: () => void; const s = audioMock(() => new Promise<void>((done) => { resolve = done; }));
    const voices = createImprovPianoVoices(); const voice = voices.attack(note()); voice.release(); resolve();
    await expect(voice.started).resolves.toBe(false); expect(s.audios[0].pause).toHaveBeenCalledTimes(2); expect(s.audios[0].currentTime).toBe(0);
  });
  it.each(["promise", "synchronous"])("reports %s audio-start failure and cleans up", async (mode) => {
    const s = audioMock(() => { if (mode === "synchronous") throw new Error("blocked"); return Promise.reject(new Error("blocked")); });
    const voice = createImprovPianoVoices().attack(note()); await expect(voice.started).resolves.toBe(false); expect(s.audios[0].pause).toHaveBeenCalledTimes(1);
  });
  it("intentional mute succeeds without creating audio; missing browser audio fails explicitly", async () => {
    const s = audioMock(); setInstrumentVolume(0); await expect(createImprovPianoVoices().attack(note()).started).resolves.toBe(true);
    expect(s.constructor).not.toHaveBeenCalled(); setInstrumentVolume(0.5); vi.stubGlobal("Audio", undefined);
    await expect(createImprovPianoVoices().attack(note()).started).resolves.toBe(false);
  });
  it("natural sample completion retires the voice and subsequent disposal is harmless", async () => {
    const s = audioMock(); const voices = createImprovPianoVoices(); const voice = voices.attack(note()); await voice.started;
    s.audios[0].onended!(); voices.dispose!(); expect(s.audios[0].pause).toHaveBeenCalledTimes(1);
  });
  it.each([-1, 128, 60.5, NaN])("rejects invalid MIDI pitch %s", (pitch) => { expect(() => createImprovPianoVoices().attack(note(pitch))).toThrow(); });
});
