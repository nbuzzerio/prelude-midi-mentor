import { describe, expect, it } from "vitest";
import { exportImprovMidi, improvMidiBlob } from "./improv-midi-export";
import { performanceFixture, pausePerformanceFixture, pauseSteps } from "./improv-test-fixture";

/** Independent test decoder: consumes header/chunk lengths, four-byte VLQs, meta, SysEx and channel lengths. */
function decodeFile(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("MThd"); expect(view.getUint32(4)).toBe(6);
  expect(view.getUint16(8)).toBe(0); expect(view.getUint16(10)).toBe(1); expect(view.getUint16(12)).toBe(10000);
  expect(String.fromCharCode(...bytes.slice(14, 18))).toBe("MTrk"); expect(view.getUint32(18)).toBe(bytes.length - 22);
  let cursor = 22; let tick = 0;
  const variable = () => {
    let value = 0; let count = 0; let byte: number;
    do { byte = bytes[cursor++]; expect(byte).not.toBeUndefined(); expect(++count).toBeLessThanOrEqual(4); value = value * 128 + (byte & 127); } while (byte & 128);
    return value;
  };
  const events: { tick: number; bytes: number[]; meta?: number }[] = [];
  while (cursor < bytes.length) {
    tick += variable(); const status = bytes[cursor++];
    if (status === 255) { const meta = bytes[cursor++]; const length = variable(); events.push({ tick, meta, bytes: Array.from(bytes.slice(cursor, cursor + length)) }); cursor += length; }
    else if (status === 240 || status === 247) { const length = variable(); events.push({ tick, bytes: [status, ...bytes.slice(cursor, cursor + length)] }); cursor += length; }
    else {
      expect(status).toBeGreaterThanOrEqual(128); expect(status).toBeLessThan(240);
      const length = (status >> 4) === 12 || (status >> 4) === 13 ? 1 : 2;
      const data = Array.from(bytes.slice(cursor, cursor + length)); expect(data.every((byte) => byte < 128)).toBe(true);
      events.push({ tick, bytes: [status, ...data] }); cursor += length;
    }
  }
  expect(cursor).toBe(bytes.length); expect(events.at(-1)?.meta).toBe(47);
  return events;
}
const musical = (events: ReturnType<typeof decodeFile>) => events.filter((event) => event.meta === undefined);

describe("Standard MIDI File fixed transport projection", () => {
  it("removes intentional breaks and emits seam cleanup before same-tick resumed attacks", async () => {
    const f = await pausePerformanceFixture([{ atMs: 200, bytes: [0x90, 60, 80] }, ...pauseSteps(500, 10_500),
      { atMs: 10_500, bytes: [0x90, 64, 90] }, { atMs: 10_600, bytes: [0x80, 64, 0] }], 10_700);
    const before = structuredClone(f.loaded); const { bytes, report } = exportImprovMidi(f.loaded);
    expect(musical(decodeFile(bytes)).map(e => [e.tick, e.bytes])).toEqual([[1000, [0x90, 60, 80]], [4000, [0x80, 60, 0]],
      [4000, [0x90, 64, 90]], [5000, [0x80, 64, 0]]]);
    expect(report.endTick).toBe(6000); expect(report.generated[0].reason).toBe("pause-boundary-cleanup"); expect(f.loaded).toEqual(before);
  });
  it("excludes paused notes and their late releases and restores explicitly observed sustain", async () => {
    const p = pauseSteps(500, 10_500);
    const f = await pausePerformanceFixture([{ atMs: 200, bytes: [0x90, 60, 80] }, { atMs: 300, bytes: [0xb0, 64, 127] }, p[0], p[1],
      { atMs: 1000, bytes: [0x90, 60, 50] }, ...p.slice(2), { atMs: 10_500, bytes: [0x90, 60, 90] },
      { atMs: 10_600, bytes: [0x80, 60, 0] }, { atMs: 10_700, bytes: [0x90, 60, 0] }, { atMs: 10_800, bytes: [0x80, 60, 20] }], 10_900);
    const result = exportImprovMidi(f.loaded); const projected = musical(decodeFile(result.bytes));
    expect(projected.filter(e => (e.bytes[0] & 0xf0) === 0x90 && e.bytes[2] > 0).map(e => e.bytes[2])).toEqual([80, 90]);
    expect(projected.filter(e => (e.bytes[0] & 0xf0) === 0x80).map(e => e.tick)).toEqual([4000, 7000]);
    expect(result.report.omitted.map(e => e.reason)).toEqual(["intentional-pause-context", "cross-pause-release", "cross-pause-release"]);
    expect(result.report.generated.map(e => e.reason)).toEqual(["pause-boundary-cleanup", "pause-boundary-cleanup", "resume-observed-controller-restore", "terminal-cleanup"]);
  });
  it("Stop during Pause emits no Resume or long silent exported tail", async () => {
    const f = await pausePerformanceFixture([{ atMs: 200 }, ...pauseSteps(500, 10_500).slice(0, 2), { atMs: 10_000, bytes: [0xf8] }], 90_100);
    const result = exportImprovMidi(f.loaded); expect(decodeFile(result.bytes).at(-1)?.tick).toBe(4000);
    expect(result.report.generated).toHaveLength(1); expect(result.report.omitted[0].reason).toBe("intentional-pause-context");
  });
  it("writes the exact type-0 header, PPQ and 60 BPM transport tempo with empty trailing duration", async () => {
    const { loaded } = await performanceFixture([], { end: 2000 }); const result = exportImprovMidi(loaded);
    expect(Array.from(result.bytes.slice(0, 14))).toEqual([77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 39, 16]);
    const decoded = decodeFile(result.bytes);
    expect(decoded[0]).toEqual({ tick: 0, meta: 81, bytes: [15, 66, 64] }); expect(decoded.at(-1)?.tick).toBe(19000);
    expect(improvMidiBlob(loaded).blob.type).toBe("audio/midi");
  });
  it("rounds absolute positions before deriving deltas and retains simultaneous receipt order", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 1], receivedAtMs: 100.04 },
      { bytes: [0x90, 64, 2], receivedAtMs: 100.08 }, { bytes: [0x80, 60, 3], receivedAtMs: 100.12 },
      { bytes: [0x80, 64, 4], receivedAtMs: 100.12 }], { end: 101 });
    expect(musical(decodeFile(exportImprovMidi(loaded).bytes)).map((e) => [e.tick, e.bytes])).toEqual([
      [0, [0x90, 60, 1]], [1, [0x90, 64, 2]], [1, [0x80, 60, 3]], [1, [0x80, 64, 4]],
    ]);
  });
  it("preserves leading gaps, repeated notes and trailing boundary", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 30], receivedAtMs: 200 }, { bytes: [0x90, 60, 80], receivedAtMs: 200 },
      { bytes: [0x80, 60, 10], receivedAtMs: 300 }, { bytes: [0x80, 60, 20], receivedAtMs: 400 }], { end: 1000 });
    const decoded = decodeFile(exportImprovMidi(loaded).bytes);
    expect(musical(decoded).map((e) => e.tick)).toEqual([1000, 1000, 2000, 3000]); expect(decoded.at(-1)?.tick).toBe(9000);
  });
  it("keeps velocity-zero note-on and release velocity encodings unchanged", async () => {
    const messages = [[0x95, 60, 127], [0x95, 60, 0], [0x85, 61, 37]];
    const { loaded } = await performanceFixture(messages.map((bytes) => ({ bytes })));
    expect(musical(decodeFile(exportImprovMidi(loaded).bytes)).map((e) => e.bytes)).toEqual(messages);
  });
  it("preserves all 128 CC64 values, intermediate/repeated values and channels", async () => {
    const messages = [...Array.from({ length: 128 }, (_, value) => [0xb7, 64, value]), [0xb7, 64, 127], [0xb7, 64, 0]];
    const { loaded } = await performanceFixture(messages.map((bytes) => ({ bytes })));
    expect(musical(decodeFile(exportImprovMidi(loaded).bytes)).map((e) => e.bytes)).toEqual(messages);
  });
  it.each([[0xa1, 60, 22], [0xc2, 12], [0xd3, 100], [0xe4, 0, 64], [0xb5, 7, 127]])("writes correct channel-voice lengths %j", async (...bytes) => {
    const { loaded } = await performanceFixture([{ bytes }]);
    expect(musical(decodeFile(exportImprovMidi(loaded).bytes))[0].bytes).toEqual(bytes);
  });
  it("encodes complete SysEx with its SMF length and reports other system/malformed/missing events", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0xf0, 0x7d, 1, 0xf7] }, { bytes: [0xf8] }, { bytes: [0xff] },
      { bytes: [0xf1, 2] }, { bytes: [0x90, 60] }, { bytes: [0x90, 60, 128] }, { bytes: null, dataStatus: "unreadable" }]);
    const { bytes, report } = exportImprovMidi(loaded);
    expect(musical(decodeFile(bytes))).toHaveLength(1); expect(musical(decodeFile(bytes))[0].bytes).toEqual([0xf0, 0x7d, 1, 0xf7]);
    expect(report.representedEvents).toBe(1); expect(report.omitted.map((e) => e.reason)).toEqual(["unsupported", "unsupported", "unsupported", "malformed", "malformed", "missing"]);
  });
  it("bridges long pauses with valid neutral meta events instead of overflowing four-byte deltas", async () => {
    const end = 100 + 8 * 60 * 60 * 1000;
    const { loaded } = await performanceFixture([{ bytes: [0xc0, 1], receivedAtMs: end }], { end });
    const result = exportImprovMidi(loaded); const decoded = decodeFile(result.bytes);
    expect(result.report.paddingEvents).toBe(1); expect(musical(decoded)[0].tick).toBe(288000000); expect(decoded.at(-1)?.tick).toBe(288000000);
  });
  it("marks generated terminal releases and pedal-up solely in the exported projection", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x91, 60, 80] }, { bytes: [0x91, 60, 70] }, { bytes: [0xb1, 64, 100] }]);
    const before = structuredClone(loaded); const result = exportImprovMidi(loaded);
    expect(result.report.generated.map((e) => e.kind)).toEqual(["note-off", "note-off", "pedal-up"]);
    expect(musical(decodeFile(result.bytes)).slice(-3).map((e) => e.bytes)).toEqual([[0x81, 60, 0], [0x81, 60, 0], [0xb1, 64, 0]]);
    expect(loaded).toEqual(before); expect(result.report.generated.every((e) => e.tick === 4000)).toBe(true);
  });
  it.each(["recording", "incomplete"] as const)("exports only the durable %s prefix without a fabricated trailing boundary", async (mode) => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 200 }, { receivedAtMs: 900 }], { mode, committedCount: 1 });
    const result = exportImprovMidi(loaded); expect(result.report.timing.knownEnd).toBe(false); expect(decodeFile(result.bytes).at(-1)?.tick).toBe(1000);
    expect(result.report.generated).toHaveLength(1); expect(loaded.record.capture.terminal).toBeNull();
  });
  it("keeps interrupted known duration, and explicitly projects anomalous times safely", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: NaN, sourceTimeStampMs: 200 }, { receivedAtMs: Infinity, sourceTimeStampMs: null }], { mode: "interrupted" });
    const result = exportImprovMidi(loaded);
    expect(result.report.timing.issues.length).toBeGreaterThan(0); expect(decodeFile(result.bytes).at(-1)?.tick).toBe(4000);
    expect(Number.isNaN(loaded.chunks[0].events[0].raw.receivedAtMs)).toBe(true);
  });
});
