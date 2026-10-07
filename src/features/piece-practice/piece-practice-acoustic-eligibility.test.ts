import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { focusPiecePracticeProjection, projectStaffBuilderPieceForPractice } from "./piece-practice-projection";
import { getAcousticEligibility } from "./piece-practice-acoustic-eligibility";
import { advancePiecePracticeNoAttackMeasure, createPiecePracticeSession, getCurrentPiecePracticeTarget, resumePiecePracticeClock, submitPiecePracticeAcousticAttack } from "./piece-practice-session";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";

function score(chord = false, rolled = false): StaffBuilderScore {
  return { schemaVersion: 4, id: "score", title: "Acoustic study", createdAt: "2026-10-06T12:00:00.000Z", updatedAt: "2026-10-06T12:00:00.000Z",
    annotations: [], ties: [], tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [
      { id: "e", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, ...(rolled ? { arpeggiation: "up" as const } : {}),
        pitches: [{ id: "p", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }, ...(chord ? [{ id: "g", midiNumber: 67, letter: "G" as const, accidental: "natural" as const, octave: 4 }] : [])] },
      { id: "bass", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "b", midiNumber: 48, letter: "C", accidental: "natural", octave: 3 }] },
    ] }] };
}
function project(source = score()) {
  const result = projectStaffBuilderPieceForPractice(source);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.piece;
}

describe("monophonic range eligibility", () => {
  it("ordinary incoming ties require no second attack; a range boundary requires one", () => {
    const base = score();
    const source = { ...base, measures: [base.measures[0], { id: "m2", events: base.measures[0].events.map((event) => ({ ...event, id: `${event.id}2` })) }],
      ties: [{ id: "t", fromEventId: "e", fromPitchId: "p", toEventId: "e2", toPitchId: "p" }] };
    const piece = focusPiecePracticeProjection(project(source), "upper");
    expect(getAcousticEligibility(piece, 0).eligible).toBe(true); expect(getAcousticEligibility(piece, 1).eligible).toBe(true);
    for (const startMeasureIndex of [0, 1]) {
      const created = createPiecePracticeSession(piece, { startMeasureIndex, startedAtMs: 0, inputConfiguration: { mode: "microphone", instrument: "violin", pitchToleranceCents: 25 } });
      if (!created.ok) throw Error();
      const state = resumePiecePracticeClock(created.state, 0); const target = getCurrentPiecePracticeTarget(piece, state)!;
      if (startMeasureIndex === 1) expect(target.id).toContain("boundary-target");
      const result = submitPiecePracticeAcousticAttack(piece, state, { targetId: target.id, inputEpoch: 0, attack: { source: "microphone", sequence: 0, captureGeneration: 1,
        frequencyHz: equalTemperedFrequency(64), nearestSemitone: 64, onsetObservedAtMs: 0, confirmedAtMs: 100, articulation: "initial-acquisition" } });
      if (startMeasureIndex === 0) {
        expect(result.state.status).toBe("awaiting-explicit-measure-advance");
        expect(advancePiecePracticeNoAttackMeasure(piece, result.state, 200).state.status).toBe("piece-complete");
      } else expect(result.state.status).toBe("piece-complete");
    }
  });
  it("rejects both-staff chords but allows a single focused physical pitch", () => {
    const piece = project(); expect(getAcousticEligibility(piece, 0).eligible).toBe(false);
    expect(getAcousticEligibility(focusPiecePracticeProjection(piece, "upper"), 0).eligible).toBe(true);
  });
  it("Staff Focus does not excuse remaining chords or rolls", () => {
    expect(getAcousticEligibility(focusPiecePracticeProjection(project(score(true)), "upper"), 0).eligible).toBe(false);
    expect(getAcousticEligibility(focusPiecePracticeProjection(project(score(true, true)), "upper"), 0)).toMatchObject({ eligible: false, message: expect.stringContaining("rolled") });
  });
  it("co-onset unisons represent one physical pitch", () => {
    const source = score(); const events = source.measures[0].events;
    const bass = events[1]; if (bass.kind !== "notes") throw Error();
    const unison = { ...source, measures: [{ ...source.measures[0], events: [events[0], { ...bass, pitches: [{ id: "b", midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 }] }] }] };
    expect(getAcousticEligibility(project(unison), 0).eligible).toBe(true);
  });
  it("checks overlaps with half-open intervals after staff filtering", () => {
    const piece = focusPiecePracticeProjection(project(), "upper");
    const span = piece.soundingSpans![0];
    const first = { ...span, staff: "treble" as const, midiNumber: 64, attackTick: 0, endTick: 480 };
    const second = { ...first, midiNumber: 67, attackTick: 480, endTick: 960 };
    expect(getAcousticEligibility({ ...piece, soundingSpans: [first, second] }, 0).eligible).toBe(true);
    expect(getAcousticEligibility({ ...piece, soundingSpans: [first, { ...second, attackTick: 479 }] }, 0)).toMatchObject({ eligible: false, message: expect.stringContaining("overlapping") });
  });
  it("rejects expected pitches outside the production analysis range", () => {
    const piece = focusPiecePracticeProjection(project(), "lower");
    const event = piece.measures[0].sourceEvents[1]; if (event.kind !== "notes") throw Error();
    const low = { ...piece, measures: [{ ...piece.measures[0], sourceEvents: [{ ...event, pitches: [{ ...event.pitches[0], midiNumber: 36 }] }] }] };
    expect(getAcousticEligibility(low, 0)).toMatchObject({ eligible: false, message: expect.stringContaining("120–2300") });
  });
  it("validates range bounds before requesting input", () => {
    expect(getAcousticEligibility(project(), 3).eligible).toBe(false);
    expect(getAcousticEligibility(project(), 0, -1).eligible).toBe(false);
  });
});
