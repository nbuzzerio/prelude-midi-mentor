import { immutableCopy, type ImprovLoadedTake } from "./improv-library";
import type { RawMidiMessage } from "@/lib/midi/midi-transport";

/** A bounded rendering policy, not a change to captured timing or an estimate of performed tempo. */
export const IMPROV_PROJECTION_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
export type ImprovTimingIssue = Readonly<{ sequence: number | null; reason: string }>;
export type ImprovTimingProjection = Readonly<{
  provenance: "derived-receipt-timing";
  events: readonly Readonly<{ sequence: number; atMs: number; source: "receipt" | "unverified-browser-fallback" | "previous-position" }>[];
  durationMs: number; knownEnd: boolean; issues: readonly ImprovTimingIssue[];
}>;

/** Delivery order is authoritative. Invalid/regressing positions hold at the previous position. */
export function projectImprovTiming(take: ImprovLoadedTake): ImprovTimingProjection {
  const start = take.record.capture.start.observation.atMs;
  const issues: ImprovTimingIssue[] = [];
  let previous = 0;
  const events = take.chunks.flatMap((chunk) => chunk.events).map((event) => {
    const issue = (reason: string) => issues.push({ sequence: event.sequence, reason });
    if (event.timing.sourceValidity !== "valid") issue("invalid-browser-timestamp");
    if (event.timing.sourceTimestampRegressed) issue("regressing-browser-timestamp");
    if (event.timing.receiptTimestampRegressed) issue("regressing-receipt-timestamp");
    let source: ImprovTimingProjection["events"][number]["source"] = "receipt";
    let position = event.raw.receivedAtMs - start;
    if (!Number.isFinite(event.raw.receivedAtMs) || event.raw.receivedAtMs < 0) {
      issue("invalid-receipt-timestamp");
      source = "unverified-browser-fallback";
      position = event.raw.sourceTimeStampMs === null ? NaN : event.raw.sourceTimeStampMs - start;
      issue("browser-clock-unverified");
    }
    if (!Number.isFinite(position) || position < 0 || position > IMPROV_PROJECTION_LIMIT_MS) {
      issue("position-unusable-or-outside-limit"); position = previous; source = "previous-position";
    } else if (position < previous) { issue("position-held-in-delivery-order"); position = previous; }
    previous = position;
    return { sequence: event.sequence, atMs: position, source };
  });
  const terminal = take.record.capture.terminal?.boundary;
  const fullPrefix = take.record.committedEventWatermark === take.record.capture.eventWatermark
    && take.record.connections.length === take.record.capture.connectionCount;
  const end = terminal ? terminal.observation.atMs - start : NaN;
  const knownEnd = ["completed", "interrupted"].includes(take.record.status) && fullPrefix && !!terminal
    && terminal.contextMatchesStart && terminal.validity === "valid" && end >= 0 && end <= IMPROV_PROJECTION_LIMIT_MS;
  if (!knownEnd) issues.push({ sequence: null, reason: "unknown-end-use-durable-prefix" });
  if (knownEnd && previous > end) issues.push({ sequence: null, reason: "delivered-events-after-observed-end" });
  return immutableCopy({ provenance: "derived-receipt-timing", events, durationMs: knownEnd ? Math.max(previous, end) : previous, knownEnd, issues });
}

export type ImprovDecodedMessage = Readonly<{
  kind: "channel" | "sysex" | "unsupported" | "malformed" | "missing";
  bytes: readonly number[]; channel: number | null; command: number | null;
}>;
/** Interpretation is separate from the raw journal; no normalization of velocity-zero encodings. */
export function decodeImprovMessage(raw: Pick<RawMidiMessage, "bytes" | "dataStatus">): ImprovDecodedMessage {
  const bytes = raw.bytes ?? [];
  const result = (kind: ImprovDecodedMessage["kind"], channel: number | null = null, command: number | null = null) => ({ kind, bytes, channel, command });
  if (raw.dataStatus !== "available" || raw.bytes === null) return result("missing");
  if (!bytes.length || bytes.some((v) => !Number.isInteger(v) || v < 0 || v > 255) || bytes[0] < 128) return result("malformed");
  const status = bytes[0];
  if (status < 240) {
    const command = status & 0xf0;
    const length = command === 0xc0 || command === 0xd0 ? 2 : 3;
    if (bytes.length !== length || bytes.slice(1).some((v) => v > 127)) return result("malformed");
    return result("channel", status & 15, command);
  }
  if (status === 0xf0) {
    return result(bytes.length >= 2 && bytes.at(-1) === 0xf7 && bytes.slice(1, -1).every((v) => v < 128) ? "sysex" : "malformed");
  }
  // System common/realtime bytes aren't channel events or SMF meta events (0xff is reset here).
  return result("unsupported");
}

export function summarizeImprovTake(take: ImprovLoadedTake) {
  const timing = projectImprovTiming(take);
  const pitches: number[] = []; const velocities: number[] = []; const attackPositions: number[] = [];
  const pairs: number[] = []; const held = new Map<string, { at: number; valid: boolean; ambiguous: boolean }[]>();
  let attacks = 0; let pedalEvents = 0; let repeatedOverlappingAttacks = 0; let unmatchedReleases = 0; let keyDown = 0; let maximumKeyDownPolyphony = 0;
  const events = take.chunks.flatMap((c) => c.events);
  events.forEach((event, i) => {
    const decoded = decodeImprovMessage(event.raw);
    if (decoded.kind !== "channel") return;
    const [, pitch, velocity] = decoded.bytes;
    if (decoded.command === 0xb0 && pitch === 64) pedalEvents++;
    const key = `${decoded.channel}:${pitch}`;
    if (decoded.command === 0x90 && velocity > 0) {
      attacks++; pitches.push(pitch); velocities.push(velocity); attackPositions.push(timing.events[i].atMs);
      const queue = held.get(key) ?? [];
      if (queue.length) { repeatedOverlappingAttacks++; queue.forEach((n) => { n.ambiguous = true; }); }
      queue.push({ at: event.raw.receivedAtMs, valid: event.timing.receiptValidity === "valid" && !event.timing.receiptTimestampRegressed, ambiguous: queue.length > 0 });
      held.set(key, queue); keyDown++; maximumKeyDownPolyphony = Math.max(maximumKeyDownPolyphony, keyDown);
    } else if (decoded.command === 0x80 || (decoded.command === 0x90 && velocity === 0)) {
      const attack = held.get(key)?.shift();
      if (!attack) { unmatchedReleases++; return; }
      keyDown--;
      if (!attack.ambiguous && attack.valid && event.timing.receiptValidity === "valid" && !event.timing.receiptTimestampRegressed && event.raw.receivedAtMs >= attack.at) pairs.push(event.raw.receivedAtMs - attack.at);
    }
  });
  return immutableCopy({ provenance: "derived-descriptive-summary", observedEvents: events.length,
    observedBoundaryDurationMs: timing.knownEnd ? take.record.capture.terminal!.boundary.observation.atMs - take.record.capture.start.observation.atMs : null,
    projectedDurationMs: timing.durationMs, noteAttacks: attacks,
    lowestPitch: pitches.length ? pitches.reduce((a, b) => Math.min(a, b)) : null, highestPitch: pitches.length ? pitches.reduce((a, b) => Math.max(a, b)) : null,
    velocity: { minimum: velocities.length ? velocities.reduce((a, b) => Math.min(a, b)) : null, maximum: velocities.length ? velocities.reduce((a, b) => Math.max(a, b)) : null,
      mean: velocities.length ? velocities.reduce((a, b) => a + b, 0) / velocities.length : null },
    pedalEvents, repeatedOverlappingAttacks, maximumKeyDownPolyphony, unmatchedReleases, unreleasedAttacks: keyDown,
    unambiguousReceiptPairedDurationsMs: pairs,
    projectedInterAttackGapsMs: attackPositions.slice(1).map((at, i) => at - attackPositions[i]), timingIssues: timing.issues });
}
