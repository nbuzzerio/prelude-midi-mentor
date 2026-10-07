import { describe, expect, it } from "vitest";
import { createPitchStabilizer } from "@/lib/audio/monophonic/pitch-stabilizer";
import type { PitchObservation } from "@/lib/audio/monophonic/pitch-analysis-types";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import { createAcousticOnsetDetector } from "./piece-practice-acoustic-onset";
import type { AcousticAttack } from "./piece-practice-acoustic-types";

function stream() {
  const detector = createAcousticOnsetDetector(), tracker = createPitchStabilizer(), attacks: AcousticAttack[] = [];
  let at = 0, generation = 1;
  const frame = (frequencyHz: number | null = equalTemperedFrequency(64), reason: PitchObservation["reason"] = "usable", levelDbfs = -20, step = 40, audioSeconds?: number) => {
    at += step;
    const observation = { frequencyHz, reason, levelDbfs, quality: reason === "usable" ? 0.99 : 0.1 };
    const clock = audioSeconds ?? at / 1000;
    const attack = detector.update({ observation, snapshot: tracker.update(observation, at, clock), observedAtMs: at, audioSeconds: clock, captureGeneration: generation });
    if (attack) attacks.push(attack);
    return attack;
  };
  const quiet = () => { for (let i = 0; i < 3; i++) frame(null, "quiet", -80); };
  const tone = (midi = 64, count = 8, cents = 0) => { for (let i = 0; i < count; i++) frame(equalTemperedFrequency(midi) * 2 ** (cents / 1200)); };
  return { frame, quiet, tone, attacks, detector, nextGeneration: () => { generation++; } };
}

describe("physical acoustic articulations", () => {
  it("requires an initial quiet baseline, then consumes continuous E4 only once", () => {
    const s = stream(); s.tone(); expect(s.attacks).toHaveLength(0);
    s.quiet(); s.tone(64, 100); expect(s.attacks).toHaveLength(1);
  });
  it("emits a stable pitch change without another silence", () => {
    const s = stream(); s.quiet(); s.tone(); s.tone(66);
    expect(s.attacks.map((a) => [a.nearestSemitone, a.articulation])).toEqual([[64, "initial-acquisition"], [66, "pitch-change"]]);
  });
  it("uses raw candidates across the tuner's retained midpoint identity", () => {
    const s = stream(); s.quiet(); s.tone(69); s.tone(69, 8, 55);
    expect(s.attacks.map((a) => a.nearestSemitone)).toEqual([69, 70]);
  });
  it("qualified quiet rearms the same pitch once", () => {
    const s = stream(); s.quiet(); s.tone(); s.quiet(); s.tone(); s.tone();
    expect(s.attacks.map((a) => a.articulation)).toEqual(["initial-acquisition", "after-quiet"]);
  });
  it("corroborated periodicity loss and dip/recovery emit one same-pitch reattack", () => {
    const s = stream(); s.quiet(); s.tone(); s.frame(null, "low-periodicity", -28); s.tone(64, 20);
    expect(s.attacks.map((a) => a.articulation)).toEqual(["initial-acquisition", "reattack"]);
  });
  it.each(["low-periodicity", "aperiodic", "clipped", "invalid"] as const)("isolated %s cannot rearm a sustained pitch", (reason) => {
    const s = stream(); s.quiet(); s.tone(); s.frame(null, reason); s.tone(); expect(s.attacks).toHaveLength(1);
  });
  it("a dip without periodicity loss and a decay cannot rearm", () => {
    const s = stream(); s.quiet(); s.tone(); s.frame(equalTemperedFrequency(64), "usable", -28); s.tone();
    for (let i = 0; i < 8; i++) s.frame(equalTemperedFrequency(64), "usable", -23 - i * 3);
    s.tone(); expect(s.attacks).toHaveLength(1);
  });
  it("an expired discontinuity cannot rearm", () => {
    const s = stream(); s.quiet(); s.tone();
    for (let i = 0; i < 8; i++) s.frame(null, "low-periodicity", -28);
    s.tone(); expect(s.attacks).toHaveLength(1);
  });
  it("a sampling gap loses history and requires real quiet", () => {
    const s = stream(); s.quiet(); s.tone(); s.frame(equalTemperedFrequency(64), "usable", -20, 150); s.tone(66);
    expect(s.attacks).toHaveLength(1); s.quiet(); s.tone(66); expect(s.attacks).toHaveLength(2);
  });
  it("stalled clocks never constitute silence or another attack", () => {
    const s = stream(); s.quiet(); s.tone(); s.frame(null, "clock-stalled", -180, 40, 0); s.tone();
    expect(s.attacks).toHaveLength(1);
  });
  it("reset and capture replacement invalidate pending evidence and held sound", () => {
    const s = stream(); s.quiet(); s.tone(); s.detector.reset(); s.tone(); expect(s.attacks).toHaveLength(1);
    s.quiet(); s.tone(); s.nextGeneration(); s.tone(); expect(s.attacks).toHaveLength(2);
    s.quiet(); s.tone(); expect(s.attacks).toHaveLength(3);
    expect(new Set(s.attacks.map((a) => a.sequence)).size).toBe(3);
  });
  it("target advancement discards candidates without rearming a consumed pitch", () => {
    const s = stream(); s.quiet(); s.tone(); s.detector.discardCandidate(); s.tone(); expect(s.attacks).toHaveLength(1);
  });
});
