import { ImprovLibraryError, immutableCopy, type ImprovLoadedTake } from "./improv-library";
import { requireLoadedTake } from "./improv-library-validation";
import { decodeImprovMessage, projectImprovTiming, type ImprovProjectionStep } from "./improv-performance";

export const IMPROV_SMF_POLICY = Object.freeze({ format: 0, ppq: 10_000, microsecondsPerQuarter: 1_000_000, ticksPerMs: 10 });
const MAX_DELTA = 0x0fffffff; // Standard MIDI File delta-time VLQs are at most four bytes.
const MAX_FILE_BYTES = 64 * 1024 * 1024;

function vlq(value: number): number[] {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DELTA) throw new ImprovLibraryError("limit");
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 127) | 128);
  return bytes;
}
const u32 = (value: number) => [Math.floor(value / 0x1000000) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];

/** Type-0 SMF is a rendering projection. JSON, not SMF, is the lossless provenance backup. */
export function exportImprovMidi(take: ImprovLoadedTake) {
  requireLoadedTake(take);
  const timing = projectImprovTiming(take);
  const track: number[] = [];
  const omitted: { sequence: number; reason: string }[] = [];
  const generated: { kind: "note-off" | "pedal-up" | "pedal-restore"; channel: number; pitch: number | null; tick: number; reason?: string }[] = [];
  let lastTick = 0; let paddingEvents = 0; let representedEvents = 0;
  const held = new Map<string, number>(); const pedal = new Map<number, boolean>();
  const observedPedal = new Map<number, number>();
  const write = (tick: number, bytes: readonly number[]) => {
    let delta = tick - lastTick;
    if (!Number.isSafeInteger(delta) || delta < 0) throw new ImprovLibraryError("corrupt");
    // Neutral zero-length sequencer-specific meta events bridge pauses beyond the VLQ limit.
    while (delta > MAX_DELTA) { track.push(...vlq(MAX_DELTA), 0xff, 0x7f, 0); delta -= MAX_DELTA; paddingEvents++; }
    if (track.length + bytes.length + 4 > MAX_FILE_BYTES - 22) throw new ImprovLibraryError("limit");
    track.push(...vlq(delta));
    for (const byte of bytes) track.push(byte); // Large delivered SysEx must not overflow the JS argument stack.
    lastTick = tick;
  };
  write(0, [0xff, 0x51, 3, 0x0f, 0x42, 0x40]);
  const text = new TextEncoder().encode(`Prelude Improv: fixed 60 BPM transport; ${timing.knownEnd ? "observed end" : "durable prefix, unknown end"}; not performed tempo`);
  write(0, [0xff, 1, ...vlq(text.length), ...text]);
  const cleanup = (tick: number, reason: string) => {
    const provenance = take.record.schemaVersion === 2 ? { reason } : {};
    for (const [key, count] of held) {
      const [channel, pitch] = key.split(":").map(Number);
      for (let i = 0; i < count; i++) { write(tick, [0x80 | channel, pitch, 0]); generated.push({ kind: "note-off", channel, pitch, tick, ...provenance }); }
    }
    for (const [channel, down] of pedal) if (down) {
      write(tick, [0xb0 | channel, 64, 0]); generated.push({ kind: "pedal-up", channel, pitch: null, tick, ...provenance });
    }
    held.clear(); pedal.clear();
  };
  const events = take.chunks.flatMap(c => c.events);
  const steps: readonly ImprovProjectionStep[] = timing.steps ?? events.map((_, i) => ({ event: i, atMs: timing.events[i].atMs, paused: false, represented: true }));
  for (const step of steps) {
    const tick = Math.round(step.atMs * IMPROV_SMF_POLICY.ticksPerMs);
    if ("control" in step) {
      if (step.control.kind === "pause") cleanup(tick, "pause-boundary-cleanup");
      if (step.control.kind === "resume") for (const [channel, value] of observedPedal) if (value >= 64) {
        write(tick, [0xb0 | channel, 64, value]); pedal.set(channel, true);
        generated.push({ kind: "pedal-restore", channel, pitch: null, tick, reason: "resume-observed-controller-restore" });
      }
      continue;
    }
    const event = events[step.event];
    const decoded = decodeImprovMessage(event.raw);
    if (decoded.kind === "channel" && decoded.command === 0xb0 && decoded.bytes[1] === 64) observedPedal.set(decoded.channel!, decoded.bytes[2]);
    if (!step.represented) { omitted.push({ sequence: event.sequence, reason: step.paused ? "intentional-pause-context" : "cross-pause-release" }); continue; }
    if (decoded.kind === "channel") {
      write(tick, decoded.bytes); representedEvents++;
      const [, pitch, value] = decoded.bytes; const channel = decoded.channel!; const key = `${channel}:${pitch}`;
      if (decoded.command === 0x90 && value > 0) held.set(key, (held.get(key) ?? 0) + 1);
      else if (decoded.command === 0x80 || (decoded.command === 0x90 && value === 0)) held.set(key, Math.max(0, (held.get(key) ?? 0) - 1));
      else if (decoded.command === 0xb0 && pitch === 64) pedal.set(channel, value >= 64);
    } else if (decoded.kind === "sysex") {
      write(tick, [0xf0, ...vlq(decoded.bytes.length - 1), ...decoded.bytes.slice(1)]); representedEvents++;
    } else omitted.push({ sequence: event.sequence, reason: decoded.kind });
  }
  const endTick = Math.round(timing.durationMs * IMPROV_SMF_POLICY.ticksPerMs);
  cleanup(endTick, "terminal-cleanup");
  write(endTick, [0xff, 0x2f, 0]);
  const bytes = new Uint8Array(22 + track.length);
  bytes.set([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x27, 0x10, 0x4d, 0x54, 0x72, 0x6b, ...u32(track.length)]);
  bytes.set(track, 22);
  return { bytes, report: immutableCopy({ provenance: "derived-smf-projection", policy: IMPROV_SMF_POLICY,
    representedEvents, omitted, generated, paddingEvents, endTick, timing }) };
}

export function improvMidiBlob(take: ImprovLoadedTake) {
  const { bytes, report } = exportImprovMidi(take);
  return { blob: new Blob([bytes], { type: "audio/midi" }), report };
}
