import { describe, expect, it } from "vitest";
import type { StaffBuilderEvent } from "../staff-builder-types";
import { getStaffBuilderPlaybackAvailability } from "./staff-builder-playback-availability";

const note: StaffBuilderEvent = { id: "note", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "p", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] };

describe("getStaffBuilderPlaybackAvailability", () => {
  it("enables full playback from structural readiness and audition from the selected Rhythm event", () => {
    expect(getStaffBuilderPlaybackAvailability("rhythm", 0, note)).toEqual({ auditionReady: true, auditionReason: null, fullPlaybackReady: true, fullPlaybackReason: null });
  });

  it("provides shared beginner-facing disabled reasons", () => {
    const availability = getStaffBuilderPlaybackAvailability("capture", 2, note);
    expect(availability.auditionReady).toBe(false);
    expect(availability.auditionReason).toContain("Select a finished note or chord");
    expect(availability.fullPlaybackReady).toBe(false);
    expect(availability.fullPlaybackReason).toBe("Playback unavailable: 2 score issues remain.");
  });
});
