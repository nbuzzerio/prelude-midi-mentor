import { describe, expect, it } from "vitest";
import { getStaffBuilderVerticalGeometry } from "./staff-builder-vertical-geometry";

const pitch = (staff: "treble" | "bass", letter: "C" | "D" | "G" | "A", octave: number) => ({ staff, pitches: [{ letter, octave }] });
const editor = (pitchSources: ReturnType<typeof pitch>[], visibleStaff: "grand" | "treble" | "bass" = "grand") => getStaffBuilderVerticalGeometry({ pitchSources, baseHeight: 300, trebleStaveY: visibleStaff === "grand" ? 55 : 95, bassStaveY: visibleStaff === "grand" ? 155 : 95, visibleStaff });

describe("Staff Builder vertical notation geometry", () => {
  it("keeps ordinary grand-staff notation at the compact baseline", () => {
    expect(editor([pitch("treble", "C", 4), pitch("bass", "C", 3)])).toEqual({ topReservation: 0, bottomReservation: 0, height: 300, trebleStaveY: 55, bassStaveY: 155 });
  });

  it("adds an optional lyric lane and composes it with high-note reservation", () => {
    const ordinary = getStaffBuilderVerticalGeometry({ pitchSources: [pitch("treble", "C", 4)], baseHeight: 300, trebleStaveY: 55, bassStaveY: 155, topLaneReservation: 24 });
    const highWithoutLyrics = editor([pitch("treble", "G", 9)]);
    const highWithLyrics = getStaffBuilderVerticalGeometry({ pitchSources: [pitch("treble", "G", 9)], baseHeight: 300, trebleStaveY: 55, bassStaveY: 155, topLaneReservation: 24 });
    expect(ordinary).toMatchObject({ topReservation: 24, height: 324, trebleStaveY: 79 });
    expect(highWithLyrics.topReservation).toBe(highWithoutLyrics.topReservation + 24);
    expect(highWithLyrics.height).toBe(highWithoutLyrics.height + 24);
  });

  it("reserves only the needed edge for extreme treble and bass pitches", () => {
    const high = editor([pitch("treble", "G", 9)]);
    const low = editor([pitch("bass", "D", 1)]);
    expect(high.topReservation).toBeGreaterThan(0);
    expect(high.bottomReservation).toBe(0);
    expect(low.topReservation).toBe(0);
    expect(low.bottomReservation).toBeGreaterThan(0);
    expect(high.trebleStaveY).toBe(55 + high.topReservation);
    expect(low.bassStaveY).toBe(155);
  });

  it("handles treble-only, bass-only, and grand-staff scopes independently", () => {
    const sources = [pitch("treble", "G", 9), pitch("bass", "D", 1)];
    expect(editor(sources, "treble")).toMatchObject({ bottomReservation: 0 });
    expect(editor(sources, "bass")).toMatchObject({ topReservation: 0 });
    const grand = editor(sources);
    expect(grand.topReservation).toBeGreaterThan(0);
    expect(grand.bottomReservation).toBeGreaterThan(0);
  });

  it("uses written staff position so enharmonic spellings can reserve different extents", () => {
    const sharp = editor([pitch("treble", "G", 9)]);
    const flat = editor([pitch("treble", "A", 9)]);
    expect(flat.topReservation).toBe(sharp.topReservation + 5);
  });

  it("covers the accepted MIDI-range endpoint spellings without a product range restriction", () => {
    const geometry = editor([pitch("bass", "C", -1), pitch("treble", "G", 9)]);
    expect(geometry.topReservation).toBeGreaterThan(100);
    expect(geometry.bottomReservation).toBeGreaterThan(100);
    expect(geometry.height).toBe(300 + geometry.topReservation + geometry.bottomReservation);
  });
});
