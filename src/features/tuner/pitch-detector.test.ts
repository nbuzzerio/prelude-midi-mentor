import { describe, expect, it } from "vitest";
import { createPitchDetector } from "./pitch-detector";
import { centsBetween, equalTemperedFrequency, TUNER_CONFIG } from "./tuner-pitch";

function tone(hz = 440, rate = 48000, harmonics = [0.2], phase = 0) {
  return Float32Array.from({ length: TUNER_CONFIG.frameSize }, (_, i) =>
    harmonics.reduce((sum, amplitude, harmonic) => sum + amplitude * Math.sin(2 * Math.PI * hz * (harmonic + 1) * i / rate + phase), 0));
}
describe("MPM/NSDF pitch observations", () => {
  for (const rate of [44100, 48000]) {
    it(`detects all chromatic notes C3–C7 and harmonic-rich tones within 5 cents at ${rate} Hz`, () => {
      const detect = createPitchDetector();
      for (let note = 48; note <= 96; note++) for (const phase of [0, 0.47, 1.41]) for (const harmonics of [[0.2], [0.12, 0.2, 0.08]]) {
        const hz = equalTemperedFrequency(note), result = detect(tone(hz, rate, harmonics, phase), rate);
        expect(result.reason).toBe("usable");
        expect(Math.abs(centsBetween(result.frequencyHz!, hz))).toBeLessThan(5);
      }
    });
  }
  it("abstains on silence, DC, and weak signals", () => {
    const detect = createPitchDetector();
    for (const frame of [new Float32Array(2048), new Float32Array(2048).fill(0.3), tone(440, 48000, [0.0001])]) {
      expect(detect(frame, 48000)).toMatchObject({ reason: "quiet", frequencyHz: null });
    }
  });
  it("abstains on deterministic nonperiodic noise", () => {
    const detect = createPitchDetector();
    for (let seed = 1; seed <= 20; seed++) {
      let state = seed;
      const frame = Float32Array.from({ length: 2048 }, () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return ((state / 2 ** 32) * 2 - 1) * 0.2; });
      expect(detect(frame, 48000).frequencyHz).toBeNull();
    }
  });
  it("removes DC before measuring signal level and periodicity", () => {
    const detect = createPitchDetector(), frame = tone(440, 48000, [0.1]);
    const result = detect(frame.map((value) => value + 0.3), 48000);
    expect(result.levelDbfs).toBeCloseTo(20 * Math.log10(0.1 / Math.sqrt(2)), 1);
    expect(Math.abs(centsBetween(result.frequencyHz!, 440))).toBeLessThan(5);
  });
  it("rejects clipping and nonfinite samples", () => {
    const detect = createPitchDetector(), frame = tone(); frame[42] = NaN;
    expect(detect(frame, 48000).reason).toBe("invalid");
    expect(detect(tone(440, 48000, [1.2]), 48000).reason).toBe("clipped");
  });
  it("rejects high estimates without substituting a supported subharmonic", () => {
    expect(createPitchDetector()(tone(4186.009), 48000)).toMatchObject({ reason: "out-of-range", frequencyHz: null });
  });
  it("documents unresolved confident dominant-second octave errors", () => {
    const result = createPitchDetector()(tone(196, 48000, [0.003, 0.25, 0.001]), 48000);
    expect(result.reason).toBe("usable"); expect(result.quality).toBeGreaterThan(0.9);
    expect(centsBetween(result.frequencyHz!, 196)).toBeCloseTo(1200, 0);
  });
  it("validates frame length and sample rate", () => {
    const detect = createPitchDetector();
    expect(() => detect(new Float32Array(1024), 48000)).toThrow();
    expect(() => detect(tone(), NaN)).toThrow();
  });
});
