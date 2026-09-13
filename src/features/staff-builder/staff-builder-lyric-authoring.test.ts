import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "./staff-builder-types";
import { commitStaffBuilderLyricCue, resolveStaffBuilderLyricTarget } from "./staff-builder-lyric-authoring";

const note = (id: string) => ({ id, kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: `${id}-p`, midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] });
const base = (events = [note("a")]): StaffBuilderScore => ({ schemaVersion: 3, id: "s", title: "Song", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m", events }], ties: [], annotations: [] });

describe("Staff Builder lyric authoring", () => {
  it("resolves a sole event, no event, ambiguity, and selected disambiguation", () => {
    expect(resolveStaffBuilderLyricTarget(base(), 0, 0, null).target?.id).toBe("a");
    expect(resolveStaffBuilderLyricTarget(base(), 0, 480, null).target).toBeNull();
    const polyphonic = base([note("a"), note("b")]);
    expect(resolveStaffBuilderLyricTarget(polyphonic, 0, 0, null).ambiguous).toBe(true);
    expect(resolveStaffBuilderLyricTarget(polyphonic, 0, 0, "b").target?.id).toBe("b");
  });
  it("adds, trims, edits, and removes the same schema-v3 cue", () => {
    const added = commitStaffBuilderLyricCue(base(), "a", "  Bells  ", () => "cue");
    expect(added.annotations).toEqual([{ id: "cue", kind: "lyric-cue", anchor: { kind: "event", eventId: "a" }, text: "Bells" }]);
    const edited = commitStaffBuilderLyricCue(added, "a", "Ring");
    expect(edited.annotations[0]).toMatchObject({ id: "cue", text: "Ring" });
    expect(commitStaffBuilderLyricCue(edited, "a", "  ").annotations).toEqual([]);
  });
});
