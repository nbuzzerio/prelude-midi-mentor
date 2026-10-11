import { describe, expect, it } from "vitest";
import { createImprovTimeline, IMPROV_LIVE_NOTES, IMPROV_VISIBLE_NOTES, timelineFromTake, timelinePitch, timelineWindow } from "./improv-timeline";
import { createImprovTakeRecorder } from "./improv-take-recorder";
import { fixtureContext, fixtureInput, fixtureObservation, performanceFixture } from "./improv-test-fixture";
import { IMPROV_PROJECTION_LIMIT_MS, projectImprovTiming } from "./improv-performance";

function fixture(archive = false) {
  const rec = createImprovTakeRecorder({ createId: () => "take" }); rec.start(fixtureInput, fixtureObservation(100));
  const model = createImprovTimeline(100, archive); let sequence = 0;
  const send = (bytes: number[], atMs: number, source = atMs) => {
    const result = rec.append({ provenance: "browser-midi-message", input: fixtureInput, sequence: ++sequence, bytes, dataStatus: "available", receivedAtMs: atMs + 100, sourceTimeStampMs: source + 100 }, fixtureContext);
    if (result.ok) model.append(rec.readEvents(result.eventWatermark - 1, 1)[0]);
  };
  return { model, rec, send };
}
const noKey = { type: "no-key" } as const;

describe("observed performance timeline", () => {
  it("has an empty ready take and preserves leading/trailing silence", () => {
    const f = fixture(); expect(f.model.view(100).notes).toEqual([]);
    expect(f.model.elapsed(5100)).toBe(5000); f.send([0x90, 60, 90], 6000);
    expect(f.model.view(7100).notes[0].onsetMs).toBe(6000);
    f.model.finish(9000, true); expect(f.model.elapsed(900_000)).toBe(9000);
  });
  it("retains a released note's attack and key-down interval", () => {
    const f = fixture(); f.send([0x90, 60, 90], 200); f.send([0x80, 60, 64], 700);
    expect(f.model.view(1000).notes).toEqual([{ sequence: 1, pitch: 60, channel: 0, onsetMs: 200, releaseMs: 700 }]);
  });
  it("keeps simultaneous chord delivery order without chord inference", () => {
    const f = fixture(); [60, 64, 67].forEach(p => f.send([0x90, p, 100], 500));
    expect(f.model.view(1000).notes.map(n => [n.sequence, n.onsetMs])).toEqual([[1, 500], [2, 500], [3, 500]]);
  });
  it("keeps rolled attacks distinct in elapsed time", () => {
    const f = fixture(); [60, 64, 67].forEach((p, i) => f.send([0x90, p, 100], 500 + i * 27));
    expect(f.model.view(1000).notes.map(n => n.onsetMs)).toEqual([500, 527, 554]);
  });
  it("preserves rapid repeated attacks and velocity-zero release encoding", () => {
    const f = fixture(); for (let i = 0; i < 20; i++) { f.send([0x90, 60, 90], i * 10); f.send([0x90, 60, 0], i * 10 + 4); }
    expect(f.model.view(1000).notes).toHaveLength(20); expect(f.model.view(1000).notes.every(n => n.releaseMs! - n.onsetMs === 4)).toBe(true);
    expect(f.rec.readEvents(0, 40)[1].raw.bytes).toEqual([0x90, 60, 0]);
  });
  it("pairs overlapping identical pitches FIFO within each channel", () => {
    const f = fixture(); f.send([0x90, 60, 90], 0); f.send([0x91, 60, 90], 10); f.send([0x90, 60, 90], 20);
    f.send([0x80, 60, 1], 30); f.send([0x81, 60, 1], 40); f.send([0x80, 60, 1], 50);
    expect(f.model.view(1000).notes.map(n => n.releaseMs)).toEqual([30, 40, 50]);
  });
  it("leaves missing releases unknown at Stop and counts unmatched releases", () => {
    const f = fixture(); f.send([0x80, 62, 0], 0); f.send([0x90, 60, 90], 10); f.model.finish(500, true);
    expect(f.model.view(9999)).toMatchObject({ unmatchedReleases: 1, notes: [{ releaseMs: null }], atMs: 500 });
  });
  it("interprets CC64 per channel without extending key-down intervals", () => {
    const f = fixture(); f.send([0xb0, 64, 63], 0); expect(f.model.view(100).pedalActive).toBe(false);
    f.send([0xb0, 64, 64], 1); f.send([0xb1, 64, 127], 2); f.send([0x90, 60, 90], 3); f.send([0x80, 60, 0], 4);
    f.send([0xb0, 64, 0], 5); expect(f.model.view(1000)).toMatchObject({ pedalActive: true, notes: [{ releaseMs: 4 }] });
    f.send([0xb1, 64, 0], 6); expect(f.model.view(1000).pedalActive).toBe(false);
  });
  it("retains a long held interval through scrolling without inventing a release", () => {
    const f = fixture(); f.send([0x90, 40, 90], 0);
    expect(f.model.view(900_100)).toMatchObject({ leftMs: 890_400, notes: [{ onsetMs: 0, releaseMs: null }], retainedNotes: 1 });
  });
  it("scrolls continuously during long silence with future blank space", () => {
    expect(timelineWindow(5000)).toEqual({ leftMs: 0, rightMs: 12_000 });
    expect(timelineWindow(10_000)).toEqual({ leftMs: 400, rightMs: 12_400 });
    const f = fixture(); expect(f.model.view(900_100).notes).toEqual([]); expect(f.model.elapsed(900_100)).toBe(900_000);
  });
  it("uses the responsive six-second window consistently", () => {
    const f = fixture(); f.send([0x90, 60, 80], 7900);
    expect(f.model.view(8100, undefined, 6000)).toMatchObject({ leftMs: 3200, rightMs: 9200, notes: [{ onsetMs: 7900 }] });
  });
  it("retains recent context when resizing from six back to twelve seconds", () => {
    const f = fixture(); f.send([0x90, 60, 90], 2000); f.send([0x80, 60, 0], 3000);
    expect(f.model.view(8100, undefined, 6000).notes).toEqual([]);
    expect(f.model.view(8100).notes).toHaveLength(1);
  });
  it("does not allocate notes for a high-frequency system/controller stream", () => {
    const f = fixture(); for (let i = 0; i < 10_000; i++) f.send(i % 2 ? [0xf8] : [0xb0, 1, 90], i);
    expect(f.model.view(20_100)).toMatchObject({ notes: [], retainedNotes: 0 });
  });
  it("shares saved Phase 4 timing for equal, regressing and nonfinite observations", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 300 }, { receivedAtMs: 300 }, { receivedAtMs: 250 },
      { receivedAtMs: NaN, sourceTimeStampMs: 600 }, { receivedAtMs: Infinity, sourceTimeStampMs: null }, { receivedAtMs: -1, sourceTimeStampMs: -Infinity }]);
    const timing = projectImprovTiming(loaded); const model = timelineFromTake(loaded);
    expect(model.view(0, 0).notes.map(n => n.onsetMs)).toEqual(timing.events.map(e => e.atMs));
    expect(model.view(0, 0).issueCount).toBeGreaterThan(0); expect(loaded.chunks[0].events[3].raw.receivedAtMs).toBeNaN();
  });
  it("keeps clock positions stable for regressing/nonfinite frame observations", () => {
    const f = fixture(); expect(f.model.elapsed(1000)).toBe(900); expect(f.model.elapsed(200)).toBe(900);
    expect(f.model.elapsed(NaN)).toBe(900); expect(f.model.elapsed(Infinity)).toBe(900); expect(f.model.elapsed(IMPROV_PROJECTION_LIMIT_MS + 101)).toBe(900);
  });
  it.each(["background", "consumer-lost", "device-disconnected", "event-limit"] as const)("freezes %s without invented releases or new attacks", reason => {
    const f = fixture(); f.send([0x90, 60, 90], 10); f.rec.interrupt(reason, fixtureObservation(500));
    f.model.finishCapture(f.rec.metadata()!); f.send([0x90, 64, 90], 20);
    expect(f.model.view(9000)).toMatchObject({ recording: false, atMs: 400, notes: [{ pitch: 60, releaseMs: null }] });
  });
  it("marks invalid terminal timing uncertain and freezes at the accepted prefix", () => {
    const f = fixture(); f.send([0x90, 60, 90], 50); f.rec.stop(fixtureObservation(NaN)); f.model.finishCapture(f.rec.metadata()!);
    expect(f.model.view(999)).toMatchObject({ atMs: 50, knownEnd: false });
  });
  it("bounds pathological unmatched attacks and preserves FIFO after detail eviction", () => {
    const f = fixture(); for (let i = 0; i < IMPROV_LIVE_NOTES + 20; i++) f.send([0x90, 60, 90], i);
    const view = f.model.view(6000); expect(view.retainedNotes).toBe(IMPROV_LIVE_NOTES); expect(view.notes).toHaveLength(IMPROV_VISIBLE_NOTES);
    expect(view).toMatchObject({ crowded: true, omitted: 20 });
    for (let i = 0; i < 20; i++) f.send([0x80, 60, 0], 6000);
    expect(f.model.view(7000, 0, 50).notes[0].releaseMs).toBeNull(); f.send([0x80, 60, 0], 6100);
    expect(f.model.view(7000, 0, 50).notes[0].releaseMs).toBe(6100);
  });
  it("keeps recent attacks visible at the detail cap in their original delivery order", () => {
    const f = fixture(); for (let i = 0; i < 600; i++) f.send([0x90, 60, 90], i);
    const notes = f.model.view(1000).notes;
    expect(notes[0].sequence).toBe(89); expect(notes.at(-1)?.sequence).toBe(600);
    expect(notes.every((note, i) => !i || notes[i - 1].sequence < note.sequence)).toBe(true);
  });
  it("bounds visible history across a 15-minute performance", () => {
    const f = fixture(); let maximum = 0;
    for (let i = 0; i < 9000; i++) {
      f.send([0x90, 60 + i % 12, 90], i * 100); f.send([0x80, 60 + i % 12, 0], i * 100 + 40);
      maximum = Math.max(maximum, f.model.view(i * 100 + 200).retainedNotes);
    }
    expect(maximum).toBeLessThan(130); expect(f.model.view(900_100).notes.length).toBeLessThan(130);
  });
  it("indexes saved early/late windows including long cross-window intervals", () => {
    const f = fixture(true); f.send([0x90, 40, 90], 0);
    for (let i = 1; i < 10_000; i++) { f.send([0x90, 60, 90], i * 100); f.send([0x80, 60, 0], i * 100 + 20); }
    f.send([0x80, 40, 0], 1_000_000); f.model.finish(1_000_000, true);
    expect(f.model.view(0, 900_000).notes[0].pitch).toBe(40); expect(f.model.view(0, 0).notes[1].onsetMs).toBe(100);
    expect(f.model.view(0, 900_000).notes.length).toBeLessThan(125);
  });
  it("reconstructs an empty saved take with its known silent end", async () => {
    const { loaded } = await performanceFixture([], { end: 20_100 });
    expect(timelineFromTake(loaded).view(0, 0)).toMatchObject({ knownEnd: true, atMs: 20_000, notes: [] });
  });
  it("distinguishes an incomplete saved prefix from a known interrupted end", async () => {
    const { loaded } = await performanceFixture([{}, {}], { mode: "incomplete", committedCount: 1 });
    expect(timelineFromTake(loaded).view(0, 0)).toMatchObject({ knownEnd: false, notes: [{ onsetMs: 20 }] });
  });
  it("isolates first-take projections from new timelines and stale terminal appends", () => {
    const first = fixture(); first.send([0x90, 60, 80], 0); first.model.finish(100, true);
    const next = fixture(); next.send([0x90, 67, 80], 0); first.model.append(first.rec.readEvents(0, 1)[0]);
    expect(first.model.view(0).notes[0].pitch).toBe(60); expect(next.model.view(0).notes[0].pitch).toBe(67);
  });
});

describe("grand-staff written pitch geometry", () => {
  it.each([[60, 150, true], [64, 138, true], [77, 90, true], [43, 258, false], [57, 210, false], [59, 204, false]])("places MIDI %i at y=%i", (pitch, y, treble) => {
    expect(timelinePitch(pitch as number, noKey)).toMatchObject({ y, treble, displacement: 0 });
  });
  it("spells enharmonic notes with the selected key and correct staff letter", () => {
    expect(timelinePitch(61, { type: "key", keyId: "e-flat-major" })).toMatchObject({ name: "D♭4", y: 144 });
    expect(timelinePitch(61, { type: "key", keyId: "d-major" })).toMatchObject({ name: "C♯4", y: 150 });
  });
  it("draws ledger lines only at actual line positions", () => {
    expect(timelinePitch(60, noKey)?.ledgers).toEqual([150]); expect(timelinePitch(36, noKey)?.ledgers).toEqual([270, 282]);
    expect(timelinePitch(84, noKey)?.ledgers).toEqual([78, 66]); expect(timelinePitch(59, noKey)?.ledgers).toEqual([]);
  });
  it.each([0, 21, 108, 127])("keeps extreme MIDI %i readable through labeled octave displacement", pitch => {
    const layout = timelinePitch(pitch, noKey)!; expect(layout.y).toBeGreaterThanOrEqual(66); expect(layout.y).toBeLessThanOrEqual(282);
    expect(layout.displacement).not.toBe(0); expect(layout.ledgers.length).toBeLessThanOrEqual(3);
  });
  it("handles the whole MIDI range without unbounded vertical growth", () => {
    for (let pitch = 0; pitch < 128; pitch++) { const p = timelinePitch(pitch, noKey)!; expect(p.y).toBeGreaterThanOrEqual(66); expect(p.y).toBeLessThanOrEqual(282); }
    expect(timelinePitch(-1, noKey)).toBeNull();
  });
});
